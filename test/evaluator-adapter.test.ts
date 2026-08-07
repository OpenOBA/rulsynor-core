/**
 * EvaluatorAdapter unit tests
 */
import { EvaluatorAdapter, toCoreRule, toCoreContext, toLegacyResult } from '../src/engine/evaluator-adapter.js';
import type { LegacyRuleInput } from '../src/engine/evaluator-adapter.js';
import { Evaluator } from '../src/engine/evaluator.js';
import { GuardStateManager } from '../src/engine/guard-state-manager.js';

describe('EvaluatorAdapter', () => {
  let adapter: EvaluatorAdapter;

  beforeEach(() => {
    adapter = new EvaluatorAdapter();
  });

  it('creates with internal engine', () => {
    expect(adapter).toBeDefined();
  });

  it('evaluate delegates to engine', () => {
    const result = adapter.evaluate(
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: 'blocked',
         conditions: [{ field: 'toolName', operator: 'eq', value: 'exec' }], conditionLogic: 'AND', enabled: true }],
      { toolName: 'exec', toolArgs: {}, sessionId: 's1', agentId: 'a1' },
    );
    expect(result.decision).toBe('DENY');
    expect(result.matchedRuleId).toBe('r1');
  });

  it('default ALLOW when no rules match', () => {
    const result = adapter.evaluate(
      [{ id: 'r1', name: 'test', priority: 100, ring: 0, decision: 'DENY', reason: 'nope',
         conditions: [{ field: 'toolName', operator: 'eq', value: 'write' }], conditionLogic: 'AND', enabled: true }],
      { toolName: 'exec', toolArgs: {}, sessionId: 's1', agentId: 'a1' },
    );
    expect(result.decision).toBe('ALLOW');
  });
});

describe('toCoreRule', () => {
  it('converts legacy rule to core CompiledRule', () => {
    const legacy: LegacyRuleInput = {
      id: 'rule-1',
      name: 'Test Rule',
      priority: 50,
      conditions: [
        { field: 'toolName', operator: 'eq', value: 'exec' },
        { field: 'toolArgs.cmd', operator: 'contains', value: 'rm' },
      ],
      conditionLogic: 'AND',
      action: { decision: 'DENY', reason: 'Blocked', instruction: 'Do not', ring: 2 },
      enabled: true,
    };
    const core = toCoreRule(legacy);
    expect(core.id).toBe('rule-1');
    expect(core.name).toBe('Test Rule');
    expect(core.priority).toBe(50);
    expect(core.ring).toBe(2);
    expect(core.decision).toBe('DENY');
    expect(core.reason).toBe('Blocked');
    expect(core.conditions).toHaveLength(2);
    expect(core.conditionLogic).toBe('AND');
    expect(core.enabled).toBe(true);
  });

  it('filters out conditions without field', () => {
    const legacy: LegacyRuleInput = {
      id: 'r1', name: 'test', priority: 1,
      conditions: [
        { field: 'toolName', operator: 'eq', value: 'exec' },
        { operator: 'eq', value: 'x' },  // no field
      ],
      conditionLogic: 'AND',
      action: { decision: 'ALLOW', reason: 'ok' },
      enabled: true,
    };
    const core = toCoreRule(legacy);
    expect(core.conditions).toHaveLength(1);
  });

  it('defaults ring to 3 when missing', () => {
    const legacy: LegacyRuleInput = {
      id: 'r1', name: 'test', priority: 1,
      conditions: [],
      conditionLogic: 'AND',
      action: { decision: 'ALLOW' },
      enabled: true,
    };
    const core = toCoreRule(legacy);
    expect(core.ring).toBe(3);
  });
});

describe('toCoreContext', () => {
  it('flattens context fields for dot-notation resolution', () => {
    const ctx = toCoreContext({
      toolName: 'exec',
      toolArgs: { command: 'ls', path: '/tmp' },
      context: { maintenance_mode: true, user: { id: 'u1', role: 'admin' } },
      sessionId: 's1',
      agentId: 'a1',
    });
    expect(ctx.toolName).toBe('exec');
    expect(ctx['tool.name']).toBe('exec');
    expect(ctx['tool.args.command']).toBe('ls');
    expect(ctx['tool.args.path']).toBe('/tmp');
    expect(ctx.maintenance_mode).toBe(true);
    expect(ctx['user.id']).toBe('u1');
    expect(ctx['user.role']).toBe('admin');
  });

  it('handles empty context gracefully', () => {
    const ctx = toCoreContext({
      toolName: 'read',
      toolArgs: {},
      context: {},
      sessionId: 's1',
      agentId: 'a1',
    });
    expect(ctx.toolName).toBe('read');
    expect(Object.keys(ctx).length).toBeGreaterThanOrEqual(3); // toolName, sessionId, agentId
  });
});

describe('toLegacyResult', () => {
  it('converts matched EvalResult to legacy format', () => {
    const result = toLegacyResult({
      decision: 'DENY',
      reason: 'Blocked dangerous command',
      matchedRuleId: 'rule-1',
      matchedRuleName: 'Test Rule',
      severity: 'HIGH',
      ring: 0,
    }, 28);
    expect(result.decision).toBe('DENY');
    expect(result.matchedRules).toHaveLength(1);
    expect(result.matchedRules[0].ruleId).toBe('rule-1');
    expect(result.matchedRules[0].ruleName).toBe('Test Rule');
    expect(result.primaryReason).toBe('Blocked dangerous command');
    expect(result.totalEvaluated).toBe(28);
    expect(result.totalMatched).toBe(1);
  });

  it('converts unmatched EvalResult to legacy format', () => {
    const result = toLegacyResult({
      decision: 'ALLOW',
      reason: 'No rules matched — default ALLOW',
    }, 28);
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedRules).toHaveLength(0);
    expect(result.totalMatched).toBe(0);
  });

  it('handles missing fields gracefully', () => {
    const result = toLegacyResult({
      decision: 'ALLOW',
      reason: 'ok',
      matchedRuleId: 'r1',
      matchedRuleName: undefined as unknown as string,
    }, 0);
    expect(result.matchedRules[0].ruleName).toBe('');
    expect(result.totalEvaluated).toBe(0);
  });
});
