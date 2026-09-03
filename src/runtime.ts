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
import type { RuleDefinition, Decision } from './engine/rule-definition.js';
import { ruleWhenToExpr } from './engine/expr-tree/rule-to-expr.js';
import { toSExpr } from './engine/expr-tree/s-expression.js';
import { buildDecisionObject } from './guard/index.js';
import type { DecisionObject } from './guard/index.js';
import { PlanParser } from './engine/plan-parser.js';
import { resolveDomain, formatRagContext } from './knowledge/index.js';
import type { ScoredFragment } from './knowledge/types.js';
import {
  parseRequestHumanSignal,
  buildDoPayload,
  advanceCorrectLoop,
} from './preflight/index.js';
import type { CorrectLoopState } from './preflight/index.js';

export interface DecisionObjectMeta {
  sessionId: string;
  agentId: string;
  step: number;
  toolName: string;
}

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
  /**
   * Business context injected into Guard evaluation (`context.*` rule fields).
   * Deterministic input supplied by the host (maintenance mode, GDPR relevance,
   * transaction amount/type, event type, etc.) — NOT guessed by the LLM.
   * Rules referencing `context.*` fire only when the host supplies the matching value.
   */
  context?: Record<string, unknown>;
  /** Do a separate planning LLM call (② 制定计划); default true */
  planFirst?: boolean;
  /** 7-step progress callback (①理解意图 → ⑦审计落链) */
  onStep?: (step: number, detail: string) => void;
  /**
   * CORRECT loop progress (original design D21): fired on every state transition of the
   * 3-round correction state machine — round start, round advance, resolution, escalation.
   */
  onCorrectLoop?: (state: CorrectLoopState, round: number) => void;
  /**
   * Fallback decision (metadata.decision, language spec §2.2): the verdict applied when
   * no rule matches. Resolved from the loaded documents by getFallbackDecision(); when
   * omitted the evaluator's default ALLOW applies.
   */
  fallbackDecision?: Decision;
  /**
   * Decision Object hook (⑦ 审计落链): called for every guarded tool call with the
   * fully-built, tamper-evident DO plus loop metadata. CORE uses it for
   * persistence/read-only viewing; export/download is deliberately NOT a CORE capability.
   */
  onDecisionObject?: (decisionObject: DecisionObject, meta: DecisionObjectMeta) => void;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool result (role='tool'): the id of the tool_call this message answers. */
  tool_call_id?: string;
  /** Assistant tool calls replayed to the model (structured round-trip). */
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>;
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

/**
 * Derive the agent's declared promise from its plan (ETH-001 言行一致).
 * A plan whose every step is a read operation (OP_READ) declares a read-only
 * intent — if the agent then attempts a write tool, ETH-001 requests human
 * approval. Deterministic derivation from the structured plan; never LLM-guessed.
 */
function derivePreviousPromise(plan: ReturnType<PlanParser['parse']> | null): string | undefined {
  if (!plan?.hasPlan || plan.steps.length === 0) return undefined;
  return plan.steps.every(s => s.opSem === 'OP_READ') ? 'read_only' : undefined;
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
    context = {},
    planFirst = true,
    onStep,
    fallbackDecision,
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

  // Derive the agent's declared promise from the plan (deterministic, see derivePreviousPromise).
  // Merged into the evaluation context as `context.previous_promise` for ETH-001 (言行一致).
  const previousPromise = derivePreviousPromise(plan);
  const evalContext: Record<string, unknown> =
    previousPromise !== undefined ? { ...context, previous_promise: previousPromise } : context;

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

  // ── CORRECT loop state (original design D21 — Henry Plan A) ──
  // A CORRECT verdict starts a bounded retry sequence: the correction guidance is fed back
  // to the agent, which re-issues the call; every retry gets a fresh deterministic verdict.
  // Max 3 correction rounds → then escalate to human (REQUEST_HUMAN). The state machine is
  // advanceCorrectLoop() (preflight/guard-integration). The ORIGINAL args are never executed
  // (fail-open hole fixed in 4c6f653) — only a fresh ALLOW executes the corrected call.
  let correctRound = 0; // 0 = no active sequence; otherwise current round (1..3)
  let correctState: CorrectLoopState | null = null;
  let correctRuleId = '';
  let correctOriginalCall: { name: string; args: Record<string, unknown> } | null = null;

  for (step = 0; step < maxSteps; step++) {
    // ── ④ 推理决策 ──
    onStep?.(4, `reasoning (ReAct round ${step + 1})`);
    const response = await llm(messages);

    if (!response.toolCalls || response.toolCalls.length === 0) {
      finalResponse = response.content;
      onThought?.(response.content, step);
      break;
    }

    // Normalize tool calls with a guaranteed id and replay them to the model so the
    // structured tool_calls survive the round-trip (function-calling requires the assistant
    // tool_calls to be echoed back before the tool-result messages).
    const calls = response.toolCalls.map((tc, i) => ({
      id: tc.id ?? `call-${step}-${i}`,
      name: tc.name,
      arguments: tc.arguments,
    }));
    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: calls,
    });

    for (const tc of calls) {
      onThought?.(response.content, step);
      onToolCall?.(tc.name, tc.arguments, step);

      const ctx: Record<string, unknown> = {
        // Canonical evaluation context: Entity namespaces at the top level —
        // `tool.name`/`tool.args.*` for the tool call (ERDL SPEC §3/§4/§7),
        // `context.*` for business context. NOT `{context:{tool:...}}`.
        tool: { name: tc.name, args: tc.arguments },
        context: evalContext,
        sessionId,
        agentId,
      };
      // metadata.decision fallback (§2.2) — injected when the host resolves one from the
      // loaded documents; absent -> evaluator default ALLOW.
      if (fallbackDecision !== undefined) {
        ctx['metadata.decision'] = fallbackDecision;
      }

      // ── ⑤ 规则把关 ──
      const evalStart = performance.now();
      const evalResult = evaluator.evaluate(opts.compiledRules, ctx);
      const reason = evalResult.primaryReason || 'guard rule matched';
      onStep?.(5, `guard: ${evalResult.decision}`);

      const rhDetected = parseRequestHumanSignal(response.content).detected;
      const shouldExecute =
        (evalResult.decision === 'ALLOW' ||
          evalResult.decision === 'NOTIFY' ||
          evalResult.decision === 'GUIDE') &&
        !rhDetected;

      // Build DO
      const do1 = buildDecisionObject({
        input: {
          runId: `runtime-${Date.now()}`,
          step,
          toolName: tc.name,
          toolArgs: tc.arguments,
          context: evalContext,
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
      opts.onDecisionObject?.(do1, {
        sessionId,
        agentId,
        step,
        toolName: tc.name,
      });
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

      // ── CORRECT loop (original design D21) ──
      // The tool call is NOT executed on CORRECT. The correction guidance goes back to the
      // agent as tool feedback; the agent re-issues the call; the guard re-adjudicates each
      // attempt deterministically. After 3 correction rounds without resolution the runtime
      // escalates to a human (REQUEST_HUMAN).
      // An explicit REQUEST_HUMAN signal in the agent's reply takes precedence over the loop.
      if (evalResult.decision === 'CORRECT' && !rhDetected) {
        const correction = evalResult.primaryCorrection || reason;
        const primaryCorrectRule = (evalResult.matchedRules ?? []).find(
          m => m.decision === 'CORRECT',
        );

        let loopState: CorrectLoopState;
        if (correctRound === 0) {
          // Sequence start: first correction round.
          correctRuleId = primaryCorrectRule?.ruleId ?? 'unknown';
          correctOriginalCall = { name: tc.name, args: tc.arguments };
          correctState = 'correct_round_1';
          correctRound = 1;
          loopState = correctState;
        } else {
          const loopOutcome = advanceCorrectLoop(
            {
              ruleId: correctRuleId,
              originalToolCall: correctOriginalCall ?? { name: tc.name, args: tc.arguments },
              correction,
              round: correctRound,
              state: correctState ?? 'correct_round_1',
            },
            'CORRECT',
          );

          if (loopOutcome.escalate) {
            // 3 rounds exhausted → escalate to human (original design: 3 轮失败 → 升级人工).
            opts.onCorrectLoop?.('correct_escalated', correctRound);
            finalResponse = `Correction loop exhausted after ${correctRound} rounds — escalated to human operator: ${correction}`;
            return {
              decision: 'REQUEST_HUMAN',
              thought: response.content,
              steps: step + 1,
              auditHashes,
              finalResponse,
            };
          }

          correctRound += 1;
          correctState = loopOutcome.state;
          loopState = correctState;
        }

        opts.onCorrectLoop?.(loopState, correctRound);
        onStep?.(5, `guard: CORRECT (round ${correctRound}/3)`);

        // Feedback as tool result keeps the function-calling round-trip intact:
        // the assistant tool_calls message was already pushed, so this tool message
        // answers tc.id and the next LLM round sees the correction guidance.
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content:
            `Guard verdict: CORRECT (round ${correctRound}/3). ` +
            `Correction: ${correction} ` +
            `Re-issue the tool call with corrected arguments.`,
        });
        continue;
      }

      // Any non-CORRECT verdict ends an active correction sequence. The state machine only
      // models the verdicts it knows: ALLOW → correct_resolved; DENY/EMERGENCY_HALT →
      // correct_escalated (= leave the loop; the terminal disposition still follows the
      // verdict itself — a hard DENY stays blocked, it is not converted into a human ask).
      // Other verdicts (NOTIFY/GUIDE/DEFER/…) end the sequence silently — the DO chain
      // already records exactly what happened.
      if (correctRound > 0) {
        const d = evalResult.decision;
        if (d === 'ALLOW' || d === 'DENY' || d === 'EMERGENCY_HALT') {
          const resolution = advanceCorrectLoop(
            {
              ruleId: correctRuleId,
              originalToolCall: correctOriginalCall ?? { name: tc.name, args: tc.arguments },
              correction: '',
              round: correctRound,
              state: correctState ?? 'correct_round_1',
            },
            d,
          );
          opts.onCorrectLoop?.(resolution.state, correctRound);
        }
        correctRound = 0;
        correctState = null;
        correctRuleId = '';
        correctOriginalCall = null;
      }

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
          // CORRECT is fully handled by the correction loop above (never reaches this dispatch).
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
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `Tool "${tc.name}" not found.`,
        });
        continue;
      }

      const toolResult = await executor.execute(tc.arguments);

      onToolResult?.(toolResult, step);

      messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
    }
  }

  if (!finalResponse && step >= maxSteps) {
    finalResponse = 'Max steps reached without completion.';
  }

  // Exiting with an unresolved correction sequence (agent stopped re-issuing instead of
  // resolving it) must not read as ALLOW — report CORRECT so the summary matches the audit
  // chain (which already holds every CORRECT DO).
  const endedMidCorrection = correctRound > 0;

  return {
    decision: step >= maxSteps ? 'MAX_STEPS' : endedMidCorrection ? 'CORRECT' : 'ALLOW',
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
