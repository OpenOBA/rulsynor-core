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
import { buildDecisionObject } from './guard/index.js';

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
  onToolResult?: (result: string, step: number) => void;
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
  } = opts;

  const messages: LLMMessage[] = [
    { role: 'system', content: 'You are an AI assistant with tool access. Use tools when needed.' },
    { role: 'user', content: userMessage },
  ];

  const auditHashes: string[] = [];
  // R3 修复：previous_hash 链锚定（SPEC v2.0 MUST）——每步 DO 锚定上一步哈希
  let prevHash: string | null = null;
  let finalResponse = '';
  let step = 0;

  for (step = 0; step < maxSteps; step++) {
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

      // Guard evaluation — uses compiled rules for actual enforcement
      const evalStart = performance.now();
      const evalResult = evaluator.evaluate(opts.compiledRules, ctx);
      const reason = evalResult.primaryReason || 'guard rule matched';

      // R3 修复：CORRECT 决策先应用纠偏再决定是否放行（无纠偏内容则 fail-close 不执行）
      let effectiveArgs = tc.arguments;
      const canApplyCorrection =
        evalResult.decision === 'CORRECT' &&
        typeof evalResult.primaryCorrection === 'string' &&
        evalResult.primaryCorrection.length > 0;
      if (canApplyCorrection) {
        effectiveArgs = { ...tc.arguments, __correction: evalResult.primaryCorrection };
      }

      // 是否放行执行：仅 ALLOW/NOTIFY/GUIDE（建议性）与带纠偏的 CORRECT 放行；其余一律不执行
      const shouldExecute =
        evalResult.decision === 'ALLOW' ||
        evalResult.decision === 'NOTIFY' ||
        evalResult.decision === 'GUIDE' ||
        canApplyCorrection;

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
        rules,
        evaluationDurationMs: Math.round(performance.now() - evalStart),
      });

      const auditHash = do1.audit.hash;
      auditHashes.push(auditHash);
      prevHash = auditHash;
      onGuardEval?.(evalResult.decision, auditHash, step);

      // R3 修复：穷尽式决策分发——任何非放行决策都不执行工具（含 ESCALATE/DEFER/DELEGATE/WORKFLOW 与未知决策）
      if (!shouldExecute) {
        switch (evalResult.decision) {
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
            // 无纠偏内容的 CORRECT：fail-close，转人工
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
            // 未知决策一律 fail-close
            finalResponse = `Action blocked (unknown decision "${evalResult.decision}", fail-close): ${reason}`;
            break;
        }
        return {
          decision: evalResult.decision,
          thought: response.content,
          steps: step + 1,
          auditHashes,
          finalResponse,
        };
      }

      // Execute tool
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
