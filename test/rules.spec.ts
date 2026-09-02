/**
 * rules.test.ts — Preset rules loader unit tests
 */
import {
  loadPresetRules,
  toCompiledRules,
  toRuleDefinitions,
  toERDLRuleSet,
} from '../src/rules/index.js';
import { ruleQualityGate } from '../src/engine/rule-quality-gate.js';

describe('loadPresetRules', () => {
  it('loads all 34 preset rules', () => {
    const rules = loadPresetRules();
    expect(rules).toHaveLength(34);
  });

  it('cache returns same instance', () => {
    const a = loadPresetRules();
    const b = loadPresetRules();
    expect(a).toBe(b);
  });

  it('every rule has required fields', () => {
    for (const r of loadPresetRules()) {
      expect(typeof r.name).toBe('string');
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.parsed).toBeDefined();
      expect(typeof r.parsed.name).toBe('string');
    }
  });

  it('security rules exist (category=security)', () => {
    const rules = loadPresetRules();
    const securityRules = rules.filter(r => r.parsed.category === 'security');
    // 25 from security.erdl.yaml (SEC-009/SEC-019 split into per-tool rules)
    // + 3 from compliance.erdl.yaml (SEC-022/023/024) = 28 security rules
    expect(securityRules.length).toBe(28);
  });

  it('non-security rules exist', () => {
    const rules = loadPresetRules();
    const nonSecurityRules = rules.filter(r => r.parsed.category !== 'security');
    expect(nonSecurityRules.length).toBeGreaterThan(0);
  });

  it('integrity rule exists', () => {
    const rules = loadPresetRules();
    const integrity = rules.find(r => (r.parsed.name as string).startsWith('ETH-'));
    expect(integrity).toBeDefined();
    expect(integrity!.parsed.then).toBeDefined();
  });
});

describe('toCompiledRules', () => {
  const rules = toCompiledRules(loadPresetRules());

  it('returns 34 compiled rules', () => {
    expect(rules).toHaveLength(34);
  });

  it('every compiled rule has required CompiledRule fields', () => {
    for (const c of rules) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.priority).toBe('number');
      expect(typeof (c.action.ring ?? 0)).toBe('number');
      expect(c.action.ring ?? 0).toBeGreaterThanOrEqual(0);
      expect(c.action.ring ?? 0).toBeLessThanOrEqual(3);
      expect(typeof c.action.decision).toBe('string');
      expect(typeof c.action.reason).toBe('string');
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
    const integrity = rules.find(c => c.id.startsWith('ETH-'));
    expect(integrity).toBeDefined();
    expect(integrity!.action.decision).toBe('REQUEST_HUMAN');
    expect(integrity!.action.ring).toBe(0);
  });
});

describe('toRuleDefinitions', () => {
  it('returns 34 definitions', () => {
    expect(toRuleDefinitions(loadPresetRules())).toHaveLength(34);
  });

  it('each def has name, when, then, version', () => {
    for (const d of toRuleDefinitions(loadPresetRules())) {
      expect(typeof d.name).toBe('string');
      expect(d.when).toBeDefined();
      expect(d.then).toBeDefined();
      expect(d.version).toBe(1);
    }
  });
});

describe('toERDLRuleSet', () => {
  const set = toERDLRuleSet(loadPresetRules());

  it('has correct protocol and version', () => {
    expect(set.protocol).toBe('erdl/v2');
    expect(set.version).toBe('2.0.0');
    expect(set.metadata.source).toBe('rulsynor-core-preset');
  });

  it('has 34 rules', () => {
    expect(set.rules).toHaveLength(34);
  });

  it('every rule has id and then', () => {
    for (const r of set.rules) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.then).toBe('string');
    }
  });
  it('preset rules pass quality gate with 0 errors and 0 warnings', () => {
    const report = ruleQualityGate.check(toCompiledRules(loadPresetRules()));
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(0);
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
