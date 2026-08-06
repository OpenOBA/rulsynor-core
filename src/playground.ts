#!/usr/bin/env node
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
  extractNavigationGuide,
} from './index.js';

const args = process.argv.slice(2);
const tool = args.find((a) => a.startsWith('--tool='))?.split('=')[1] || 'exec';
const cmd = args.find((a) => a.startsWith('--cmd='))?.split('=')[1] || 'rm -rf /';
const pathArg = args.find((a) => a.startsWith('--path='))?.split('=')[1] || '/etc/shadow';
const urlArg = args.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://169.254.169.254/latest/meta-data/';

const toolArgs: Record<string, string> = { command: cmd };
if (tool === 'write_file') {
  toolArgs.path = pathArg;
  toolArgs.content = 'malicious';
  delete toolArgs.command;
}
if (tool === 'http_request') {
  toolArgs.url = urlArg;
  delete toolArgs.command;
}

// Load + compile the bundled preset rules into the shape the Evaluator consumes.
const presetRules = loadPresetRules();
const evalRules = toCompiledRules(presetRules);

// Evaluate the tool call before it runs.
const evaluator = new Evaluator(new GuardStateManager());
const startMs = Date.now();
const result = evaluator.evaluate(
  { toolName: tool, toolArgs, sessionId: 'playground', agentId: 'demo' },
  evalRules,
);
const duration = Date.now() - startMs;

// Build the tamper-evident Decision Object.
const record = buildDecisionObject({
  input: {
    runId: `demo-${Date.now()}`,
    step: 1,
    toolName: tool,
    toolArgs,
    context: {},
    agentId: 'demo',
    sessionId: 'playground',
  },
  decision: result.decision,
  actionTaken:
    result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT'
      ? 'blocked'
      : result.decision === 'REQUEST_HUMAN'
        ? 'paused'
        : 'allowed',
  reason: result.reason,
  matchedRules: result.matchedRuleId
    ? [{ ruleId: result.matchedRuleId, decision: result.decision, reason: result.reason }]
    : [],
  totalEvaluated: evalRules.length,
  totalMatched: result.matchedRuleId ? 1 : 0,
  rules: evalRules.map((r) => ({ name: r.name, version: 1 })),
  evaluationDurationMs: duration,
});

const aid = (record as any).agent.aid as string;
const jurisdictions = (record as any).compliance_profile.jurisdictions as string[];

// Turn a DENY/CORRECT into guidance the agent can act on.
const guidanceRules = presetRules.map((r) => ({
  name: (r.parsed.name as string) || r.name,
  action: r.parsed.then
    ? {
        alternative: (r.parsed.then as Record<string, unknown>).alternative as string | { en: string } | undefined,
        correction: (r.parsed.then as Record<string, unknown>).correction as string | undefined,
      }
    : undefined,
}));

const guide = extractNavigationGuide({
  matchedRules: result.matchedRuleId
    ? [{ ruleId: result.matchedRuleId, decision: result.decision, reason: result.reason }]
    : [],
  decision: result.decision,
  reason: result.reason,
  rules: guidanceRules,
});

const alt = guide.alternatives.length ? guide.alternatives.join('; ') : '—';

console.log('📋 Trained:    ' + evalRules.length + ' rules loaded');
console.log('🛡️  Decision:   ' + result.decision);
console.log('📝 Reason:     ' + (result.reason || 'none'));
console.log('🧾 Recorded:   ' + (record as any).audit.hash + ' (tamper-evident)');
console.log('🪪 Employee ID:' + ' ' + aid);
console.log('📊 Jurisdiction:' + ' ' + jurisdictions.join(',') + ' (GB/Z 185-2026 compliant)');
console.log('🧭 Alternative:' + ' ' + alt);
