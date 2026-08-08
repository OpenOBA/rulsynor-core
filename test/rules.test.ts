/**
 * rules.test.ts — Preset rules loader unit tests
 */
import { loadPresetRules, toCompiledRules, toRuleDefinitions, toERDLRuleSet } from '../src/rules/index.js';

describe('loadPresetRules', () => {
  it('loads all 30 preset rules', () => {
    const rules = loadPresetRules();
    expect(rules).toHaveLength(30);
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
    // 20 from security.erdl.yaml + 1 from compliance.erdl.yaml (halt-credential-leak is security)
    expect(securityRules.length).toBeGreaterThanOrEqual(20);
  });

  it('non-security rules exist', () => {
    const rules = loadPresetRules();
    const nonSecurityRules = rules.filter(r => r.parsed.category !== 'security');
    expect(nonSecurityRules.length).toBeGreaterThan(0);
  });

  it('integrity rule exists', () => {
    const rules = loadPresetRules();
    const integrity = rules.find(r => r.parsed.category === 'integrity');
    expect(integrity).toBeDefined();
    expect(integrity!.parsed.then).toBeDefined();
  });
});

describe('toCompiledRules', () => {
  const rules = toCompiledRules(loadPresetRules());

  it('returns 30 compiled rules', () => {
    expect(rules).toHaveLength(30);
  });

  it('every compiled rule has required CompiledRule fields', () => {
    for (const c of rules) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.priority).toBe('number');
      expect(typeof c.ring).toBe('number');
      expect(c.ring).toBeGreaterThanOrEqual(0);
      expect(c.ring).toBeLessThanOrEqual(3);
      expect(typeof c.decision).toBe('string');
      expect(typeof c.reason).toBe('string');
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
      'eq','neq','ne','gt','gte','lt','lte','in','not_in',
      'contains','not_contains','match','matches',
      'starts_with','ends_with','exists','not_exists',
      'length_gt','length_gte','length_lt','length_lte','length_eq',
    ]);
    for (const c of rules) {
      for (const cond of c.conditions) {
        expect(validOps.has(cond.operator)).toBe(true);
      }
    }
  });

  it('rings are within 0-3', () => {
    for (const c of rules) {
      expect(c.ring).toBeGreaterThanOrEqual(0);
      expect(c.ring).toBeLessThanOrEqual(3);
    }
  });

  it('integrity rule correctly mapped', () => {
    const integrity = rules.find(c => c.id.startsWith('INT-'));
    expect(integrity).toBeDefined();
    expect(integrity!.decision).toBe('REQUEST_HUMAN');
    expect(integrity!.ring).toBe(0);
  });
});

describe('toRuleDefinitions', () => {
  it('returns 30 definitions', () => {
    expect(toRuleDefinitions(loadPresetRules())).toHaveLength(30);
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
    expect(set.protocol).toBe('erdl-v1');
    expect(set.version).toBe('1.0');
    expect(set.metadata.source).toBe('rulsynor-core-preset');
  });

  it('has 30 rules', () => {
    expect(set.rules).toHaveLength(30);
  });

  it('every rule has id and then', () => {
    for (const r of set.rules) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.then).toBe('string');
    }
  });
});
