/**
 * example: Guard an OpenAI function calling Agent
 *
 * Demonstrates how to intercept tool calls between the LLM response
 * and actual execution — the minimal integration pattern.
 *
 * Usage: npx tsx examples/openai-guard.ts
 */

import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules, buildDecisionObject } from '@openoba/rulsynor-core';

// 1. Train: compile preset rules (29 rules)
const rules = toCompiledRules(loadPresetRules());

// 2. Deploy: create the Guard evaluator
const evaluator = new Evaluator(new GuardStateManager());

// 3. Integration: wrap your tool execution with Guard
async function guardedToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
  agentId: string,
) {
  const evalStart = performance.now();
  const result = evaluator.evaluate(
    { toolName, toolArgs, sessionId, agentId },
    rules,
  );
  const duration = Math.round(performance.now() - evalStart);

  if (result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT') {
    console.log(`🛑 Guard blocked: ${result.reason}`);
    return { blocked: true, reason: result.reason };
  }

  if (result.decision === 'REQUEST_HUMAN') {
    console.log(`👤 Human approval required: ${result.reason}`);
    return { paused: true, reason: result.reason };
  }

  if (result.decision === 'QUARANTINE') {
    console.warn(`🧪 Quarantine: ${result.reason} — flag for review`);
  }

  // Build audit record
  const do1 = buildDecisionObject({
    input: { runId: `run-${Date.now()}`, step: 0, toolName, toolArgs, context: {}, agentId, sessionId },
    decision: result.decision,
    actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
    reason: result.reason,
    matchedRules: result.matchedRules ?? (result.matchedRuleId
      ? [{ ruleId: result.matchedRuleId, decision: result.decision, ring: result.ring || 0 }]
      : []),
    totalEvaluated: rules.length,
    totalMatched: result.totalMatched ?? (result.matchedRuleId ? 1 : 0),
    rules: rules.map(r => ({ name: r.name, version: 1 })),
    evaluationDurationMs: duration,
  });

  console.log(`✅ Allowed: ${toolName} — audit hash: ${do1.audit.hash.substring(0, 18)}...`);

  // After ALLOW, commit temporal counters (required for within/rate rules)
  evaluator.commitTemporal(
    { toolName, toolArgs, sessionId, agentId },
    rules,
  );

  return { allowed: true, auditHash: do1.audit.hash };
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
