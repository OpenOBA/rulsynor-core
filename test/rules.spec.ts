/**
 * rules.test.ts — Preset rules loader unit tests
 *
 * The presets are authored in the CANONICAL ERDL document format (language spec
 * v2.0 §2.1: protocol/version/metadata/rules[] + string `then`). These tests pin
 * that: 3 canonical documents expanding to 34 compiled rules.
 */
import {
  loadPresetRules,
  toCompiledRules,
  toRuleDefinitions,
  toERDLRuleSet,
  isCanonicalDocument,
  getFallbackDecision,
} from '../src/rules/index.js';
import { ruleQualityGate } from '../src/engine/rule-quality-gate.js';

describe('loadPresetRules (canonical document format)', () => {
  it('loads 3 canonical documents (security / compliance / integrity)', () => {
    const rules = loadPresetRules();
    expect(rules).toHaveLength(3);
    expect(rules.map(r => r.name).sort()).toEqual(['compliance', 'integrity', 'security']);
  });

  it('every preset is a canonical document (protocol erdl/v2 + rules[])', () => {
    for (const r of loadPresetRules()) {
      expect(isCanonicalDocument(r.parsed)).toBe(true);
      expect(r.parsed.protocol).toBe('erdl/v2');
      expect(r.parsed.version).toBe('2.0.0');
      expect(Array.isArray(r.parsed.rules)).toBe(true);
    }
  });

  it('cache returns same instance', () => {
    const a = loadPresetRules();
    const b = loadPresetRules();
    expect(a).toBe(b);
  });

  it('all 34 rules live across the 3 documents', () => {
    const total = loadPresetRules().reduce(
      (sum, r) => sum + (r.parsed.rules as unknown[]).length,
      0,
    );
    expect(total).toBe(34);
  });
});

describe('toCompiledRules', () => {
  const rules = toCompiledRules(loadPresetRules());

  it('returns 34 compiled rules', () => {
    expect(rules).toHaveLength(34);
  });

  it('every compiled rule has required RuleDefinition fields', () => {
    for (const c of rules) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.priority).toBe('number');
      expect(typeof (c.action.ring ?? 0)).toBe('number');
      expect(c.action.ring ?? 0).toBeGreaterThanOrEqual(0);
      expect(c.action.ring ?? 0).toBeLessThanOrEqual(3);
      expect(typeof c.action.decision).toBe('string');
      // Blocking rules carry a reason (message); ALLOW rules carry an instruction.
      expect(
        typeof c.action.reason === 'string' || typeof c.action.instruction === 'string',
      ).toBe(true);
      expect(typeof c.conditionLogic).toBe('string');
      expect(c.conditionLogic).toMatch(/^AND|OR$/);
      expect(c.enabled).toBe(true);
    }
  });

  it('every rule has at least one condition', () => {
    for (const c of rules) {
      expect(c.conditions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all conditions have valid operators', () => {
    const validOps = new Set([
      'eq',
      'neq',
      'ne',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'not_in',
      'contains',
      'not_contains',
      'match',
      'matches',
      'starts_with',
      'ends_with',
      'exists',
      'not_exists',
      'length_gt',
      'length_gte',
      'length_lt',
      'length_lte',
      'length_eq',
    ]);
    for (const c of rules) {
      for (const cond of c.conditions) {
        expect(validOps.has(cond.operator ?? '')).toBe(true);
      }
    }
  });

  it('rings are within 0-3', () => {
    for (const c of rules) {
      expect(c.action.ring ?? 0).toBeGreaterThanOrEqual(0);
      expect(c.action.ring ?? 0).toBeLessThanOrEqual(3);
    }
  });

  it('integrity rule correctly mapped', () => {
    const integrity = rules.find(c => c.name.startsWith('ETH-'));
    expect(integrity).toBeDefined();
    expect(integrity!.action.decision).toBe('REQUEST_HUMAN');
    expect(integrity!.action.ring).toBe(0);
  });

  it('preset rules pass quality gate with 0 errors and 0 warnings', () => {
    const report = ruleQualityGate.check(rules);
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(0);
  });
});

describe('getFallbackDecision', () => {
  it('all three preset documents agree on ALLOW fallback', () => {
    expect(getFallbackDecision(loadPresetRules())).toBe('ALLOW');
  });
});

describe('legacy flat-format helpers (backward compatibility)', () => {
  // The legacy flat format (one rule per YAML doc, `then` object) is deprecated but
  // still accepted for pre-spec user rules. These helpers must keep working on it.
  const legacy = [
    {
      name: 'x.erdl.yaml#SEC-900',
      content: '',
      parsed: {
        name: 'SEC-900-legacy',
        category: 'security',
        when: { conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }] },
        then: { decision: 'DENY', instruction: 'blocked' },
      },
    },
  ];

  it('toRuleDefinitions maps a legacy flat rule', () => {
    const defs = toRuleDefinitions(legacy);
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('SEC-900-legacy');
    expect(defs[0].when).toBeDefined();
    expect(defs[0].then).toBeDefined();
  });

  it('toERDLRuleSet maps a legacy flat rule', () => {
    const set = toERDLRuleSet(legacy);
    expect(set.protocol).toBe('erdl/v2');
    expect(set.rules).toHaveLength(1);
    expect(set.rules[0].id).toBe('SEC-900-legacy');
  });

  it('toCompiledRules maps a legacy flat rule through the legacy path', () => {
    const compiled = toCompiledRules(legacy);
    expect(compiled).toHaveLength(1);
    expect(compiled[0].action.decision).toBe('DENY');
    expect(compiled[0].action.reason).toBe('blocked');
  });
});

describe('quality gate fail-close (SPEC v2.0 §16 加载期 MUST)', () => {
  const makeRule = (parsed: Record<string, unknown>) => ({ name: 'bad#x', content: '', parsed });

  it('rejects security rule with empty conditions (error-level)', () => {
    const bad = makeRule({
      name: 'SEC-999-no-cond',
      category: 'security',
      when: { conditions: [] },
      then: { decision: 'DENY' },
    });
    expect(() => toCompiledRules([bad])).toThrow(/rejected load/);
  });

  it('rejects kebab-case rule name (non-§16 naming)', () => {
    const bad = makeRule({
      name: 'block-bad',
      category: 'security',
      when: { conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }] },
      then: { decision: 'DENY' },
    });
    expect(() => toCompiledRules([bad])).toThrow(/rejected load/);
  });
});
