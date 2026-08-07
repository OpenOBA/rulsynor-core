/**
 * Minimal Chat Runtime — zero framework dependency.
 * ReAct loop + Guard evaluation + tool execution.
 *
 * Usage:
 *   import { runReActLoop, createToolExecutor } from '@rulsynor/core/runtime';
 *
 *   const result = await runReActLoop({
 *     llm: myLLMFunction,
 *     guard: new Evaluator(new GuardStateManager()),
 *     rules: [...],
 *     tools: { exec: myExecTool },
 *     userMessage: 'List files in current directory',
 *   });
 */

import { Evaluator, type CompiledRule } from './engine/evaluator.js';
import { buildDecisionObject } from './guard/index.js';

export interface RuntimeOptions {
  /** LLM function: takes messages, returns assistant response with possible tool calls */
  llm: (messages: LLMMessage[]) => Promise<LLMResponse>;
  /** ERDL rule evaluator */
  evaluator: Evaluator;
  /** Compiled rules for Guard evaluation (actual enforcement) */
  compiledRules: CompiledRule[];
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
    llm, evaluator, rules, tools,
    userMessage, agentId = 'runtime-agent', sessionId = `session-${Date.now()}`,
    maxSteps = 10,
    onThought, onToolCall, onGuardEval, onToolResult,
  } = opts;

  const messages: LLMMessage[] = [
    { role: 'system', content: 'You are an AI assistant with tool access. Use tools when needed.' },
    { role: 'user', content: userMessage },
  ];

  const auditHashes: string[] = [];
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
        toolName: tc.name,
        toolArgs: tc.arguments,
        sessionId,
        agentId,
      };

      // Guard evaluation — uses compiled rules for actual enforcement
      const evalStart = performance.now();
      const evalResult = evaluator.evaluate(ctx, opts.compiledRules);

      // Build DO
      const do1 = buildDecisionObject({
        input: { runId: `runtime-${Date.now()}`, step, toolName: tc.name, toolArgs: tc.arguments, context: {}, agentId, sessionId },
        decision: evalResult.decision,
        actionTaken: evalResult.decision === 'DENY' ? 'blocked' : evalResult.decision === 'REQUEST_HUMAN' ? 'paused' : 'allowed',
        reason: evalResult.reason ?? null,
        matchedRules: evalResult.matchedRules ?? [],
        totalEvaluated: evalResult.totalEvaluated ?? rules.length,
        totalMatched: evalResult.totalMatched ?? (evalResult.matchedRuleId ? 1 : 0),
        rules,
        evaluationDurationMs: Math.round(performance.now() - evalStart),
      });

      const auditHash = (do1 as any).audit.hash;
      auditHashes.push(auditHash);
      onGuardEval?.(evalResult.decision, auditHash, step);

      if (evalResult.decision === 'DENY' || evalResult.decision === 'EMERGENCY_HALT') {
        finalResponse = `Action blocked: ${evalResult.reason || 'guard rule matched'}`;
        return { decision: evalResult.decision, thought: response.content, steps: step + 1, auditHashes, finalResponse };
      }

      if (evalResult.decision === 'REQUEST_HUMAN') {
        finalResponse = `Human approval required: ${evalResult.reason || 'pending review'}`;
        return { decision: evalResult.decision, thought: response.content, steps: step + 1, auditHashes, finalResponse };
      }

      // Execute tool
      const executor = tools[tc.name];
      if (!executor) {
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: `Tool "${tc.name}" not found.` });
        continue;
      }

      const toolResult = await executor.execute(tc.arguments);
      onToolResult?.(toolResult, step);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: `Tool result: ${toolResult}` });
    }
  }

  if (!finalResponse && step >= maxSteps) {
    finalResponse = 'Max steps reached without completion.';
  }

  return { decision: 'ALLOW', thought: '', steps: step, auditHashes, finalResponse };
}

/** Create a simple tool executor from a plain function */
export function createToolExecutor(fn: (args: Record<string, unknown>) => Promise<string>): ToolExecutor {
  return { execute: fn };
}
