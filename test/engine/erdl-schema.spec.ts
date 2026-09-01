/**
 * erdl-schema 一致性门禁 — 断言单一事实源与 SPEC v2.0 母本逐项一致
 *
 * 这些断言是"禁止悬空数字"铁律的可执行化：任何人改动 erdl-schema.ts 的枚举，
 * 若与 SPEC 母本口径不符，测试立刻红。数字全部逐项数出来，不写魔法值。
 *
 * @since 2026-08-28
 */
import {
  CONDITION_OPERATORS,
  CONDITION_MODIFIERS,
  ALL_OPERATORS,
  OP_COMPARE,
  OP_LIST,
  OP_STRING,
  OP_BOUNDARY_NEG,
  OP_EXISTENCE,
  OP_LENGTH,
  OP_RANGE,
  OP_COUNT,
  OP_COMPILE_DIRECT,
  OP_COMPILE_VIA_NOT,
  OP_COMPILE_VIA_LENGTH_COUNT,
  DO_DECISIONS,
  WORKFLOW_SUBSTATES,
  INTERNAL_REASONING,
  INTERNAL_STATES,
  RULSYNOR_EXTENSIONS,
  ALL_DECISIONS,
  SEMANTIC_NODES,
  SEMANTIC_NODE_NAMES,
  EXPR_NODE_TYPES,
  RULE_CATEGORIES,
  RULE_NAME_PREFIXES,
  OCCUPATION_CATEGORIES,
  SCHEMA_COUNTS,
  OPERATOR_ALIASES,
  normalizeOperatorName,
  isDODecision,
  isDecision,
  OP_VALUE_NONE,
  OP_VALUE_ARRAY,
  OP_VALUE_TUPLE,
  OP_VALUE_SCALAR,
  operatorValueShape,
} from '../../src/engine/erdl-schema.js';
import { NODE_TYPE_LABELS } from '../../src/engine/expr-tree/node-types.js';
import { CONDITION_OPERATORS as SIMPLE_FROM_COMPILER } from '../../src/engine/erdl-schema.js';
import { compileSimpleCondition } from '../../src/engine/expr-tree/simple-compiler.js';

describe('erdl-schema — 运算符（SPEC §11.1：28 条件 + 2 修饰符 = 30）', () => {
  it('九族逐族计数与 §11.1 表一致', () => {
    expect(OP_COMPARE.length).toBe(6);
    expect(OP_LIST.length).toBe(2);
    expect(OP_STRING.length).toBe(5);
    expect(OP_BOUNDARY_NEG.length).toBe(2);
    expect(OP_EXISTENCE.length).toBe(2);
    expect(OP_LENGTH.length).toBe(5);
    expect(OP_RANGE.length).toBe(2);
    expect(OP_COUNT.length).toBe(4);
    expect(CONDITION_MODIFIERS.length).toBe(2);
  });

  it('28 条件 + 2 修饰符 = 30，且无重复', () => {
    expect(CONDITION_OPERATORS.length).toBe(28);
    expect(ALL_OPERATORS.length).toBe(30);
    expect(new Set(ALL_OPERATORS).size).toBe(30);
  });

  it('修饰符不混入条件运算符（有状态算子不参与树编译）', () => {
    for (const m of CONDITION_MODIFIERS) {
      expect((CONDITION_OPERATORS as readonly string[]).includes(m)).toBe(false);
    }
  });

  it('§11.4 编译归宿无悬空：13 直接 + 6 not 派生 + 9 length/count = 28', () => {
    expect(OP_COMPILE_DIRECT.length).toBe(13);
    expect(OP_COMPILE_VIA_NOT.length).toBe(6);
    expect(OP_COMPILE_VIA_LENGTH_COUNT.length).toBe(9);
    const union = new Set<string>([
      ...OP_COMPILE_DIRECT,
      ...OP_COMPILE_VIA_NOT,
      ...OP_COMPILE_VIA_LENGTH_COUNT,
    ]);
    expect(union.size).toBe(28);
    expect([...union].sort()).toEqual([...CONDITION_OPERATORS].sort());
  });

  it('28 个条件运算符全部能被求值内核编译（真编译，非清单自证）', () => {
    for (const op of SIMPLE_FROM_COMPILER) {
      const value = op === 'between' || op === 'not_between' ? [1, 2] : 1;
      expect(() => compileSimpleCondition({ field: 'x', operator: op, value })).not.toThrow();
    }
  });

  it('别名归一后必落在 28 条件运算符内', () => {
    for (const [alias, target] of Object.entries(OPERATOR_ALIASES)) {
      expect(normalizeOperatorName(alias)).toBe(target);
      expect((CONDITION_OPERATORS as readonly string[]).includes(target)).toBe(true);
    }
    expect(normalizeOperatorName('no_such_op')).toBeNull();
    expect(normalizeOperatorName(undefined)).toBeNull();
  });
});

describe('erdl-schema — 决策（SPEC §27.5：13 种基础决策）', () => {
  it('13 种基础决策与 §27.5 权威枚举逐项一致', () => {
    expect([...DO_DECISIONS]).toEqual([
      'ALLOW',
      'DENY',
      'CORRECT',
      'NOTIFY',
      'REQUEST_HUMAN',
      'ESCALATE',
      'DELEGATE',
      'DEFER',
      'EMERGENCY_HALT',
      'ROLLBACK',
      'QUARANTINE',
      'WORKFLOW',
      'GUIDE',
    ]);
    expect(DO_DECISIONS.length).toBe(13);
  });

  it('GUIDE 是 §27.5 第 13 号官方决策（不得再标注为 rulsynor 扩展）', () => {
    expect((DO_DECISIONS as readonly string[]).includes('GUIDE')).toBe(true);
    expect((RULSYNOR_EXTENSIONS as readonly string[]).includes('GUIDE')).toBe(false);
  });

  it('WORKFLOW 子态不是独立决策类型，不计入 13', () => {
    for (const s of WORKFLOW_SUBSTATES) expect(isDODecision(s)).toBe(false);
  });

  it('内部推理 / 内部态 / 扩展一律不进 DO', () => {
    for (const d of [...INTERNAL_REASONING, ...INTERNAL_STATES, ...RULSYNOR_EXTENSIONS]) {
      expect(isDODecision(d)).toBe(false);
      expect(isDecision(d)).toBe(true);
    }
  });

  it('21 = 13 + 2 + 4 + 1 + 1，无重复', () => {
    expect(ALL_DECISIONS.length).toBe(
      DO_DECISIONS.length +
        WORKFLOW_SUBSTATES.length +
        INTERNAL_REASONING.length +
        INTERNAL_STATES.length +
        RULSYNOR_EXTENSIONS.length,
    );
    expect(new Set(ALL_DECISIONS).size).toBe(ALL_DECISIONS.length);
  });
});

describe('erdl-schema — 34 语义节点（SPEC §10.1，FREEZE-2）', () => {
  it('10 组逐组计数 = 3+3+6+1+4+3+3+5+5+1 = 34', () => {
    const counts = Object.values(SEMANTIC_NODES).map(g => g.length);
    expect(counts).toEqual([3, 3, 6, 1, 4, 3, 3, 5, 5, 1]);
    expect(SEMANTIC_NODE_NAMES.length).toBe(34);
    expect(new Set(SEMANTIC_NODE_NAMES).size).toBe(34);
  });

  it('20 个判别式 type 与 node-types.ts 实现逐项一致（语义节点 ↔ 类型投影）', () => {
    expect(EXPR_NODE_TYPES.length).toBe(20);
    expect([...EXPR_NODE_TYPES].sort()).toEqual(Object.keys(NODE_TYPE_LABELS).sort());
  });

  it('参数化合并关系自证：34 语义节点 - 20 type = 14 个被参数化承载', () => {
    // compare 6→1, string 4→1, arith 5→1, quantifier 3→1, aggregate 1→1（fn 参数化）
    const merged = 6 - 1 + (4 - 1) + (5 - 1) + (3 - 1);
    expect(SEMANTIC_NODE_NAMES.length - EXPR_NODE_TYPES.length).toBe(merged);
  });
});

describe('erdl-schema — 分类与命名前缀治理（ADR-001 / ADR-003 / ADR-004）', () => {
  it('ADR-001：规则分类 11 类，含 observability', () => {
    expect(RULE_CATEGORIES.length).toBe(11);
    expect((RULE_CATEGORIES as readonly string[]).includes('observability')).toBe(true);
    expect(new Set(RULE_CATEGORIES).size).toBe(11);
  });

  it('ADR-003：前缀登记表含存量在用的全部 10 个前缀（含 SBP 106 条）', () => {
    const inUse = ['SBP', 'CMP', 'SEC', 'ENG', 'CUS', 'COD', 'CNV', 'TST', 'WRT', 'OBS'];
    for (const p of inUse) {
      expect(Object.keys(RULE_NAME_PREFIXES)).toContain(p);
    }
  });

  it('ADR-003：每个前缀的归属分类 MUST 在 11 类内（禁止映到不存在的分类）', () => {
    for (const [prefix, cat] of Object.entries(RULE_NAME_PREFIXES)) {
      expect((RULE_CATEGORIES as readonly string[]).includes(cat)).toBe(true);
      expect(prefix).toMatch(/^[A-Z]{2,4}/);
    }
  });

  it('ADR-004：岗位分类是独立枚举，当前登记 review', () => {
    expect((OCCUPATION_CATEGORIES as readonly string[]).includes('review')).toBe(true);
    // 岗位分类与规则分类是两个域，不得混用
    for (const c of OCCUPATION_CATEGORIES) {
      expect((RULE_CATEGORIES as readonly string[]).includes(c)).toBe(false);
    }
  });
});

describe('erdl-schema — 自证常量', () => {
  it('SCHEMA_COUNTS 与实际长度一致（禁止手写魔法数字）', () => {
    expect(SCHEMA_COUNTS).toEqual({
      conditionOperators: 28,
      conditionModifiers: 2,
      allOperators: 30,
      doDecisions: 13,
      allDecisions: 21,
      semanticNodes: 34,
      exprNodeTypes: 20,
      ruleCategories: RULE_CATEGORIES.length,
      ruleNamePrefixes: Object.keys(RULE_NAME_PREFIXES).length,
      occupationCategories: OCCUPATION_CATEGORIES.length,
    });
  });
});

describe('erdl-schema — UI 标签覆盖（中台统一，2026-08-28）', () => {
  it('UI operator 下拉 = 28 条件运算符，且严格等于校验器放行域（2026-08-28 review 修复）', async () => {
    const { templateEngine } = await import('../../src/engine/template-engine.js');
    const labels = templateEngine.getOperatorLabels();
    // 缺陷背景：曾直接返回含 within/rate 的 30 键标签表，UI 把修饰符当 operator 供选，
    // 而校验器 VALID_ALL_OPS 只放行 28 个条件运算符 → 用户一选必被拒。
    expect(Object.keys(labels).sort()).toEqual([...CONDITION_OPERATORS].sort());
    for (const op of CONDITION_OPERATORS) {
      expect(typeof labels[op].zh).toBe('string');
      expect(typeof labels[op].en).toBe('string');
    }
  });

  it('修饰符标签单独一表（within/rate 不得混进 operator 下拉）', async () => {
    const { templateEngine } = await import('../../src/engine/template-engine.js');
    const mods = templateEngine.getModifierLabels();
    expect(Object.keys(mods).sort()).toEqual([...CONDITION_MODIFIERS].sort());
    const opLabels = templateEngine.getOperatorLabels();
    for (const m of CONDITION_MODIFIERS) expect(opLabels[m]).toBeUndefined();
  });

  it('两表合计覆盖 30 个语义单元（标签总表不漏项）', async () => {
    const { templateEngine } = await import('../../src/engine/template-engine.js');
    const all = { ...templateEngine.getOperatorLabels(), ...templateEngine.getModifierLabels() };
    expect(Object.keys(all).sort()).toEqual([...ALL_OPERATORS].sort());
  });
});
describe('erdl-schema — 模板运算符域 × 校验器真实放行域（2026-08-28 review 行为断言）', () => {
  it('每个模板域内的运算符都能通过校验器；域外的比较类运算符会被拒', async () => {
    const { templateEngine } = await import('../../src/engine/template-engine.js');
    const { RuleValidator } = await import('../../src/engine/rule-validator.js');
    const v = new RuleValidator();
    const domains = templateEngine.getTemplateOperatorDomains();

    const base = {
      ruleName: 'SEC-001-domain-probe',
      decision: 'DENY' as const,
      message: 'probe',
      priority: 100,
      category: 'security' as const,
    };

    // fieldCompare：域内 6 个必须全过
    for (const op of domains.fieldCompare) {
      const r = v.validate({
        ...base,
        templateId: 'fieldCompare',
        params: { field: 'amount', operator: op, value: '1' },
      } as never);
      expect(r.errors.filter(e => e.field === 'operator')).toHaveLength(0);
    }
    // fieldCompare：域外（如 length_gt / between）必须被拒 —— 这正是修复前 UI 会误提供的那批
    for (const op of ['length_gt', 'between', 'in', 'within']) {
      const r = v.validate({
        ...base,
        templateId: 'fieldCompare',
        params: { field: 'amount', operator: op, value: '1' },
      } as never);
      expect(r.errors.some(e => e.field === 'operator')).toBe(true);
    }
  });

  it('模板域一律是条件运算符子集，且不含修饰符（within/rate 永不出现在 operator 下拉）', async () => {
    const { templateEngine } = await import('../../src/engine/template-engine.js');
    const domains = templateEngine.getTemplateOperatorDomains();
    for (const [tpl, ops] of Object.entries(domains)) {
      expect(ops.length).toBeGreaterThan(0);
      for (const op of ops) {
        expect((CONDITION_OPERATORS as readonly string[]).includes(op)).toBe(true);
        expect((CONDITION_MODIFIERS as readonly string[]).includes(op)).toBe(false);
      }
      void tpl;
    }
  });

  it('值形态分类闭合：none+array+tuple+scalar = 28，且互不重叠', () => {
    const sum =
      OP_VALUE_NONE.length + OP_VALUE_ARRAY.length + OP_VALUE_TUPLE.length + OP_VALUE_SCALAR.length;
    expect(sum).toBe(CONDITION_OPERATORS.length);
    const all = [...OP_VALUE_NONE, ...OP_VALUE_ARRAY, ...OP_VALUE_TUPLE, ...OP_VALUE_SCALAR];
    expect(new Set(all).size).toBe(all.length);
    // 标量域不得含需要数组/元组/无值的运算符（这是模板 UI 过滤的正确性前提）
    for (const op of [...OP_VALUE_ARRAY, ...OP_VALUE_TUPLE, ...OP_VALUE_NONE]) {
      expect((OP_VALUE_SCALAR as readonly string[]).includes(op)).toBe(false);
    }
    expect(operatorValueShape('between')).toBe('tuple');
    expect(operatorValueShape('in')).toBe('array');
    expect(operatorValueShape('exists')).toBe('none');
    expect(operatorValueShape('length_gt')).toBe('scalar');
    expect(operatorValueShape('within')).toBeNull();
  });
});
