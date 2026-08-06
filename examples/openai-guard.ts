/**
 * example: Guard an OpenAI function calling Agent
 *
 * Demonstrates how to intercept tool calls between the LLM response
 * and actual execution — the minimal integration pattern.
 *
 * Usage: npx tsx examples/openai-guard.ts
 */

import { Evaluator, GuardStateManager, loadPresetRules, toERDLRuleSet, buildDecisionObject } from '@rulsynor/core';

// 1. Train: load preset security rules (32 rules out of the box)
const presetRules = loadPresetRules();
const ruleSet = toERDLRuleSet(presetRules);

const compiledRules = ruleSet.rules.map((r: Record<string, unknown>, i: number) => {
  const conditions: Array<Record<string, unknown>> = (r.conditions as Array<Record<string, unknown>>) || [];
  return {
    id: (r.id as string) || (r.name as string) || `rule-${i}`,
    name: (r.name as string) || `rule-${i}`,
    priority: (r.priority as number) || 100,
    ring: (r.ring as number) || 0,
    decision: (r.then as string) || 'DENY',
    reason: (r.message as string) || (r.description as string) || '',
    conditions: conditions.map((c: Record<string, unknown>) => ({
      field: (c.field as string) || '',
      operator: (c.operator as string) || 'eq',
      value: c.value ?? undefined,
    })),
    conditionLogic: ((r.conditionLogic as 'AND' | 'OR') || 'AND'),
    enabled: true,
  };
});

// 2. Deploy: create the Guard evaluator
const evaluator = new Evaluator(new GuardStateManager());

// 3. Integration: wrap your tool execution with Guard
async function guardedToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
  agentId: string,
) {
  const result = evaluator.evaluate(
    { toolName, toolArgs, sessionId, agentId },
    compiledRules,
  );

  if (result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT') {
    console.log(`🛑 Guard blocked: ${result.reason}`);
    return { blocked: true, reason: result.reason };
  }

  if (result.decision === 'REQUEST_HUMAN') {
    console.log(`👤 Human approval required: ${result.reason}`);
    return { paused: true, reason: result.reason };
  }

  // Build audit record
  const do1 = buildDecisionObject({
    input: { runId: `run-${Date.now()}`, step: 0, toolName, toolArgs, context: {}, agentId, sessionId },
    decision: result.decision,
    actionTaken: 'allowed',
    reason: result.reason,
    matchedRules: result.matchedRuleId
      ? [{ ruleId: result.matchedRuleId, decision: result.decision, ring: result.ring || 0 }]
      : [],
    totalEvaluated: compiledRules.length,
    totalMatched: result.matchedRuleId ? 1 : 0,
    rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
    evaluationDurationMs: 0,
  });

  console.log(`✅ Allowed: ${toolName} — audit hash: ${(do1 as any).audit.hash.substring(0, 18)}...`);
  return { allowed: true, auditHash: (do1 as any).audit.hash };
}

// 4. Demo: simulate an OpenAI function call
async function demo() {
  console.log('=== OpenAI Guard Demo ===\n');

  // Dangerous call — blocked
  await guardedToolCall('exec', { command: 'rm -rf /' }, 'session-1', 'agent-1');

  // Safe call — allowed
  await guardedToolCall('read', { path: '/tmp/data.txt' }, 'session-1', 'agent-1');

  // Suspicious — blocked
  await guardedToolCall('exec', { command: 'whoami' }, 'session-1', 'agent-1');
}

demo().catch(console.error);
