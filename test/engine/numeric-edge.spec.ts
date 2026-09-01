/**
 * R2 回归：number→Rational 崩溃面（审计报告 2026-08-21 R2）
 *
 * 背景：String(1e-7)="1e-7"、String(1e21)="1e+21" 不匹配 fromDecimalString
 * 的十进制字面量正则，修复前会让整次 Guard 求值抛出未捕获 FixedPointError，
 * 违反 SPEC v2.0 E12（Guard 必须 fail-close，绝不外抛）。
 */
import { Evaluator } from '../../src/engine/evaluator.js';
import type { RuleDefinition } from '../../src/engine/rule-definition.js';
import {
  fromNumber,
  toDecimalString,
  FixedPointError,
} from '../../src/engine/expr-tree/fixed-point.js';

function gtRule(field: string, value: number): RuleDefinition {
  return {
    id: 'NUM-001',
    name: 'Numeric Guard',
    description: 'numeric comparison',
    category: 'custom',
    conditions: [{ kind: 'context_matches', field, operator: 'gt', value }],
    conditionLogic: 'AND',
    action: { decision: 'DENY', reason: 'exceeds limit' },
    priority: 1,
    enabled: true,
  };
}

describe('fromNumber — 科学计数法展开', () => {
  it('展开小指数 1e-7 → 0.0000001', () => {
    expect(toDecimalString(fromNumber(1e-7))).toBe('0.0000001');
  });

  it('展开大指数 1e21（整数不带小数点，§28.2 最小规范表示）', () => {
    expect(toDecimalString(fromNumber(1e21))).toBe('1000000000000000000000');
  });

  it('展开负指数负数 -1.5e-3 → -0.0015', () => {
    expect(toDecimalString(fromNumber(-1.5e-3))).toBe('-0.0015');
  });

  it('普通小数不受影响 0.15', () => {
    expect(toDecimalString(fromNumber(0.15))).toBe('0.15');
  });

  it('非有限值抛 FixedPointError（由调用方 fail-close）', () => {
    expect(() => fromNumber(NaN)).toThrow(FixedPointError);
    expect(() => fromNumber(Infinity)).toThrow(FixedPointError);
  });
});

describe('Evaluator — 极端数值上下文 fail-close（E12）', () => {
  const evaluator = new Evaluator();

  it('上下文含 1e-7 不崩溃且语义正确（1e-7 不大于 100 → ALLOW）', () => {
    const result = evaluator.evaluate([gtRule('amount', 100)], { amount: 1e-7 });
    expect(result.decision).toBe('ALLOW');
  });

  it('上下文含 1e21 不崩溃且语义正确（1e21 大于 100 → DENY）', () => {
    const result = evaluator.evaluate([gtRule('amount', 100)], { amount: 1e21 });
    expect(result.decision).toBe('DENY');
  });

  it('上下文含 -1e21 不崩溃（-1e21 不大于 100 → ALLOW）', () => {
    const result = evaluator.evaluate([gtRule('amount', 100)], { amount: -1e21 });
    expect(result.decision).toBe('ALLOW');
  });

  it('上下文含 NaN/Infinity 不抛出（type_mismatch → false → ALLOW）', () => {
    expect(() => evaluator.evaluate([gtRule('amount', 100)], { amount: NaN })).not.toThrow();
    expect(() => evaluator.evaluate([gtRule('amount', 100)], { amount: Infinity })).not.toThrow();
    expect(evaluator.evaluate([gtRule('amount', 100)], { amount: NaN }).decision).toBe('ALLOW');
  });
});
