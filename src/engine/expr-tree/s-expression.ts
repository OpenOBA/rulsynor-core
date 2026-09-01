/**
 * s-expression — 表达式树的 S-expression 序列化（SPEC v2.0 §12 外在形态）
 *
 * SPEC 外在形态：键名即节点，子节点为数组，例如：
 *   { lt: [ { div: [ {sub: [...]}, {field: "..."} ] }, 0.15 ] }
 *
 * 与 TS 判别式联合（node-types.ts 的 type 字段）的关系：
 *   - 内存：判别式联合（type 字段），求值器穷尽 switch + 类型安全
 *   - 序列化/哈希：S-expression（键名即节点），跨实现哈希对标 SPEC
 *   二者是同一棵树的双向可逆投影，语义零损失（E7）
 *
 * 键名约定（35 个语义键名，参数化节点展开为具体运算符名）：
 *   field/var/literal、and/or/not、
 *   eq/ne/gt/gte/lt/lte、in、
 *   contains/match/starts_with/ends_with、
 *   exists/length/between、all/any/none、
 *   add/sub/mul/div/round、days_between/epoch_ms、
 *   count/sum/avg/min/max
 *
 * 字面量约定（贴 SPEC §12 示例）：
 *   - 裸值（数字/字符串/布尔/null）= literal 节点
 *   - { field: "path" } = field 节点
 *   - { var: "path" } = var 节点（path 仅 '$'/'$.x'）
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type {
  ExprNode,
  CompareOp,
  StringOp,
  ArithOp,
  QuantifierKind,
  AggregateFn,
  DateAddUnit,
  DatePartUnit,
} from './node-types.js';

// ═══════════════════════════════════════════
// TS → S-expression（序列化）
// ═══════════════════════════════════════════

export function toSExpr(node: ExprNode): unknown {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'field':
      return { field: node.field };
    case 'var':
      return { var: node.path };

    case 'and':
    case 'or':
      return { [node.type]: node.args.map(toSExpr) };
    case 'not':
      return { not: toSExpr(node.arg) };

    case 'compare':
      return { [node.op]: [toSExpr(node.left), toSExpr(node.right)] };
    case 'in':
      return { in: [toSExpr(node.left), toSExpr(node.right)] };
    case 'string':
      return { [node.op]: [toSExpr(node.left), toSExpr(node.right)] };

    case 'exists':
      return { exists: toSExpr(node.arg) };
    case 'length':
      return { length: toSExpr(node.arg) };
    case 'between':
      return { between: [toSExpr(node.value), toSExpr(node.min), toSExpr(node.max)] };

    case 'quantifier':
      return {
        [node.kind]: {
          binding: node.binding,
          over: toSExpr(node.over),
          predicate: toSExpr(node.predicate),
        },
      };

    case 'arith':
      return { [node.op]: node.args.map(toSExpr) };

    case 'days_between':
      return { days_between: [toSExpr(node.from), toSExpr(node.to)] };
    case 'epoch_ms':
      return { epoch_ms: toSExpr(node.arg) };
    case 'date_add':
      // 键名强制为 date_add，unit 作为对象字段以保留参数化语义
      return {
        date_add: { unit: node.unit, base: toSExpr(node.base), amount: toSExpr(node.amount) },
      };
    case 'date_part':
      return { date_part: { unit: node.unit, arg: toSExpr(node.arg) } };
    case 'month_last_day':
      return { month_last_day: toSExpr(node.arg) };

    case 'aggregate':
      return { [node.fn]: toSExpr(node.over) };
  }
}

// ═══════════════════════════════════════════
// S-expression → TS（反序列化）
// ═══════════════════════════════════════════

const COMPARE_OPS: CompareOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'];
const STRING_OPS: StringOp[] = ['contains', 'match', 'starts_with', 'ends_with'];
const ARITH_OPS: ArithOp[] = ['add', 'sub', 'mul', 'div', 'round'];
const QUANT_KINDS: QuantifierKind[] = ['all', 'any', 'none'];
const AGGREGATE_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max'];
const DATE_ADD_UNITS: DateAddUnit[] = ['years', 'months', 'days', 'hours'];
const DATE_PART_UNITS: DatePartUnit[] = [
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'day_of_week',
];

export class SExprParseError extends Error {
  constructor(message: string) {
    super(`[SExpr] ${message}`);
    this.name = 'SExprParseError';
  }
}

export function fromSExpr(input: unknown): ExprNode {
  // 裸值 → literal
  if (input === null || typeof input !== 'object') {
    return { type: 'literal', value: input };
  }
  if (Array.isArray(input)) {
    // 裸数组 → literal 节点（如 in 的集合值 ["a","b","c"]，元素不再递归为节点）
    return { type: 'literal', value: input };
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) {
    throw new SExprParseError(
      `每个 S-expression 节点必须恰有一个键，实际 ${keys.length} 个：${keys.join(',')}`,
    );
  }
  const key = keys[0];
  const val = obj[key];

  switch (key) {
    case 'field':
      return { type: 'field', field: String(val) };
    case 'var':
      return { type: 'var', path: String(val) };
    case 'and':
    case 'or': {
      if (!Array.isArray(val)) throw new SExprParseError(`${key} 的值必须是数组`);
      return { type: key, args: val.map(fromSExpr) };
    }
    case 'not':
      return { type: 'not', arg: fromSExpr(val) };
    case 'in': {
      if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError('in 必须两个操作数');
      return { type: 'in', left: fromSExpr(val[0]), right: fromSExpr(val[1]) };
    }
    case 'exists':
      return { type: 'exists', arg: fromSExpr(val) };
    case 'length':
      return { type: 'length', arg: fromSExpr(val) };
    case 'between': {
      if (!Array.isArray(val) || val.length !== 3)
        throw new SExprParseError('between 必须三个操作数');
      return {
        type: 'between',
        value: fromSExpr(val[0]),
        min: fromSExpr(val[1]),
        max: fromSExpr(val[2]),
      };
    }
    case 'days_between': {
      if (!Array.isArray(val) || val.length !== 2)
        throw new SExprParseError('days_between 必须两个操作数');
      return { type: 'days_between', from: fromSExpr(val[0]), to: fromSExpr(val[1]) };
    }
    case 'epoch_ms':
      return { type: 'epoch_ms', arg: fromSExpr(val) };
    case 'date_add': {
      if (typeof val !== 'object' || val === null)
        throw new SExprParseError('date_add 的值必须是对象 {unit,base,amount}');
      const o = val as Record<string, unknown>;
      if (!DATE_ADD_UNITS.includes(o.unit as DateAddUnit))
        throw new SExprParseError(`未知 date_add 单位：${o.unit}`);
      return {
        type: 'date_add',
        unit: o.unit as DateAddUnit,
        base: fromSExpr(o.base),
        amount: fromSExpr(o.amount),
      };
    }
    case 'date_part': {
      if (typeof val !== 'object' || val === null)
        throw new SExprParseError('date_part 的值必须是对象 {unit,arg}');
      const o = val as Record<string, unknown>;
      if (!DATE_PART_UNITS.includes(o.unit as DatePartUnit))
        throw new SExprParseError(`未知 date_part 分量：${o.unit}`);
      return { type: 'date_part', unit: o.unit as DatePartUnit, arg: fromSExpr(o.arg) };
    }
    case 'month_last_day':
      return { type: 'month_last_day', arg: fromSExpr(val) };
  }

  // 参数化节点：compare / string / arith / quantifier / aggregate
  if (COMPARE_OPS.includes(key as CompareOp)) {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} 必须两个操作数`);
    return {
      type: 'compare',
      op: key as CompareOp,
      left: fromSExpr(val[0]),
      right: fromSExpr(val[1]),
    };
  }

  // Simple 否定对偶算子（not_in/not_contains/...）→ 宽容解析为 not(xxx(...))
  // 表达式树规范用 not 派生，但 LLM 可能直接产出 Simple 算子名；此处归一为 not 树，避免误拒。
  // 语义边界（E11 空值传播）：not_in(x,list) 当 x 缺失时 in→false、not→true，可能意外放行；
  // 该语义由 SPEC 空值传播定义，跨实现须一致（确定性风险标注，勿改语义）。
  if (key === 'not_in') {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError('not_in 必须两个操作数');
    return { type: 'not', arg: { type: 'in', left: fromSExpr(val[0]), right: fromSExpr(val[1]) } };
  }
  if (key === 'not_contains' || key === 'not_starts_with' || key === 'not_ends_with') {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} 必须两个操作数`);
    const innerOp =
      key === 'not_contains' ? 'contains' : key === 'not_starts_with' ? 'starts_with' : 'ends_with';
    return {
      type: 'not',
      arg: {
        type: 'string',
        op: innerOp as StringOp,
        left: fromSExpr(val[0]),
        right: fromSExpr(val[1]),
      },
    };
  }
  if (key === 'not_exists') {
    return { type: 'not', arg: { type: 'exists', arg: fromSExpr(val) } };
  }
  if (key === 'not_between') {
    if (!Array.isArray(val) || val.length !== 3)
      throw new SExprParseError('not_between 必须三个操作数');
    return {
      type: 'not',
      arg: {
        type: 'between',
        value: fromSExpr(val[0]),
        min: fromSExpr(val[1]),
        max: fromSExpr(val[2]),
      },
    };
  }

  if (STRING_OPS.includes(key as StringOp)) {
    if (!Array.isArray(val) || val.length !== 2) throw new SExprParseError(`${key} 必须两个操作数`);
    return {
      type: 'string',
      op: key as StringOp,
      left: fromSExpr(val[0]),
      right: fromSExpr(val[1]),
    };
  }
  if (ARITH_OPS.includes(key as ArithOp)) {
    if (!Array.isArray(val)) throw new SExprParseError(`${key} 的值必须是数组`);
    return { type: 'arith', op: key as ArithOp, args: val.map(fromSExpr) };
  }
  if (QUANT_KINDS.includes(key as QuantifierKind)) {
    if (typeof val !== 'object' || val === null)
      throw new SExprParseError(`${key} 的值必须是对象 {binding,over,predicate}`);
    const q = val as Record<string, unknown>;
    return {
      type: 'quantifier',
      kind: key as QuantifierKind,
      binding: String(q.binding),
      over: fromSExpr(q.over),
      predicate: fromSExpr(q.predicate),
    };
  }
  if (AGGREGATE_FNS.includes(key as AggregateFn)) {
    return { type: 'aggregate', fn: key as AggregateFn, over: fromSExpr(val) };
  }

  throw new SExprParseError(`未知节点键名：${key}`);
}

/** 往返测试辅助：toSExpr → fromSExpr 应还原（结构等价） */
export function roundtrip(node: ExprNode): ExprNode {
  return fromSExpr(toSExpr(node));
}

/**
 * 判断一个值是否为 S-expression 表达式树（而非平铺 {logic, conditions} / shorthand 结构）。
 *
 * 判定依据（否定式，宽松优先）：
 * - 非对象 / 数组 / null / 字符串 → 不是
 * - 含 conditions / logic / expr / decision_table 键 → 不是纯 S-expression（是 when 层级结构）
 * - 其余情况尝试 fromSExpr 解析，成功即 S-expression
 *
 * 这是「when 形态判断」的统一入口（求值 / gloss / serializer 三处共用，避免各自判断）。
 */
export function isSExprWhen(when: unknown): boolean {
  if (when === null || when === undefined) return false;
  if (typeof when !== 'object' || Array.isArray(when)) return false;
  const obj = when as Record<string, unknown>;
  // when 层级结构（含 conditions / logic / expr / decision_table）不算纯 S-expression
  if ('conditions' in obj || 'logic' in obj || 'expr' in obj || 'decision_table' in obj)
    return false;
  try {
    fromSExpr(when);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 when 结构中提取表达式树的 S-expression 原始值（Spec §12 权威形态：when.expr）。
 *
 * 识别两种 Expression 投影面的书写形态：
 * - 包裹形态（SPEC §12 权威）：`when: { expr: { lt: [...] } }` → 返回 expr 的值
 * - 顶层树（兼容形态）：`when: { lt: [...] }` → 返回 when 本身
 *
 * 返回 null 表示不是 Expression 投影面（可能是平铺 conditions 或其他）。
 */
export function extractWhenExpr(when: unknown): unknown | null {
  if (when === null || when === undefined || typeof when !== 'object' || Array.isArray(when)) {
    return null;
  }
  const obj = when as Record<string, unknown>;

  // SPEC §12 权威：when.expr 包裹形态
  if ('expr' in obj) {
    const inner = obj['expr'];
    try {
      fromSExpr(inner); // 校验 expr 的值是合法 S-expression
      return inner;
    } catch {
      return null;
    }
  }

  // 兼容形态：when 顶层即树
  if (isSExprWhen(when)) {
    return when;
  }

  return null;
}
