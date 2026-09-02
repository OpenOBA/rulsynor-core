/**
 * Rule Quality Gate — Unit Tests for SPEC v1.1 §11.5
 *
 * @file rule-quality-gate.spec.ts
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-21
 */

import { RuleQualityGate } from '../../src/engine/rule-quality-gate.js';
import type { RuleDefinition } from '../../src/engine/rule-definition.js';

const gate = new RuleQualityGate();

function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'SEC-001-test',
    name: 'SEC-001-test',
    description: 'Test rule',
    category: 'security',
    conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
    conditionLogic: 'AND',
    action: {
      decision: 'DENY',
      reason: 'Test block',
      ring: 0,
    },
    priority: 100,
    enabled: true,
    version: 1,
    ...overrides,
  };
}

describe('RuleQualityGate', () => {
  describe('§11.5 quality gate — happy path', () => {
    it('空规则列表应全部通过', () => {
      const report = gate.check([]);
      expect(report.total).toBe(0);
      expect(report.passed).toBe(0);
      expect(report.errors).toBe(0);
      expect(report.warnings).toBe(0);
    });

    it('标准规则应全部通过', () => {
      const rules = [makeRule()];
      const report = gate.check(rules);
      expect(report.passed).toBe(1);
      expect(report.errors).toBe(0);
      expect(report.warnings).toBe(0);
    });

    it('多个合法规则应全部通过', () => {
      const rules = [
        makeRule({ id: 'r1', name: 'SEC-001-a' }),
        makeRule({ id: 'r2', name: 'ENG-002-b', category: 'engineering' }),
      ];
      const report = gate.check(rules);
      expect(report.passed).toBe(2);
      expect(report.total).toBe(2);
    });
  });

  describe('§3.2.3 blocking message on quality gate', () => {
    it('DENY 无 message → warning (SPEC §11.5: empty-message-on-blocking-rule downgraded to warning)', () => {
      const rules = [
        makeRule({
          action: { decision: 'DENY', reason: '', ring: 0 },
        }),
      ];
      const report = gate.check(rules);
      expect(report.errors).toBe(0);
      expect(report.warnings).toBe(1);
      expect(report.passed).toBe(0);
    });

    it('DENY 有 message → pass', () => {
      const rules = [
        makeRule({
          action: { decision: 'DENY', reason: 'Security violation', ring: 0 },
        }),
      ];
      const report = gate.check(rules);
      expect(report.passed).toBe(1);
      expect(report.errors).toBe(0);
    });

    it('ALLOW 无 message → pass', () => {
      const rules = [
        makeRule({
          action: { decision: 'ALLOW', reason: '' },
        }),
      ];
      const report = gate.check(rules);
      expect(report.passed).toBe(1);
    });
  });

  describe('§3.2.4 naming convention on quality gate', () => {
    it('test- 前缀 → error（命名门禁拦截）', () => {
      const rules = [makeRule({ id: 'test-rule', name: 'test-rule' })];
      const report = gate.check(rules);
      expect(report.errors).toBe(1);
      expect(report.passed).toBe(0);
    });

    it('old- 前缀 → error（命名门禁拦截）', () => {
      const rules = [makeRule({ id: 'old-rule', name: 'old-rule' })];
      const report = gate.check(rules);
      expect(report.errors).toBe(1);
    });
  });

  describe('§16 no-tool-constraint gate', () => {
    it('tool.args rule without tool.name → warning', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'tool.args.command', operator: 'match', value: 'chmod.*777' }],
        }),
      ];
      const report = gate.check(rules);
      expect(report.errors).toBe(0);
      expect(report.warnings).toBe(1);
      expect(report.details[0].issues.some(i => i.code === 'NO_TOOL_CONSTRAINT')).toBe(true);
    });

    it('context-only rule (no tool.* field) → no warning (exempt)', () => {
      const rules = [
        makeRule({
          conditions: [{ field: 'context.event_type', operator: 'eq', value: 'credential_leak' }],
        }),
      ];
      const report = gate.check(rules);
      expect(report.errors).toBe(0);
      expect(report.warnings).toBe(0);
    });

    it('rule with tool.name → no warning', () => {
      const rules = [makeRule()];
      const report = gate.check(rules);
      expect(report.warnings).toBe(0);
    });
  });

  describe('§3.2.1 when completeness on quality gate', () => {
    it('when:true + DENY → error', () => {
      const rule = makeRule({
        id: 'wild-when',
        name: 'wild-when',
      });
      rule.conditions = [];
      // Inject raw when via any cast (RuleDefinition doesn't have when field)
      (rule as unknown as Record<string, unknown>).when = 'true';
      const report = gate.check([rule]);
      expect(report.errors).toBe(1);
    });
  });

  describe('mixed report', () => {
    it('error + warning 混合应正确计数', () => {
      const rules = [
        // Warning: DENY + empty message（empty-message-on-blocking-rule 为 warning）
        makeRule({
          id: 'err-rule',
          name: 'SEC-001-broken-deny',
          action: { decision: 'DENY', reason: '', ring: 0 },
        }),
        // Error: test-warn 非规范命名（命名门禁拦截）
        makeRule({
          id: 'warn-rule',
          name: 'test-warn',
          action: { decision: 'ALLOW', reason: 'ok' },
        }),
        // OK — name passes all naming checks
        makeRule({
          id: 'ok-rule',
          name: 'SEC-003-ok-rule',
          action: { decision: 'ALLOW', reason: 'ok' },
        }),
      ];
      const report = gate.check(rules);
      expect(report.total).toBe(3);
      expect(report.passed).toBe(1);
      // test-warn 命名不规范 → error
      expect(report.errors).toBe(1);
      // SEC-001-broken-deny empty message → warning
      expect(report.warnings).toBe(1);
      expect(report.details).toHaveLength(2);
    });
  });
});
