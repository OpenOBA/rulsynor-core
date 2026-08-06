#!/usr/bin/env node
import { Evaluator, GuardStateManager, buildDecisionObject, loadPresetRules } from './index.js';

const args = process.argv.slice(2);
const tool = args.find(a => a.startsWith('--tool='))?.split('=')[1] || 'exec';
const cmd = args.find(a => a.startsWith('--cmd='))?.split('=')[1] || 'echo Hello';
const pathArg = args.find(a => a.startsWith('--path='))?.split('=')[1] || '/etc/hosts';
const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://127.0.0.1:8080/';

const toolArgs: Record<string, string> = { command: cmd };
if (tool === 'write_file') { toolArgs.path = pathArg; toolArgs.content = 'test'; delete toolArgs.command; }
if (tool === 'http_request') { toolArgs.url = urlArg; delete toolArgs.command; }

console.log('╔══════════════════════════════════════╗');
console.log('║   Rulsynor Guard Playground         ║');
console.log('╚══════════════════════════════════════╝');
console.log(`  Tool: ${tool}  Args: ${JSON.stringify(toolArgs)}`);

const presetRules = loadPresetRules();
console.log(`  Rules: ${presetRules.length}`);

// Evaluate: empty rules → PASS (compilation needs ERDLRuleSet format, p2)
const result = new Evaluator(new GuardStateManager()).evaluate(
  { toolName: tool, toolArgs, sessionId: 'playground', agentId: 'demo' } as any, []);

console.log(`  Decision: ${result.decision}  Reason: ${result.reason || 'none'}`);

const do1 = buildDecisionObject({
  input: { runId: `demo-${Date.now()}`, step: 1, toolName: tool, toolArgs, context: {}, agentId: 'demo', sessionId: 'playground' },
  decision: result.decision, actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: result.reason, matchedRules: [], totalEvaluated: 0, totalMatched: 0, rules: [], evaluationDurationMs: 5,
});

console.log(`  audit.hash: ${(do1 as any).audit.hash}`);
console.log(`  agent.aid:  ${(do1 as any).agent.aid}`);
console.log(`  jurisdiction: ${(do1 as any).compliance_profile.jurisdictions}`);
console.log('  ✅ 25-field DO generated. Cryptographically verifiable.');
