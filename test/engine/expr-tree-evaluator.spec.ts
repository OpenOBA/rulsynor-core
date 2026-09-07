/**
 * ExprTreeEvaluator 单测 — SPEC v1.2 §10 内核求值语义
 *
 * 覆盖：
 * - 各节点类型求值正确性
 * - E8 量词空数组安全折叠
 * - E11 undefined 哨兵 / 空值传播
 * - §11.2 严格类型匹配（无隐式转换）
 * - E4 资源上限
 */

import { ExprTreeEvaluator, objectContext } from '../../src/engine/expr-tree/evaluator.js';
import { enforceLimits, ExprLimitError } from '../../src/engine/expr-tree/limits.js';
import {
  toDecimalString,
  fromDecimalString,
  add,
  div,
} from '../../src/engine/expr-tree/fixed-point.js';
import type { ExprNode } from '../../src/engine/expr-tree/node-types.js';

const ev = new ExprTreeEvaluator();

function ctx(obj: Record<string, unknown>) {
  return objectContext(obj, new Date('2026-08-15T00:00:00Z'));
}

describe('ExprTreeEvaluator — 取值节点', () => {
  it('literal 直接返回值', () => {
    const node: ExprNode = { type: 'literal', value: 42 };
    expect(ev.evaluate(node, ctx({})).value).toBe(42);
  });
  it('field 解析顶层字段', () => {
    const node: ExprNode = { type: 'field', field: 'age' };
    expect(ev.evaluate(node, ctx({ age: 35 })).value).toBe(35);
  });
  it('field 解析点路径', () => {
    const node: ExprNode = { type: 'field', field: 'user.name' };
    expect(ev.evaluate(node, ctx({ user: { name: '张三' } })).value).toBe('张三');
  });
  it('field 缺失 → undefined（E11 由上层折叠）', () => {
    const node: ExprNode = { type: 'field', field: 'missing' };
    expect(ev.evaluate(node, ctx({})).value).toBeUndefined();
  });
});

describe('ExprTreeEvaluator — 逻辑节点', () => {
  it('and 全部真 → true', () => {
    const node: ExprNode = {
      type: 'and',
      args: [
        { type: 'literal', value: true },
        { type: 'literal', value: true },
      ],
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(true);
  });
  it('and 有假 → false', () => {
    const node: ExprNode = {
      type: 'and',
      args: [
        { type: 'literal', value: true },
        { type: 'literal', value: false },
      ],
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(false);
  });
  it('or 任一真 → true', () => {
    const node: ExprNode = {
      type: 'or',
      args: [
        { type: 'literal', value: false },
        { type: 'literal', value: true },
      ],
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(true);
  });
  it('严格布尔：number 1 不是真（toBoolean 不隐式转换）', () => {
    // and 的子节点是 literal 1（number），应按严格布尔判为 false
    const node: ExprNode = {
      type: 'and',
      args: [
        { type: 'literal', value: 1 },
        { type: 'literal', value: true },
      ],
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(false);
  });
  it('not 取反', () => {
    const node: ExprNode = { type: 'not', arg: { type: 'literal', value: false } };
    expect(ev.evaluate(node, ctx({})).value).toBe(true);
  });
});

describe('ExprTreeEvaluator — 比较节点（严格类型匹配 §11.2）', () => {
  it('eq number', () => {
    const node: ExprNode = {
      type: 'compare',
      op: 'eq',
      left: { type: 'field', field: 'age' },
      right: { type: 'literal', value: 35 },
    };
    expect(ev.evaluate(node, ctx({ age: 35 })).value).toBe(true);
  });
  it('gt number', () => {
    const node: ExprNode = {
      type: 'compare',
      op: 'gt',
      left: { type: 'field', field: 'age' },
      right: { type: 'literal', value: 60 },
    };
    expect(ev.evaluate(node, ctx({ age: 61 })).value).toBe(true);
  });
  it('字符串 "100" gt 50 → false（无隐式转换）', () => {
    const node: ExprNode = {
      type: 'compare',
      op: 'gt',
      left: { type: 'field', field: 'amount' },
      right: { type: 'literal', value: 50 },
    };
    const r = ev.evaluate(node, ctx({ amount: '100' }));
    expect(r.value).toBe(false);
    expect(r.warnings.some(w => w.kind === 'type_mismatch')).toBe(true);
  });
});

describe('ExprTreeEvaluator — 集合/字符串/存在/长度/区间', () => {
  it('in', () => {
    const node: ExprNode = {
      type: 'in',
      left: { type: 'field', field: 'cat' },
      right: { type: 'literal', value: ['罕见重疾', '普通重疾'] },
    };
    expect(ev.evaluate(node, ctx({ cat: '罕见重疾' })).value).toBe(true);
  });
  it('contains', () => {
    const node: ExprNode = {
      type: 'string',
      op: 'contains',
      left: { type: 'field', field: 'cmd' },
      right: { type: 'literal', value: 'rm' },
    };
    expect(ev.evaluate(node, ctx({ cmd: 'rm -rf /' })).value).toBe(true);
  });
  it('exists 缺失 → false；存在 → true', () => {
    const miss: ExprNode = { type: 'exists', arg: { type: 'field', field: 'x' } };
    const hit: ExprNode = { type: 'exists', arg: { type: 'field', field: 'x' } };
    expect(ev.evaluate(miss, ctx({})).value).toBe(false);
    expect(ev.evaluate(hit, ctx({ x: 1 })).value).toBe(true);
  });
  it('length 字符串', () => {
    const node: ExprNode = { type: 'length', arg: { type: 'field', field: 's' } };
    expect(ev.evaluate(node, ctx({ s: 'abc' })).value).toBe(3);
  });
  it('between 闭区间', () => {
    const node: ExprNode = {
      type: 'between',
      value: { type: 'field', field: 'age' },
      min: { type: 'literal', value: 16 },
      max: { type: 'literal', value: 60 },
    };
    expect(ev.evaluate(node, ctx({ age: 30 })).value).toBe(true);
    expect(ev.evaluate(node, ctx({ age: 15 })).value).toBe(false);
  });
});

describe('ExprTreeEvaluator — 量词（E8 空数组安全折叠）', () => {
  it('all 全部满足 → true', () => {
    const node: ExprNode = {
      type: 'quantifier',
      kind: 'all',
      binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: {
        type: 'compare',
        op: 'gt',
        left: { type: 'var', path: 'x' },
        right: { type: 'literal', value: 0 },
      },
    };
    expect(ev.evaluate(node, ctx({ items: [1, 2, 3] })).value).toBe(true);
  });
  it('any 部分满足 → true', () => {
    const node: ExprNode = {
      type: 'quantifier',
      kind: 'any',
      binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: {
        type: 'compare',
        op: 'gt',
        left: { type: 'var', path: 'x' },
        right: { type: 'literal', value: 2 },
      },
    };
    expect(ev.evaluate(node, ctx({ items: [1, 2, 3] })).value).toBe(true);
  });
  it('all 空数组 → false（安全折叠，刻意偏离标准）', () => {
    const node: ExprNode = {
      type: 'quantifier',
      kind: 'all',
      binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: {
        type: 'compare',
        op: 'gt',
        left: { type: 'var', path: 'x' },
        right: { type: 'literal', value: 0 },
      },
    };
    const r = ev.evaluate(node, ctx({ items: [] }));
    expect(r.value).toBe(false);
    expect(r.warnings.some(w => w.kind === 'quantifier_empty')).toBe(true);
  });
  it('none 空数组 → false（安全折叠）', () => {
    const node: ExprNode = {
      type: 'quantifier',
      kind: 'none',
      binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: { type: 'literal', value: true },
    };
    expect(ev.evaluate(node, ctx({ items: [] })).value).toBe(false);
  });
});

describe('ExprTreeEvaluator — 算术 / 时间 / 聚合', () => {
  it('arith mul 返回有理数（精确，中间不舍入）', () => {
    const node: ExprNode = {
      type: 'arith',
      op: 'mul',
      args: [
        { type: 'field', field: 'share' },
        { type: 'field', field: 'price' },
      ],
    };
    const r = ev.evaluate(node, ctx({ share: 3, price: 60000 }));
    expect((r.value as any).num).toBe(180000n);
    expect((r.value as any).den).toBe(1n);
  });
  it('arith div 三分之四 → 精确有理数 num=4 den=3', () => {
    const node: ExprNode = {
      type: 'arith',
      op: 'div',
      args: [
        { type: 'literal', value: 4 },
        { type: 'literal', value: 3 },
      ],
    };
    const r = ev.evaluate(node, ctx({}));
    expect((r.value as any).num).toBe(4n);
    expect((r.value as any).den).toBe(3n);
  });
  it('arith div 除零 → 警告 + null（E12 由调用方折叠）', () => {
    const node: ExprNode = {
      type: 'arith',
      op: 'div',
      args: [
        { type: 'literal', value: 10 },
        { type: 'literal', value: 0 },
      ],
    };
    const r = ev.evaluate(node, ctx({}));
    expect(r.warnings.some(w => w.kind === 'division_by_zero')).toBe(true);
  });
  it('arith div 三个操作数 → 类型不匹配警告（不可结合，强制二元）', () => {
    const node: ExprNode = {
      type: 'arith',
      op: 'div',
      args: [
        { type: 'literal', value: 10 },
        { type: 'literal', value: 2 },
        { type: 'literal', value: 5 },
      ],
    };
    const r = ev.evaluate(node, ctx({}));
    expect(r.warnings.some(w => w.kind === 'type_mismatch')).toBe(true);
  });
  it('arith round half-even（3.5→4，4.5→4）', () => {
    const r35: ExprNode = { type: 'arith', op: 'round', args: [{ type: 'literal', value: 3.5 }] };
    const r45: ExprNode = { type: 'arith', op: 'round', args: [{ type: 'literal', value: 4.5 }] };
    expect((ev.evaluate(r35, ctx({})).value as any).num).toBe(4n);
    expect((ev.evaluate(r45, ctx({})).value as any).num).toBe(4n);
  });
  it('compare 使用有理数精确比较（0.1+0.2 不等于 0.3 的浮点陷阱）', () => {
    // (0.1 + 0.2) 与 0.3 精确相等（有理数无浮点误差）
    const sum: ExprNode = {
      type: 'arith',
      op: 'add',
      args: [
        { type: 'literal', value: 0.1 },
        { type: 'literal', value: 0.2 },
      ],
    };
    const node: ExprNode = {
      type: 'compare',
      op: 'eq',
      left: sum,
      right: { type: 'literal', value: 0.3 },
    };
    const r = ev.evaluate(node, ctx({}));
    expect(r.value).toBe(true);
  });
  it('days_between', () => {
    const node: ExprNode = {
      type: 'days_between',
      from: { type: 'literal', value: '2026-01-01' },
      to: { type: 'literal', value: '2026-01-11' },
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(10);
  });
  it('epoch_ms no-timezone datetime == explicit Z (UTC, host-TZ independent)', () => {
    const noTz: ExprNode = {
      type: 'epoch_ms',
      arg: { type: 'literal', value: '2026-01-01T12:30:45' },
    };
    const withZ: ExprNode = {
      type: 'epoch_ms',
      arg: { type: 'literal', value: '2026-01-01T12:30:45Z' },
    };
    expect(ev.evaluate(noTz, ctx({})).value).toBe(1767270645000);
    expect(ev.evaluate(noTz, ctx({})).value).toBe(ev.evaluate(withZ, ctx({})).value);
  });
  it('epoch_ms honors explicit offsets (UTC = local - offset)', () => {
    const plus8: ExprNode = {
      type: 'epoch_ms',
      arg: { type: 'literal', value: '2026-01-01T12:30:45+08:00' },
    };
    const minus5: ExprNode = {
      type: 'epoch_ms',
      arg: { type: 'literal', value: '2026-01-01T12:30:45-05:00' },
    };
    expect(ev.evaluate(plus8, ctx({})).value).toBe(1767241845000);
    expect(ev.evaluate(minus5, ctx({})).value).toBe(1767288645000);
  });
  it('epoch_ms rejects non-ISO and invalid calendar dates (strict)', () => {
    for (const bad of [
      'Jan 1 2026',
      '2026/01/01',
      '2026-02-30',
      '2026-13-01',
      '2026-01-01T25:00:00',
      'not-a-date',
      '2026-01-01T12:30:45.123Z',
      '2026-01-01T12:30:45.5',
    ]) {
      const node: ExprNode = { type: 'epoch_ms', arg: { type: 'literal', value: bad } };
      expect(ev.evaluate(node, ctx({})).value).toBeNull();
    }
  });
  // ══ 时间节点族（Phase A：date_add / date_part / month_last_day）══
  it('date_add years 顺加（对年）', () => {
    const node: ExprNode = {
      type: 'date_add',
      unit: 'years',
      base: { type: 'literal', value: '2024-01-15' },
      amount: { type: 'literal', value: 2 },
    };
    const r = ev.evaluate(node, ctx({})).value as Date;
    expect(r.toISOString().slice(0, 10)).toBe('2026-01-15');
  });
  it('date_add months 月末回退（§202：1月31 + 1月 → 2月28）', () => {
    const node: ExprNode = {
      type: 'date_add',
      unit: 'months',
      base: { type: 'literal', value: '2024-01-31' },
      amount: { type: 'literal', value: 1 },
    };
    const r = ev.evaluate(node, ctx({})).value as Date;
    expect(r.toISOString().slice(0, 10)).toBe('2024-02-29'); // 2024 闰年
  });
  it('date_add months 逆推（负 amount）', () => {
    const node: ExprNode = {
      type: 'date_add',
      unit: 'days',
      base: { type: 'literal', value: '2026-01-15' },
      amount: { type: 'literal', value: -30 },
    };
    const r = ev.evaluate(node, ctx({})).value as Date;
    expect(r.toISOString().slice(0, 10)).toBe('2025-12-16');
  });
  it('date_part year/month/day', () => {
    const y: ExprNode = {
      type: 'date_part',
      unit: 'year',
      arg: { type: 'literal', value: '2026-08-15' },
    };
    const m: ExprNode = {
      type: 'date_part',
      unit: 'month',
      arg: { type: 'literal', value: '2026-08-15' },
    };
    const d: ExprNode = {
      type: 'date_part',
      unit: 'day',
      arg: { type: 'literal', value: '2026-08-15' },
    };
    expect(ev.evaluate(y, ctx({})).value).toBe(2026);
    expect(ev.evaluate(m, ctx({})).value).toBe(8);
    expect(ev.evaluate(d, ctx({})).value).toBe(15);
  });
  it('date_part day_of_week（1=周一）', () => {
    // 2026-08-15 是周六
    const node: ExprNode = {
      type: 'date_part',
      unit: 'day_of_week',
      arg: { type: 'literal', value: '2026-08-15' },
    };
    expect(ev.evaluate(node, ctx({})).value).toBe(6);
  });
  it('month_last_day（月末日）', () => {
    const feb: ExprNode = { type: 'month_last_day', arg: { type: 'literal', value: '2024-02-10' } };
    expect((ev.evaluate(feb, ctx({})).value as Date).toISOString().slice(0, 10)).toBe('2024-02-29'); // 闰年
    const jan: ExprNode = { type: 'month_last_day', arg: { type: 'literal', value: '2026-01-10' } };
    expect((ev.evaluate(jan, ctx({})).value as Date).toISOString().slice(0, 10)).toBe('2026-01-31');
  });
  it('date_add 非法日期 → invalid_date 警告', () => {
    const node: ExprNode = {
      type: 'date_add',
      unit: 'days',
      base: { type: 'literal', value: 'not-a-date' },
      amount: { type: 'literal', value: 1 },
    };
    const r = ev.evaluate(node, ctx({}));
    expect(r.value).toBe(null);
    expect(r.warnings.some(w => w.kind === 'invalid_date')).toBe(true);
  });
  it('aggregate max（返回有理数，与 arith 一致）', () => {
    const node: ExprNode = { type: 'aggregate', fn: 'max', over: { type: 'field', field: 'nums' } };
    expect((ev.evaluate(node, ctx({ nums: [1, 8, 3] })).value as any).num).toBe(8n);
  });
  it('aggregate min（返回有理数）', () => {
    const node: ExprNode = { type: 'aggregate', fn: 'min', over: { type: 'field', field: 'nums' } };
    expect((ev.evaluate(node, ctx({ nums: [5, 2, 9] })).value as any).num).toBe(2n);
  });
  it('aggregate sum（有理数精确，避免 0.1+0.2 浮点陷阱）', () => {
    const node: ExprNode = { type: 'aggregate', fn: 'sum', over: { type: 'field', field: 'nums' } };
    const r = ev.evaluate(node, ctx({ nums: [0.1, 0.2, 0.3] })).value as any;
    // 0.1+0.2+0.3 精确 = 0.6，有理数 num=3 den=5
    expect(r.num).toBe(3n);
    expect(r.den).toBe(5n);
  });
  it('aggregate avg（有理数精确）', () => {
    const node: ExprNode = { type: 'aggregate', fn: 'avg', over: { type: 'field', field: 'nums' } };
    const r = ev.evaluate(node, ctx({ nums: [1, 2, 3, 4] })).value as any;
    // (1+2+3+4)/4 = 10/4 = 5/2
    expect(r.num).toBe(5n);
    expect(r.den).toBe(2n);
  });
  it('aggregate count（保持整数 number）', () => {
    const node: ExprNode = {
      type: 'aggregate',
      fn: 'count',
      over: { type: 'field', field: 'nums' },
    };
    expect(ev.evaluate(node, ctx({ nums: [1, 2, 3] })).value).toBe(3);
  });
  it('aggregate 非数值元素 → 类型不匹配（严格类型）', () => {
    const node: ExprNode = { type: 'aggregate', fn: 'sum', over: { type: 'field', field: 'nums' } };
    const r = ev.evaluate(node, ctx({ nums: [1, 'x', 3] }));
    expect(r.value).toBe(null);
    expect(r.errored).toBe(false);
    expect(r.warnings.some(w => w.kind === 'type_mismatch')).toBe(true);
  });
});

describe('ExprTreeEvaluator — 定点小数（E2）', () => {
  it('toDecimalString 输出时舍入 scale=14', () => {
    const r = div(fromDecimalString('1'), fromDecimalString('3'));
    const s = toDecimalString(r, 14);
    expect(s.startsWith('0.33333333333333')).toBe(true);
  });
  it('0.1 + 0.2 精确等于 0.3（有理数）', () => {
    const r = add(fromDecimalString('0.1'), fromDecimalString('0.2'));
    expect(toDecimalString(r, 14)).toBe('0.3');
  });
  it('half-even 舍入到整数（银行家舍入，scale=0）', () => {
    // 0.5→0（偶）、1.5→2（奇进偶）、2.5→2（偶）、3.5→4（奇进偶）
    expect(toDecimalString(fromDecimalString('0.5'), 0)).toBe('0');
    expect(toDecimalString(fromDecimalString('1.5'), 0)).toBe('2');
    expect(toDecimalString(fromDecimalString('2.5'), 0)).toBe('2');
    expect(toDecimalString(fromDecimalString('3.5'), 0)).toBe('4');
    expect(toDecimalString(fromDecimalString('4.5'), 0)).toBe('4');
  });
});

describe('ExprTreeEvaluator — match ReDoS 防护', () => {
  it('安全正则正常匹配', () => {
    const node: ExprNode = {
      type: 'string',
      op: 'match',
      left: { type: 'field', field: 'cmd' },
      right: { type: 'literal', value: '^(rm|sudo)$' },
    };
    expect(ev.evaluate(node, ctx({ cmd: 'rm' })).value).toBe(true);
  });
  it('嵌套量词正则被 reject → false + 警告', () => {
    const node: ExprNode = {
      type: 'string',
      op: 'match',
      left: { type: 'field', field: 'cmd' },
      right: { type: 'literal', value: '(a+)+$' },
    };
    const r = ev.evaluate(node, ctx({ cmd: 'aaaa' }));
    expect(r.value).toBe(false);
    expect(r.warnings.some(w => w.kind === 'regex_re_dos')).toBe(true);
  });
});

describe('ExprTreeEvaluator — 资源上限（E4）', () => {
  it('节点数超限 → 抛 ExprLimitError', () => {
    // 构造 65 个 literal 的 and
    const args: ExprNode[] = Array.from(
      { length: 65 },
      () => ({ type: 'literal', value: true }) as ExprNode,
    );
    const node: ExprNode = { type: 'and', args };
    expect(() => enforceLimits(node)).toThrow(ExprLimitError);
  });
});
