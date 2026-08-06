/**
 * example: Guard a LangChain/LangGraph Agent
 *
 * Demonstrates how to insert @rulsynor/core as a tool-call interception
 * layer in any LangChain-compatible Agent. The pattern is universal:
 *
 *   LLM generates tool_call → Guard evaluates → DENY/ALLOW/CORRECT → execute or block
 *
 * This works with LangChain AgentExecutor, LangGraph custom nodes,
 * or any framework where you control the tool execution path.
 *
 * Usage: npx tsx examples/langchain-guard.ts
 */

import { Evaluator, GuardStateManager, loadPresetRules, toERDLRuleSet, buildDecisionObject } from '@rulsynor/core';

// 1. Train: load rules (29 after experiment-verified cleanup)
const presetRules = loadPresetRules();
const ruleSet = toERDLRuleSet(presetRules);

function toCompiledRules(ruleSet: ReturnType<typeof toERDLRuleSet>) {
  return ruleSet.rules.map((r: Record<string, unknown>, i: number) => {
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
}

const rules = toCompiledRules(ruleSet);

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
  const result = evaluator.evaluate(
    { toolName, toolArgs, sessionId, agentId },
    rules,
  );

  // Block dangerous calls
  if (result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT') {
    throw new Error(`Guard blocked ${toolName}: ${result.reason}`);
  }

  // Pause for human approval
  if (result.decision === 'REQUEST_HUMAN') {
    throw new Error(`Human approval required: ${result.reason}`);
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
    totalEvaluated: rules.length,
    totalMatched: result.matchedRuleId ? 1 : 0,
    rules: rules.map(r => ({ name: r.name, version: 1 })),
    evaluationDurationMs: 0,
  });

  console.log(`[Guard] ALLOW ${toolName} — audit: ${(do1 as any).audit.hash.substring(0, 18)}...`);

  // Execute the actual tool
  return executeTool();
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
