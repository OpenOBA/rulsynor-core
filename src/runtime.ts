/**
 * Minimal Chat Runtime — zero framework dependency.
 * ReAct loop + Guard evaluation + tool execution.
 *
 * Usage:
 *   import { runReActLoop, createToolExecutor } from '@openoba/rulsynor-core/runtime';
 *
 *   const result = await runReActLoop({
 *     llm: myLLMFunction,
 *     guard: new Evaluator(new GuardStateManager()),
 *     rules: [...],
 *     tools: { exec: myExecTool },
 *     userMessage: 'List files in current directory',
 *   });
 */

import { Evaluator } from './engine/evaluator.js';
import type { RuleDefinition } from './engine/rule-definition.js';
import { ruleWhenToExpr } from './engine/expr-tree/rule-to-expr.js';
import { toSExpr } from './engine/expr-tree/s-expression.js';
import { buildDecisionObject } from './guard/index.js';
import { PlanParser } from './engine/plan-parser.js';
import { resolveDomain, formatRagContext } from './knowledge/index.js';
import type { ScoredFragment } from './knowledge/types.js';
import { parseRequestHumanSignal, buildDoPayload } from './preflight/index.js';

export interface RuntimeOptions {
  /** LLM function: takes messages, returns assistant response with possible tool calls */
  llm: (messages: LLMMessage[]) => Promise<LLMResponse>;
  /** ERDL rule evaluator */
  evaluator: Evaluator;
  /** Compiled rules for Guard evaluation (actual enforcement) */
  compiledRules: RuleDefinition[];
  /** Rule metadata for Decision Object (name/version only) */
  rules: Array<{ name: string; version: number }>;
  /** Tool executors */
  tools: Record<string, ToolExecutor>;
  /** User message to start loop */
  userMessage: string;
  /** Agent identity */
  agentId?: string;
  sessionId?: string;
  /** Max ReAct steps (default: 10) */
  maxSteps?: number;
  /** Callbacks */
  onThought?: (thought: string, step: number) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>, step: number) => void;
  onGuardEval?: (decision: string, auditHash: string, step: number) => void;
  /** Tool result callback */
  onToolResult?: (result: string, step: number) => void;
  /** Knowledge fragments for evidence assembly (③ 组装依据) */
  knowledge?: ScoredFragment[];
  /** Do a separate planning LLM call (② 制定计划); default true */
  planFirst?: boolean;
  /** 7-step progress callback (①理解意图 → ⑦审计落链) */
  onStep?: (step: number, detail: string) => void;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export interface ToolExecutor {
  execute(args: Record<string, unknown>): Promise<string>;
}

export interface RuntimeResult {
  decision: string;
  thought: string;
  steps: number;
  auditHashes: string[];
  finalResponse: string;
}

/** Convert compiled engine rules to v1.5 policy shape (name/version/when/then/priority/ring).
 *  when = toSExpr(ruleWhenToExpr(rule)) — pure conditions → S-expression (SPEC §12 external form);
 *  non-pure conditions (within/rate/pattern/keywords) return null → when omitted. */
function toPolicyRules(compiledRules: RuleDefinition[]): Array<{
  name: string;
  version?: number;
  when?: unknown;
  then?: unknown;
  priority?: number;
  ring?: number;
}> {
  return compiledRules.map(r => {
    const whenExpr = ruleWhenToExpr(r);
    return {
      name: r.name,
      ...(r.version !== undefined ? { version: r.version } : {}),
      ...(whenExpr !== null ? { when: toSExpr(whenExpr) } : {}),
      then: r.action.decision,
      priority: r.priority,
      ...(r.action.ring !== undefined ? { ring: r.action.ring } : {}),
    };
  });
}

export async function runReActLoop(opts: RuntimeOptions): Promise<RuntimeResult> {
  const {
    llm,
    evaluator,
    rules,
    tools,
    userMessage,
    agentId = 'runtime-agent',
    sessionId = `session-${Date.now()}`,
    maxSteps = 10,
    onThought,
    onToolCall,
    onGuardEval,
    onToolResult,
    knowledge = [],
    planFirst = true,
    onStep,
  } = opts;

  // ── ① 理解意图 ──
  const intentDomain = resolveDomain(userMessage);
  onStep?.(1, `intent domain: ${intentDomain ?? 'general'}`);

  // ── ② 制定计划 ──
  let plan: ReturnType<PlanParser['parse']> | null = null;
  if (planFirst) {
    const planResp = await llm([
      {
        role: 'system',
        content:
          'You are a planning assistant. Break the user task into a concise step-by-step PLAN. ' +
          'Use the format: "PLAN:\nStep 1: <description> | tools: <tool1, tool2> | op: <READ|WRITE|DELETE|EXEC|NETWORK|MEMORY> | purpose: <why>\nStep 2: ...". ' +
          'Keep steps minimal and safe.',
      },
      { role: 'user', content: userMessage },
    ]);
    plan = new PlanParser().parse(planResp.content);
    onStep?.(
      2,
      plan.hasPlan
        ? `plan: ${plan.steps.length} steps, risk ${plan.riskLevel}`
        : 'no plan recognized',
    );
  }

  // ── ③ 组装依据 ──
  const ragContext = formatRagContext(knowledge);
  onStep?.(3, `assembled ${knowledge.length} knowledge fragment(s)`);

  const systemContent =
    'You are an AI assistant with tool access. Use tools when needed.' +
    (plan?.hasPlan ? `\n\nExecution plan:\n${plan.planText}` : '') +
    (ragContext ? `\n\nAvailable knowledge (assemble evidence):\n${ragContext}` : '');
  const messages: LLMMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userMessage },
  ];

  const auditHashes: string[] = [];
  // R3 fix: previous_hash chain anchoring (SPEC v2.0 MUST) — each step's DO anchors the previous step's hash
  let prevHash: string | null = null;
  let finalResponse = '';
  let step = 0;

  for (step = 0; step < maxSteps; step++) {
    // ── ④ 推理决策 ──
    onStep?.(4, `reasoning (ReAct round ${step + 1})`);
    const response = await llm(messages);

    if (!response.toolCalls || response.toolCalls.length === 0) {
      finalResponse = response.content;
      onThought?.(response.content, step);
      break;
    }

    for (const tc of response.toolCalls) {
      onThought?.(response.content, step);
      onToolCall?.(tc.name, tc.arguments, step);

      const ctx = {
        tool: { name: tc.name, args: tc.arguments },
        sessionId,
        agentId,
      };

      // ── ⑤ 规则把关 ──
      const evalStart = performance.now();
      const evalResult = evaluator.evaluate(opts.compiledRules, ctx);
      const reason = evalResult.primaryReason || 'guard rule matched';
      onStep?.(5, `guard: ${evalResult.decision}`);

      // CORRECT single-pass: apply correction then execute (no correction content → fail-close)
      let effectiveArgs = tc.arguments;
      const canApplyCorrection =
        evalResult.decision === 'CORRECT' &&
        typeof evalResult.primaryCorrection === 'string' &&
        evalResult.primaryCorrection.length > 0;
      if (canApplyCorrection) {
        effectiveArgs = { ...tc.arguments, __correction: evalResult.primaryCorrection };
      }

      // Agent-initiated REQUEST_HUMAN (explicit markers in the reply) — overrides execute
      const rhDetected = parseRequestHumanSignal(response.content).detected;
      const shouldExecute =
        (evalResult.decision === 'ALLOW' ||
          evalResult.decision === 'NOTIFY' ||
          evalResult.decision === 'GUIDE' ||
          canApplyCorrection) &&
        !rhDetected;

      // Build DO
      const do1 = buildDecisionObject({
        input: {
          runId: `runtime-${Date.now()}`,
          step,
          toolName: tc.name,
          toolArgs: effectiveArgs,
          context: {},
          agentId,
          sessionId,
          previousAuditHash: prevHash,
        },
        decision: evalResult.decision,
        actionTaken: shouldExecute
          ? 'allowed'
          : evalResult.decision === 'DENY'
            ? 'blocked'
            : 'paused',
        reason: evalResult.primaryReason ?? null,
        matchedRules: evalResult.matchedRules ?? [],
        totalEvaluated: evalResult.totalEvaluated ?? rules.length,
        totalMatched: evalResult.totalMatched ?? evalResult.matchedRules.length,
        rules: toPolicyRules(opts.compiledRules),
        evaluationDurationMs: Math.round(performance.now() - evalStart),
      });

      const auditHash = do1.audit.hash;
      auditHashes.push(auditHash);
      prevHash = auditHash;
      onGuardEval?.(evalResult.decision, auditHash, step);
      // ⑦ 审计落链：DO 载荷记录组装的知识版本（RAG provenance）
      const doPayload = buildDoPayload(
        knowledge.length > 0
          ? {
              dataRefs: knowledge.map(f => ({
                dataRefId: f.knowledgeId,
                version: f.knowledgeVersion ?? '',
              })),
            }
          : {},
      );
      onStep?.(
        7,
        `audit: ${auditHash.slice(0, 16)}…${doPayload.dataRefs?.length ? ` (${doPayload.dataRefs.length} knowledge refs)` : ''}`,
      );

      // R3 fix: exhaustive decision dispatch — any non-allow decision does not execute the tool (incl. ESCALATE/DEFER/DELEGATE/WORKFLOW and unknown decisions)
      if (!shouldExecute) {
        const dispatchDecision = rhDetected ? 'REQUEST_HUMAN' : evalResult.decision;
        switch (dispatchDecision) {
          case 'DENY':
          case 'EMERGENCY_HALT':
            finalResponse = `Action blocked: ${reason}`;
            break;
          case 'REQUEST_HUMAN':
            finalResponse = `Human approval required: ${reason}`;
            break;
          case 'ESCALATE':
            finalResponse = `Escalated to human operator: ${reason}`;
            break;
          case 'QUARANTINE':
            finalResponse = `Tool call quarantined for review: ${reason}`;
            break;
          case 'ROLLBACK':
            finalResponse = `Rollback triggered: ${reason}`;
            break;
          case 'CORRECT':
            // CORRECT with no correction content: fail-close, escalate to human
            finalResponse = `Correction required but no correction provided: ${reason}`;
            break;
          case 'DEFER':
            finalResponse = `Action deferred: ${reason}`;
            break;
          case 'DELEGATE':
            finalResponse = `Delegation required (not supported by this runtime): ${reason}`;
            break;
          case 'WORKFLOW':
            finalResponse = `Workflow handoff required (not supported by this runtime): ${reason}`;
            break;
          default:
            // unknown decision always fail-close
            finalResponse = `Action blocked (unknown decision "${evalResult.decision}", fail-close): ${reason}`;
            break;
        }
        return {
          decision: dispatchDecision,
          thought: response.content,
          steps: step + 1,
          auditHashes,
          finalResponse,
        };
      }

      // ── ⑥ 执行操作 ──
      onStep?.(6, `execute: ${tc.name}`);
      const executor = tools[tc.name];
      if (!executor) {
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: `Tool "${tc.name}" not found.` });
        continue;
      }

      const toolResult = await executor.execute(effectiveArgs);

      onToolResult?.(toolResult, step);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: `Tool result: ${toolResult}` });
    }
  }

  if (!finalResponse && step >= maxSteps) {
    finalResponse = 'Max steps reached without completion.';
  }

  return {
    decision: step >= maxSteps ? 'MAX_STEPS' : 'ALLOW',
    thought: '',
    steps: step,
    auditHashes,
    finalResponse,
  };
}

/** Create a simple tool executor from a plain function */
export function createToolExecutor(
  fn: (args: Record<string, unknown>) => Promise<string>,
): ToolExecutor {
  return { execute: fn };
}
