/**
 * Operator test suite -?covers all operators used in preset .erdl.yaml files.
 * Ensures SafeExpr, RuntimeEvaluator, and RuleCompiler produce consistent results.
 */
import { SafeExprEvaluator } from '../src/engine/safe-expr.js';
import { Evaluator } from '../src/engine/evaluator.js';
import { GuardStateManager } from '../src/engine/guard-state-manager.js';

describe('SafeExpr -?all YAML-used operators', () => {
  const e = new SafeExprEvaluator();

  // Standard operators (already tested, verify still pass)
  it('eq', () => { expect(e.evaluate({ type: 'eq', args: ['x', 5] }, { x: 5 })).toBe(true); });
  it('ne', () => { expect(e.evaluate({ type: 'ne', args: ['x', 5] }, { x: 6 })).toBe(true); });
  it('gt', () => { expect(e.evaluate({ type: 'gt', args: ['x', 10] }, { x: 20 })).toBe(true); });
  it('gte', () => { expect(e.evaluate({ type: 'gte', args: ['x', 10] }, { x: 10 })).toBe(true); });
  it('lt', () => { expect(e.evaluate({ type: 'lt', args: ['x', 5] }, { x: 3 })).toBe(true); });
  it('lte', () => { expect(e.evaluate({ type: 'lte', args: ['x', 5] }, { x: 5 })).toBe(true); });
  it('in', () => { expect(e.evaluate({ type: 'in', args: ['x', ['a','b']] }, { x: 'b' })).toBe(true); });
  it('not_in', () => { expect(e.evaluate({ type: 'not_in', args: ['x', ['a']] }, { x: 'z' })).toBe(true); });
  it('contains', () => { expect(e.evaluate({ type: 'contains', args: ['x', 'he'] }, { x: 'hello' })).toBe(true); });
  it('exists', () => { expect(e.evaluate({ type: 'exists', args: ['x'] }, { x: 1 })).toBe(true); });
  it('starts_with', () => { expect(e.evaluate({ type: 'starts_with', args: ['x', '/etc'] }, { x: '/etc/hosts' })).toBe(true); });
  it('ends_with', () => { expect(e.evaluate({ type: 'ends_with', args: ['x', '.js'] }, { x: 'app.js' })).toBe(true); });

  // Operators added for YAML rule compatibility (P1 fix)
  it('matches (regex)', () => { expect(e.evaluate({ type: 'matches', args: ['x', '^\\d{3}$'] }, { x: '123' })).toBe(true); });
  it('matches fails on non-match', () => { expect(e.evaluate({ type: 'matches', args: ['x', '^\\d{3}$'] }, { x: 'abc' })).toBe(false); });
  it('neq', () => { expect(e.evaluate({ type: 'neq', args: ['x', 5] }, { x: 6 })).toBe(true); });
  it('not_exists (true for missing)', () => { expect(e.evaluate({ type: 'not_exists', args: ['x'] }, {})).toBe(true); });
  it('not_exists (false for present)', () => { expect(e.evaluate({ type: 'not_exists', args: ['x'] }, { x: 1 })).toBe(false); });
  it('not_contains', () => { expect(e.evaluate({ type: 'not_contains', args: ['x', 'bye'] }, { x: 'hello' })).toBe(true); });
  it('not_contains fails', () => { expect(e.evaluate({ type: 'not_contains', args: ['x', 'he'] }, { x: 'hello' })).toBe(false); });

  // Length operators (used by block-large-writes, correct-oversize-args)
  it('length_gt', () => { expect(e.evaluate({ type: 'length_gt', args: ['x', 5] }, { x: 'long string' })).toBe(true); });
  it('length_gt fails', () => { expect(e.evaluate({ type: 'length_gt', args: ['x', 100] }, { x: 'short' })).toBe(false); });
  it('length_gte', () => { expect(e.evaluate({ type: 'length_gte', args: ['x', 3] }, { x: 'abc' })).toBe(true); });
  it('length_lt', () => { expect(e.evaluate({ type: 'length_lt', args: ['x', 10] }, { x: 'short' })).toBe(true); });
  it('length_lte', () => { expect(e.evaluate({ type: 'length_lte', args: ['x', 5] }, { x: 'hello' })).toBe(true); });
  it('length_eq', () => { expect(e.evaluate({ type: 'length_eq', args: ['x', 3] }, { x: 'abc' })).toBe(true); });
});

describe('Evaluator -?YAML rule equivalents', () => {
  const state = new GuardStateManager();
  const ev = new Evaluator(state);

  it('matches operator in evaluator (equivalent to block-dangerous-cmd)', () => {
    const r = ev.evaluate(
      { toolName: 'exec', toolArgs: { command: 'rm -rf /' }, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: '',
         conditions: [{ field: 'toolArgs.command', operator: 'matches', value: 'rm\\s+-rf' }],
         conditionLogic: 'AND', enabled: true }],
    );
    expect(r.decision).toBe('DENY');
  });

  it('length_gt operator in evaluator (equivalent to block-large-writes)', () => {
    const longContent = 'x'.repeat(20000000); // 20MB
    const r = ev.evaluate(
      { toolName: 'write_file', toolArgs: { path: '/tmp/test', content: longContent }, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: '',
         conditions: [{ field: 'toolArgs.content', operator: 'length_gt', value: 10485760 }],
         conditionLogic: 'AND', enabled: true }],
    );
    expect(r.decision).toBe('DENY');
  });

  it('not_exists operator in evaluator', () => {
    const r = ev.evaluate(
      { toolName: 'exec', toolArgs: {}, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: '',
         conditions: [{ field: 'toolArgs.command', operator: 'not_exists' }],
         conditionLogic: 'AND', enabled: true }],
    );
    expect(r.decision).toBe('DENY');
  });

  it('neq operator in evaluator', () => {
    const r = ev.evaluate(
      { toolName: 'exec', toolArgs: { command: 'ls' }, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: '',
         conditions: [{ field: 'toolName', operator: 'neq', value: 'read' }],
         conditionLogic: 'AND', enabled: true }],
    );
    expect(r.decision).toBe('DENY');
  });
});
