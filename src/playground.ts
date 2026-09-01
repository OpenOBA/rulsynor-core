#!/usr/bin/env node
import type { DecisionObject } from './guard/index.js';
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
  extractNavigationGuide,
} from './index.js';

const args = process.argv.slice(2);
const tool = args.find(a => a.startsWith('--tool='))?.split('=')[1] || 'exec';
// Support --cmd with spaces: --cmd="rm -rf /" or --cmd=rm
const cmdArg = args.find(a => a.startsWith('--cmd='));
const cmd = cmdArg ? cmdArg.substring('--cmd='.length) : 'rm -rf /';
const pathArgRaw = args.find(a => a.startsWith('--path='));
const pathArg = pathArgRaw ? pathArgRaw.substring('--path='.length) : '/etc/shadow';
const urlArg =
  args.find(a => a.startsWith('--url='))?.split('=')[1] ||
  'http://169.254.169.254/latest/meta-data/';

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
const result = evaluator.evaluate(evalRules, {
  tool: { name: tool, args: toolArgs },
  sessionId: 'playground',
  agentId: 'demo',
});
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
  reason: result.primaryReason ?? null,
  matchedRules: result.matchedRules,
  totalEvaluated: result.totalEvaluated ?? evalRules.length,
  totalMatched: result.totalMatched ?? result.matchedRules.length,
  rules: evalRules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: duration,
}) as DecisionObject;

const aid = record.agent.aid;
// The jurisdiction may be undeclared (RULSYNOR_JURISDICTIONS unset = "not selected", key omitted per Omit over Null),
// so must not cast directly to string[] and call array methods — that throws TypeError when undeclared.
const jurisdictions = (record.compliance_profile.jurisdictions as string[] | undefined) ?? [];

// Turn a DENY/CORRECT into guidance the agent can act on.
const guidanceRules = presetRules.map(r => ({
  name: (r.parsed.name as string) || r.name,
  action: r.parsed.then
    ? {
        alternative: (r.parsed.then as Record<string, unknown>).alternative as
          string | { en: string } | undefined,
        correction: (r.parsed.then as Record<string, unknown>).correction as string | undefined,
      }
    : undefined,
}));

const guide = extractNavigationGuide({
  matchedRules: result.matchedRules as Array<{
    ruleId: string;
    decision: string;
    reason: string | null;
  }>,
  decision: result.decision,
  reason: result.primaryReason ?? null,
  rules: guidanceRules,
});

const alt = guide.alternatives.length ? guide.alternatives.join('; ') : '—';

const jsonMode = args.includes('--json');

if (jsonMode) {
  console.log(
    JSON.stringify({
      decision: result.decision,
      reason: result.primaryReason || null,
      auditHash: record.audit.hash,
      rulesEvaluated: evalRules.length,
      aid,
      jurisdictions,
      alternative: alt,
    }),
  );
} else {
  console.log('📋 Trained:    ' + evalRules.length + ' rules loaded');
  console.log('🛡️  Decision:   ' + result.decision);
  console.log('📝 Reason:     ' + (result.primaryReason || 'none'));
  console.log('🧾 Recorded:   ' + record.audit.hash + ' (tamper-evident)');
  console.log('🪪 Employee ID:' + ' ' + aid);
  console.log(
    '📊 Jurisdiction:' +
      ' ' +
      (jurisdictions.length
        ? jurisdictions.join(',')
        : '(not selected: declared by the deployer via RULSYNOR_JURISDICTIONS)'),
  );
  console.log('🧭 Alternative:' + ' ' + alt);
}
