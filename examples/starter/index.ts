/**
 * My First Agent with Guard — minimal integration template
 *
 * Copy this folder and run:
 *   cd my-agent && npm install && npm start
 *
 * This is the simplest way to add Guard to your Agent:
 *   1. Define your tools
 *   2. Create the Guard evaluator
 *   3. Wrap tool execution with evaluate() → execute() → commitTemporal()
 */
import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules, buildDecisionObject } from '@openoba/rulsynor-core';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// ── 1. Define your tools ──

const myTools = {
  // A dangerous tool — will be guarded
  shell: {
    name: 'shell',
    description: 'Run a shell command',
    execute: async (args: Record<string, unknown>) => {
      const cmd = args.command as string;
      return execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    },
  },

  // A safe tool — always allowed
  readFile: {
    name: 'readFile',
    description: 'Read a file from disk',
    execute: async (args: Record<string, unknown>) => {
      return readFileSync(args.path as string, 'utf-8');
    },
  },

  // A tool with path constraints — writes to /etc should be blocked
  writeFile: {
    name: 'writeFile',
    description: 'Write content to a file',
    execute: async (args: Record<string, unknown>) => {
      writeFileSync(args.path as string, args.content as string);
      return `Written: ${args.path}`;
    },
  },
};

// ── 2. Set up the Guard ──

const evaluator = new Evaluator(new GuardStateManager());
const rules = toCompiledRules(loadPresetRules()); // 29 preset rules

// ── 3. The integration: wrap your tool execution ──

async function guardedExecute(
  tool: { name: string; execute: (args: Record<string, unknown>) => Promise<string> },
  args: Record<string, unknown>,
  sessionId: string,
  agentId: string,
) {
  const ctx = {
    tool: { name: tool.name, args },
    sessionId,
    agentId,
  };

  const evalStart = performance.now();
  const result = evaluator.evaluate(rules, ctx);
  const duration = Math.round(performance.now() - evalStart);

  // Guard decision
  if (result.decision === 'DENY') {
    console.log(`🛑 Guard blocked ${tool.name}: ${result.reason}`);
    return { blocked: true, reason: result.reason };
  }

  // Audit record
  const do1 = buildDecisionObject({
    input: { runId: `run-${Date.now()}`, step: 0, toolName: tool.name, toolArgs: args, context: {}, agentId, sessionId },
    decision: result.decision,
    actionTaken: 'allowed',
    reason: result.reason,
    matchedRules: result.matchedRules ?? [],
    totalEvaluated: rules.length,
    totalMatched: result.totalMatched ?? 0,
    rules: rules.map(r => ({ name: r.name, version: 1 })),
    evaluationDurationMs: duration,
  });

  // Execute!
  const output = await tool.execute(args);

  // Commit temporal counters
  evaluator.commitTemporal(ctx, rules);

  console.log(`✅ ${tool.name} — ${do1.audit.hash.substring(0, 16)}…`);
  return { allowed: true, output, auditHash: do1.audit.hash };
}

// ── Demo ──

async function main() {
  console.log('=== My First Agent with Guard ===\n');

  // Safe: read a file
  await guardedExecute(myTools.readFile, { path: 'package.json' }, 'session-1', 'agent-1');

  // Dangerous: rm -rf → blocked
  await guardedExecute(myTools.shell, { command: 'rm -rf /' }, 'session-1', 'agent-1');

  // Dangerous: write to /etc → blocked
  await guardedExecute(myTools.writeFile, { path: '/etc/cron.d/x', content: 'x' }, 'session-1', 'agent-1');

  console.log('\n✨ Your Agent is guarded. Every decision is auditable.');
}

main().catch(console.error);
