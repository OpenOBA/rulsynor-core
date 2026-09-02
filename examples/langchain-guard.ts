/**
 * example: Guard a LangChain/LangGraph Agent
 *
 * Demonstrates how to insert @openoba/rulsynor-core as a tool-call interception
 * layer in any LangChain-compatible Agent. The pattern is universal:
 *
 *   LLM generates tool_call → Guard evaluates → DENY/ALLOW/CORRECT → execute or block
 *
 * This works with LangChain AgentExecutor, LangGraph custom nodes,
 * or any framework where you control the tool execution path.
 *
 * Usage: npx tsx examples/langchain-guard.ts
 */

import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules, buildDecisionObject } from '@openoba/rulsynor-core';

// 1. Train: compile preset rules (29 rules)
const rules = toCompiledRules(loadPresetRules());

// 2. Create the Guard
const evaluator = new Evaluator(new GuardStateManager());

// 3. The integration point: wrap your tool executor
//    This is the function you would inject into LangChain's tool callback
//    or LangGraph's tool node.
async function guardedToolExecutor(
  toolName: string,
  toolArgs: Record<string, unknown>,
  sessionId: string,
  agentId: string,
  executeTool: () => Promise<string>,
): Promise<string> {
  const evalStart = performance.now();
  const result = evaluator.evaluate(rules, {
    tool: { name: toolName, args: toolArgs },
    sessionId,
    agentId,
  });
  const duration = Math.round(performance.now() - evalStart);

  // Block dangerous calls
  if (result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT') {
    throw new Error(`Guard blocked ${toolName}: ${result.reason}`);
  }

  // Pause for human approval
  if (result.decision === 'REQUEST_HUMAN') {
    throw new Error(`Human approval required: ${result.reason}`);
  }

  // Quarantine suspicious patterns
  if (result.decision === 'QUARANTINE') {
    console.warn(`[Guard] QUARANTINE ${toolName}: ${result.reason} — executing with review flag`);
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

  console.log(`[Guard] ALLOW ${toolName} — audit: ${do1.audit.hash.substring(0, 18)}...`);

  // Execute the actual tool
  const toolResult = await executeTool();

  // After successful execution, commit temporal counters (required for within/rate rules)
  evaluator.commitTemporal(
    { toolName, toolArgs, sessionId, agentId },
    rules,
  );

  return toolResult;
}

// 4. LangChain integration pseudocode:
//
//   import { AgentExecutor, createToolCallingAgent } from 'langchain';
//
//   const agent = createToolCallingAgent({ llm, tools, prompt });
//   const executor = new AgentExecutor({ agent, tools });
//
//   // Wrap each tool with Guard
//   const guardedTools = tools.map(tool => ({
//     ...tool,
//     call: async (args: any) => {
//       return guardedToolExecutor(
//         tool.name, args, sessionId, agentId,
//         () => tool.call(args),
//       );
//     },
//   }));
//
//   const result = await executor.invoke({ input: '...' });

// Demo
async function demo() {
  console.log('=== LangChain Guard Demo ===\n');

  try {
    await guardedToolExecutor('exec', { command: 'rm -rf /' }, 'lc-1', 'agent-1',
      async () => 'done');
  } catch (e: any) {
    console.log('🛑 Blocked:', e.message);
  }

  try {
    await guardedToolExecutor('read', { path: '/tmp/data.txt' }, 'lc-1', 'agent-1',
      async () => 'file contents here');
  } catch (e: any) {
    console.log('🛑 Blocked:', e.message);
  }
}

demo().catch(console.error);
