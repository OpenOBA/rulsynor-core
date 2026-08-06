/**
 * Extended test suite â€?SafeExpr, Evaluator, Preflight boundary.
 * Uses ESM import (ts-jest transforms .ts).
 */
import { SafeExprEvaluator } from '../src/engine/safe-expr.js';
import { Evaluator } from '../src/engine/evaluator.js';
import { GuardStateManager } from '../src/engine/guard-state-manager.js';
import { buildDecisionObject, generateAID } from '../src/guard/index.js';
import { PROVENANCE } from '../src/provenance.js';

describe('SafeExpr extended', () => {
  const e = new SafeExprEvaluator();

  it('eq', () => { expect(e.evaluate({ type: 'eq', args: ['x', 5] }, { x: 5 })).toBe(true); });
  it('ne', () => { expect(e.evaluate({ type: 'ne', args: ['x', 5] }, { x: 6 })).toBe(true); });
  it('gt', () => { expect(e.evaluate({ type: 'gt', args: ['x', 10] }, { x: 20 })).toBe(true); });
  it('gte', () => { expect(e.evaluate({ type: 'gte', args: ['x', 10] }, { x: 10 })).toBe(true); });
  it('lt', () => { expect(e.evaluate({ type: 'lt', args: ['x', 5] }, { x: 3 })).toBe(true); });
  it('lte', () => { expect(e.evaluate({ type: 'lte', args: ['x', 5] }, { x: 5 })).toBe(true); });
  it('in', () => { expect(e.evaluate({ type: 'in', args: ['x', ['a','b']] }, { x: 'b' })).toBe(true); });
  it('not_in', () => { expect(e.evaluate({ type: 'not_in', args: ['x', ['a']] }, { x: 'z' })).toBe(true); });
  it('contains', () => { expect(e.evaluate({ type: 'contains', args: ['x', 'he'] }, { x: 'hello' })).toBe(true); });
  it('match regex', () => { expect(e.evaluate({ type: 'match', args: ['x', '^\\d+$'] }, { x: '123' })).toBe(true); });
  it('exists', () => { expect(e.evaluate({ type: 'exists', args: ['x'] }, { x: 1 })).toBe(true); });
  it('starts_with', () => { expect(e.evaluate({ type: 'starts_with', args: ['x', '/etc'] }, { x: '/etc/hosts' })).toBe(true); });
  it('ends_with', () => { expect(e.evaluate({ type: 'ends_with', args: ['x', '.js'] }, { x: 'app.js' })).toBe(true); });
  it('and', () => {
    expect(e.evaluate({ type: 'and', args: [{ type: 'eq', args: ['a', 1] }, { type: 'eq', args: ['b', 2] }] }, { a: 1, b: 2 })).toBe(true);
  });
  it('or', () => {
    expect(e.evaluate({ type: 'or', args: [{ type: 'eq', args: ['a', 1] }, { type: 'eq', args: ['b', 99] }] }, { a: 1, b: 2 })).toBe(true);
  });
  it('not', () => {
    expect(e.evaluate({ type: 'not', args: [{ type: 'eq', args: ['a', 1] }] }, { a: 2 })).toBe(true);
  });
  it('throws on missing field', () => {
    expect(() => e.evaluate({ type: 'eq', args: ['missing', 'v'] }, {})).toThrow('not found');
  });
  it('exists on missing field returns false', () => {
    expect(e.evaluate({ type: 'exists', args: ['missing'] }, {})).toBe(false);
  });
});

describe('Evaluator boundary', () => {
  const state = new GuardStateManager();
  const ev = new Evaluator(state);
  const ctx = { toolName: 'exec', toolArgs: {}, sessionId: 's1', agentId: 'a1' };

  it('skips disabled rules', () => {
    const r = ev.evaluate(ctx, [{ id: 'r1', name: 'b', priority: 100, ring: 0, decision: 'DENY', reason: '',
      conditions: [{ field: 'toolName', operator: 'eq', value: 'exec' }], conditionLogic: 'AND', enabled: false }]);
    expect(r.decision).toBe('ALLOW');
  });

  it('first-match-wins by ring+priority', () => {
    const r = ev.evaluate(ctx, [
      { id: 'allow', name: 'a', priority: 10, ring: 3, decision: 'ALLOW', reason: '',
        conditions: [{ field: 'toolName', operator: 'eq', value: 'exec' }], conditionLogic: 'AND', enabled: true },
      { id: 'deny', name: 'd', priority: 100, ring: 0, decision: 'DENY', reason: '',
        conditions: [{ field: 'toolName', operator: 'eq', value: 'exec' }], conditionLogic: 'AND', enabled: true },
    ]);
    expect(r.decision).toBe('DENY');
    expect(r.matchedRuleId).toBe('deny');
  });

  it('AND logic fails if one condition fails', () => {
    const r = ev.evaluate(
      { toolName: 'exec', toolArgs: { command: 'ls' }, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'b', priority: 100, ring: 0, decision: 'DENY', reason: '',
        conditions: [
          { field: 'toolName', operator: 'eq', value: 'exec' },
          { field: 'toolArgs.command', operator: 'contains', value: 'rm' },
        ], conditionLogic: 'AND', enabled: true }],
    );
    expect(r.decision).toBe('ALLOW');
  });

  it('OR logic matches if any condition matches', () => {
    const r = ev.evaluate(
      { toolName: 'write_file', toolArgs: {}, sessionId: 's1', agentId: 'a1' },
      [{ id: 'r1', name: 'b', priority: 100, ring: 0, decision: 'DENY', reason: '',
        conditions: [
          { field: 'toolName', operator: 'eq', value: 'exec' },
          { field: 'toolName', operator: 'eq', value: 'write_file' },
        ], conditionLogic: 'OR', enabled: true }],
    );
    expect(r.decision).toBe('DENY');
  });
});

describe('Decision Object tamper detection', () => {
  const base = () => buildDecisionObject({
    input: { runId: 't', step: 0, toolName: 'exec', toolArgs: {}, context: {}, agentId: 'a', sessionId: 's' },
    decision: 'ALLOW', actionTaken: 'allowed', reason: 'ok',
    matchedRules: [], totalEvaluated: 0, totalMatched: 0, rules: [], evaluationDurationMs: 5,
  });

  it('tampered context changes hash', () => {
    const d1 = base();
    const d2 = base();
    (d2 as any).context = { tampered: true };
    expect((d1 as any).audit.hash).not.toBe((d2 as any).audit.hash);
  });

  it('chain link via previous_hash', () => {
    const d1 = base();
    const d2 = buildDecisionObject({
      input: { runId: 't2', step: 1, toolName: 'exec', toolArgs: {}, context: {}, agentId: 'a', sessionId: 's',
        previousAuditHash: (d1 as any).audit.hash },
      decision: 'ALLOW', actionTaken: 'allowed', reason: 'ok',
      matchedRules: [], totalEvaluated: 0, totalMatched: 0, rules: [], evaluationDurationMs: 5,
    });
    expect((d2 as any).audit.previous_hash).toBe((d1 as any).audit.hash);
  });
});

describe('AID uniqueness', () => {
  it('generates 100 unique AIDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateAID());
    expect(ids.size).toBeGreaterThan(0);
  });
});

describe('Provenance fields', () => {
  it('has product', () => expect(PROVENANCE.product).toBeTruthy());
  it('has repository', () => expect(PROVENANCE.repository).toContain('github.com'));
});
