/**
 * Rule Validator — Unit Tests for SPEC v1.1 validations
 *
 * @file rule-validator.spec.ts
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-21
 */

import { RuleValidator } from '../../src/engine/rule-validator.js';
import type { TemplateInput } from '../../src/engine/template-engine.js';

const validator = new RuleValidator();

function makeInput(overrides: Partial<TemplateInput> = {}): TemplateInput {
  return {
    templateId: 'fieldCompare',
    ruleName: 'SEC-001-test-rule',
    decision: 'ALLOW',
    message: 'Test message',
    priority: 100,
    category: 'security',
    params: {
      field: 'tool.name',
      operator: 'eq',
      value: 'exec',
    },
    ...overrides,
  };
}

// ─── validate() baseline ──────────────────────────

describe('RuleValidator', () => {
  describe('validate() — baseline checks', () => {
    it('有效输入应通过', () => {
      const result = validator.validate(makeInput());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('无效 decision 应报错', () => {
      const result = validator.validate(makeInput({ decision: 'INVALID' as any }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'decision')).toBe(true);
    });

    it('无效 category 应报错', () => {
      const result = validator.validate(makeInput({ category: 'bogus' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'category')).toBe(true);
    });

    it('空 message 应报错', () => {
      const result = validator.validate(makeInput({ message: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'message')).toBe(true);
    });

    it('message 只有空格应报错', () => {
      const result = validator.validate(makeInput({ message: '   ' }));
      expect(result.valid).toBe(false);
    });
  });

  // ─── SPEC v1.1 §3.2.1: when completeness ──────────

  describe('§3.2.1 when completeness (WILD_WHEN_WITH_BLOCKING_THEN)', () => {
    it('DENY + when:true 不应通过', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'DENY',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'WILD_WHEN_WITH_BLOCKING_THEN')).toBe(true);
    });

    it('DENY + 结构化模板（无 when key）应通过 — 模板自己生成条件', () => {
      const result = validator.validate(
        makeInput({
          decision: 'DENY',
          params: { field: 'tool.name', operator: 'eq', value: 'exec' },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('ALLOW + when:true 应通过（非阻塞决策允许宽松 when）', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'ALLOW',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('CORRECT + when:true 不应通过', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'CORRECT',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('REQUEST_HUMAN + when:true 不应通过', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'REQUEST_HUMAN',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('EMERGENCY_HALT + when:true 不应通过', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'EMERGENCY_HALT',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('DENY + 精确 when 条件应通过', () => {
      const result = validator.validate(
        makeInput({
          decision: 'DENY',
          params: { field: 'tool.name', operator: 'eq', value: 'exec' },
        }),
      );
      expect(result.valid).toBe(true);
    });
  });

  // ─── SPEC v1.1 §3.2.3: blocking message mandatory ──

  describe('§3.2.3 blocking message mandatory (EMPTY_MESSAGE_ON_BLOCKING_RULE)', () => {
    it('DENY + 空 message → error', () => {
      const err = validator.checkBlockingMessageEmpty('DENY', '');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('EMPTY_MESSAGE_ON_BLOCKING_RULE');
    });

    it('DENY + 正常 message → null', () => {
      const err = validator.checkBlockingMessageEmpty('DENY', '这个操作需要管理员权限');
      expect(err).toBeNull();
    });

    it('ALLOW + 空 message → null（非阻塞可以不填）', () => {
      const err = validator.checkBlockingMessageEmpty('ALLOW', '');
      expect(err).toBeNull();
    });

    it('CORRECT + 空 message → error', () => {
      const err = validator.checkBlockingMessageEmpty('CORRECT', '');
      expect(err).not.toBeNull();
    });

    it('REQUEST_HUMAN + 空格 message → error', () => {
      const err = validator.checkBlockingMessageEmpty('REQUEST_HUMAN', '   ');
      expect(err).not.toBeNull();
    });

    it('EMERGENCY_HALT + 正常 message → null', () => {
      const err = validator.checkBlockingMessageEmpty('EMERGENCY_HALT', '系统受到攻击，已自动封锁');
      expect(err).toBeNull();
    });
  });

  // ─── SPEC v1.1 §3.2.4: naming conventions ────────

  describe('§3.2.4 naming conventions (NON_STANDARD_NAME)', () => {
    it('test- 前缀应 error（命名门禁拦截）', () => {
      const result = validator.validate(makeInput({ ruleName: 'test-my-rule' }));
      expect(result.valid).toBe(false); // 命名门禁 error → invalid
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
      const err = result.errors.find(e => e.code === 'NON_STANDARD_NAME');
      expect(err?.level).toBe('error');
    });

    it('old- 前缀应 error', () => {
      const result = validator.validate(makeInput({ ruleName: 'old-rule' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
      expect(result.errors.find(e => e.code === 'NON_STANDARD_NAME')?.level).toBe('error');
    });

    it('temp- 前缀应 error', () => {
      const result = validator.validate(makeInput({ ruleName: 'temp-check' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
    });

    it('debug- 前缀应 error', () => {
      const result = validator.validate(makeInput({ ruleName: 'debug-test' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
    });

    it('wip- 前缀应 error', () => {
      const result = validator.validate(makeInput({ ruleName: 'wip-feature' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
    });

    it('tmp- 前缀应 error', () => {
      const result = validator.validate(makeInput({ ruleName: 'tmp-backup' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
    });

    it('标准命名 SEC-001-xxx 应通过', () => {
      const result = validator.validate(makeInput({ ruleName: 'SEC-001-code-safety' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(false);
    });

    it('污染命名 PY-BIZ-001-xxx 应被拦截（非法前缀）', () => {
      const result = validator.validate(makeInput({ ruleName: 'PY-BIZ-001-vector' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME_FULL')).toBe(true);
      expect(result.errors.find(e => e.code === 'NON_STANDARD_NAME_FULL')?.level).toBe('error');
    });

    it('大小写不敏感: TEST-Rule 也应被拦截', () => {
      const result = validator.validate(makeInput({ ruleName: 'TEST-Rule' }));
      expect(result.errors.some(e => e.code === 'NON_STANDARD_NAME')).toBe(true);
    });
  });

  // ─── SPEC v1.1 §3.4.1: decision consistency ──────

  describe('§3.4.1 decision consistency (DECISION_MISMATCH)', () => {
    it('metadata=DENY, then=ALLOW → warning', () => {
      const err = validator.checkDecisionConsistency('DENY', 'ALLOW');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('DECISION_MISMATCH');
      expect(err!.level).toBe('warning');
    });

    it('metadata=ALLOW, then=ALLOW → null', () => {
      const err = validator.checkDecisionConsistency('ALLOW', 'ALLOW');
      expect(err).toBeNull();
    });

    it('metadata=DENY, then=DENY → null', () => {
      const err = validator.checkDecisionConsistency('DENY', 'DENY');
      expect(err).toBeNull();
    });

    it('then 为 undefined → null', () => {
      const err = validator.checkDecisionConsistency('ALLOW', undefined);
      expect(err).toBeNull();
    });
  });

  // ─── validateWhenCompleteness() public method ────

  describe('validateWhenCompleteness() — public API for external callers', () => {
    it('when:true + DENY → invalid', () => {
      const result = validator.validateWhenCompleteness({ when: 'true' }, 'DENY');
      expect(result.valid).toBe(false);
    });

    it('when:name="exec" + DENY → valid', () => {
      const result = validator.validateWhenCompleteness({ when: 'field = "exec"' }, 'DENY');
      expect(result.valid).toBe(true);
    });

    it('when:undefined + DENY → valid（只检测显式 when:true）', () => {
      const result = validator.validateWhenCompleteness({ when: undefined }, 'DENY');
      expect(result.valid).toBe(true);
    });
  });

  // ─── level field in validation errors ────────────

  describe('error level field', () => {
    it('错误级别错误应包括 level=error', () => {
      const result = validator.validate(
        makeInput({
          templateId: 'toolEq',
          decision: 'DENY',
          params: { toolName: 'exec', when: 'true' },
        }),
      );
      const err = result.errors.find(e => e.code === 'WILD_WHEN_WITH_BLOCKING_THEN');
      expect(err?.level).toBe('error');
    });

    it('非规范命名应包括 level=error（命名门禁）', () => {
      const result = validator.validate(makeInput({ ruleName: 'test-rule' }));
      const err = result.errors.find(e => e.code === 'NON_STANDARD_NAME');
      expect(err?.level).toBe('error');
    });
  });
});
// ─── ADR-003：规则名前缀注册制门禁（真执行）────────────────

describe('checkNamingConventionFull — ADR-003 前缀注册制门禁', () => {
  function makeRule(name: string) {
    return {
      id: 'r1',
      name,
      description: 'fixture',
      category: 'security' as const,
      conditions: [{ field: 'tool.name', operator: 'eq' as const, value: 'exec' }],
      action: { decision: 'ALLOW' as const },
      priority: 100,
      enabled: true,
    };
  }

  it('已登记前缀 + 合法格式 → 通过', () => {
    expect(validator.checkNamingConventionFull(makeRule('SEC-001-code-safety'))).toBeNull();
  });

  it('SBP 前缀（水土保持 106 条存量）→ 通过（ADR-003 补登记后不得被拒载）', () => {
    expect(validator.checkNamingConventionFull(makeRule('SBP-101-scope-check'))).toBeNull();
  });

  it('未登记前缀 → error（历史实现此处放行，白名单形同虚设，ADR-003 修正）', () => {
    const r = validator.checkNamingConventionFull(makeRule('XYZ-999-foo-bar'));
    expect(r).not.toBeNull();
    expect(r?.code).toBe('NON_STANDARD_NAME_FULL');
    expect(r?.level).toBe('error');
    expect(r?.message).toContain('未登记');
  });

  it('前缀已登记但格式非法（编号位数/描述大写）→ error', () => {
    expect(validator.checkNamingConventionFull(makeRule('SEC-1-Foo'))?.code).toBe(
      'NON_STANDARD_NAME_FULL',
    );
  });

  it('前缀表每个键都能通过格式校验（登记表自身自洽）', () => {
    for (const p of [
      'SEC',
      'COD',
      'ENG',
      'PRF',
      'TST',
      'WRT',
      'OBS',
      'CUS',
      'ETH',
      'CMP',
      'POL',
      'OCC',
      'CNV',
      'SBP',
    ]) {
      expect(validator.checkNamingConventionFull(makeRule(`${p}-100-sample-rule`))).toBeNull();
    }
  });
});
