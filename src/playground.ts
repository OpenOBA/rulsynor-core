#!/usr/bin/env node
import { Evaluator, GuardStateManager, buildDecisionObject, loadPresetRules, toERDLRuleSet, extractNavigationGuide } from './index.js';

const args = process.argv.slice(2);
const tool = args.find(a => a.startsWith('--tool='))?.split('=')[1] || 'exec';
const cmd = args.find(a => a.startsWith('--cmd='))?.split('=')[1] || 'rm -rf /';
const pathArg = args.find(a => a.startsWith('--path='))?.split('=')[1] || '/etc/shadow';
const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://169.254.169.254/latest/meta-data/';

const toolArgs: Record<string, string> = { command: cmd };
if (tool === 'write_file') { toolArgs.path = pathArg; toolArgs.content = 'malicious'; delete toolArgs.command; }
if (tool === 'http_request') { toolArgs.url = urlArg; delete toolArgs.command; }

console.log('╔══════════════════════════════════════╗');
console.log('║   Rulsynor Guard Playground         ║');
console.log('╚══════════════════════════════════════╝');
console.log(`  Tool: ${tool}  Args: ${JSON.stringify(toolArgs)}`);
console.log('');

// Load preset rules and compile to ERDLRuleSet
const presetRules = loadPresetRules();
console.log(`  📋 Rules loaded: ${presetRules.length}`);
const ruleSet = toERDLRuleSet(presetRules);
console.log(`  🔧 RuleSet: ${ruleSet.rules.length} rules, protocol=${ruleSet.protocol}`);

// Build evaluator-compatible rules from raw definitions
const evalRules = ruleSet.rules.map((r: Record<string, unknown>, i: number) => {
  const conditions: Array<Record<string, unknown>> = (r.conditions as Array<Record<string, unknown>>) || [];
  return {
    id: (r.id as string) || (r.name as string) || `rule-${i}`,
    name: (r.name as string) || `rule-${i}`,
    priority: (r.priority as number) || 100,
    ring: (r.ring as number) || 0,
    decision: (r.then as string) || 'DENY',
    reason: (r.message as string) || (r.description as string) || 'Rule matched',
    conditions: conditions.map((c: Record<string, unknown>) => ({
      field: (c.field as string) || '',
      operator: (c.operator as string) || 'eq',
      value: c.value ?? undefined,
    })),
    conditionLogic: ((r.conditionLogic as 'AND' | 'OR') || 'AND'),
    enabled: true,
  };
});

console.log(`  🛡️  Rules active: ${evalRules.length}`);
evalRules.forEach((r: { name: string; decision: string }) => {
  console.log(`     ${r.decision === 'DENY' ? '🛑' : '✅'} ${r.name} → ${r.decision}`);
});
console.log('');

// Evaluate
const evaluator = new Evaluator(new GuardStateManager());
const startMs = Date.now();
const result = evaluator.evaluate(
  { toolName: tool, toolArgs, sessionId: 'playground', agentId: 'demo' },
  evalRules,
);
const duration = Date.now() - startMs;

// Display result
const icon = result.decision === 'ALLOW' ? '✅' : result.decision === 'DENY' ? '🛑' : result.decision === 'CORRECT' ? '🔧' : '⚠️';
console.log(`  ${icon} Decision: ${result.decision}`);
console.log(`  📝 Reason:   ${result.reason || 'none'}`);
console.log(`  ⏱️  Duration: ${duration}ms`);
console.log('');

// Build Decision Object
const do1 = buildDecisionObject({
  input: { runId: `demo-${Date.now()}`, step: 1, toolName: tool, toolArgs, context: {}, agentId: 'demo', sessionId: 'playground' },
  decision: result.decision,
  actionTaken: result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT' ? 'blocked'
    : result.decision === 'REQUEST_HUMAN' ? 'paused' : 'allowed',
  reason: result.reason,
  matchedRules: result.matchedRuleId ? [{ ruleId: result.matchedRuleId, decision: result.decision, ring: result.ring || 0 }] : [],
  totalEvaluated: evalRules.length,
  totalMatched: result.matchedRuleId ? 1 : 0,
  rules: evalRules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: duration,
});

console.log('  🔐 Decision Object:');
console.log(`     audit.hash: ${(do1 as any).audit.hash}`);
console.log(`     agent.aid:  ${(do1 as any).agent.aid}`);
console.log(`     jurisdiction: ${(do1 as any).compliance_profile.jurisdictions}`);
console.log('');

// Navigation guide on DENY/CORRECT
if (result.decision === 'DENY' || result.decision === 'CORRECT') {
  const guide = extractNavigationGuide({
    matchedRules: result.matchedRuleId ? [{ ruleId: result.matchedRuleId, decision: result.decision, reason: result.reason }] : [],
    decision: result.decision,
    reason: result.reason,
  });
  console.log('  🧭 Navigation Guide:');
  if (guide.blockedReasons.length) console.log(`     Blocked:  ${guide.blockedReasons.join('; ')}`);
  if (guide.corrections.length) console.log(`     Fix:      ${guide.corrections.join('; ')}`);
  if (guide.alternatives.length) console.log(`     Alt:      ${guide.alternatives.join('; ')}`);
  console.log('');
}

console.log('  ✅ Done.');
