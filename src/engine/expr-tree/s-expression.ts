/**
 * s-expression — S-expression serialization of the expression tree (SPEC v2.0 §12 external form)
 *
 * SPEC external form: key name is the node, children are an array, e.g.:
 *   { lt: [ { div: [ {sub: [...]}, {field: "..."} ] }, 0.15 ] }
 *
 * Relationship to the TS discriminated union (node-types.ts's type field):
 *   - in-memory: discriminated union (type field), evaluator exhaustive switch + type safety
 *   - serialization/hash: S-expression (key name is the node), cross-implementation hash benchmarked against SPEC
 *   The two are a bidirectional reversible projection of the same tree, zero semantic loss (E7)
 *
 * Key-name convention (35 semantic key names; parameterized nodes expand to concrete operator names):
 *   field/var/literal, and/or/not,
 *   eq/ne/gt/gte/lt/lte, in,
 *   contains/match/starts_with/ends_with,
 *   exists/length/between, all/any/none,
 *   add/sub/mul/div/round, days_between/epoch_ms,
 *   count/sum/avg/min/max
 *
 * Literal convention (following SPEC §12 examples):
 *   - bare value (number/string/boolean/null) = literal node
 *   - { field: "path" } = field node
 *   - { var: "path" } = var node (path is only '$'/'$.x')
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
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
// TS → S-expression (serialization)
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
      // The key name is forced to date_add; unit as an object field to preserve parameterized semantics
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
// S-expression → TS (deserialization)
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
  // Bare value → literal
  if (input === null || typeof input !== 'object') {
    return { type: 'literal', value: input };
  }
  if (Array.isArray(input)) {
    // Bare array → literal node (e.g. in's set value ["a","b","c"], elements not recursively treated as nodes)
    return { type: 'literal', value: input };
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) {
    throw new SExprParseError(
      `each S-expression node must have exactly one key, got ${keys.length}: ${keys.join(',')}`,
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
      if (!Array.isArray(val)) throw new SExprParseError(`${key}'s value must be an array`);
      return { type: key, args: val.map(fromSExpr) };
    }
    case 'not':
      return { type: 'not', arg: fromSExpr(val) };
    case 'in': {
      if (!Array.isArray(val) || val.length !== 2)
        throw new SExprParseError('in must have two operands');
      return { type: 'in', left: fromSExpr(val[0]), right: fromSExpr(val[1]) };
    }
    case 'exists':
      return { type: 'exists', arg: fromSExpr(val) };
    case 'length':
      return { type: 'length', arg: fromSExpr(val) };
    case 'between': {
      if (!Array.isArray(val) || val.length !== 3)
        throw new SExprParseError('between must have three operands');
      return {
        type: 'between',
        value: fromSExpr(val[0]),
        min: fromSExpr(val[1]),
        max: fromSExpr(val[2]),
      };
    }
    case 'days_between': {
      if (!Array.isArray(val) || val.length !== 2)
        throw new SExprParseError('days_between must have two operands');
      return { type: 'days_between', from: fromSExpr(val[0]), to: fromSExpr(val[1]) };
    }
    case 'epoch_ms':
      return { type: 'epoch_ms', arg: fromSExpr(val) };
    case 'date_add': {
      if (typeof val !== 'object' || val === null)
        throw new SExprParseError("date_add's value must be an object {unit,base,amount}");
      const o = val as Record<string, unknown>;
      if (!DATE_ADD_UNITS.includes(o.unit as DateAddUnit))
        throw new SExprParseError(`unknown date_add unit: ${o.unit}`);
      return {
        type: 'date_add',
        unit: o.unit as DateAddUnit,
        base: fromSExpr(o.base),
        amount: fromSExpr(o.amount),
      };
    }
    case 'date_part': {
      if (typeof val !== 'object' || val === null)
        throw new SExprParseError("date_part's value must be an object {unit,arg}");
      const o = val as Record<string, unknown>;
      if (!DATE_PART_UNITS.includes(o.unit as DatePartUnit))
        throw new SExprParseError(`unknown date_part component: ${o.unit}`);
      return { type: 'date_part', unit: o.unit as DatePartUnit, arg: fromSExpr(o.arg) };
    }
    case 'month_last_day':
      return { type: 'month_last_day', arg: fromSExpr(val) };
  }

  // Parameterized nodes: compare / string / arith / quantifier / aggregate
  if (COMPARE_OPS.includes(key as CompareOp)) {
    if (!Array.isArray(val) || val.length !== 2)
      throw new SExprParseError(`${key} must have two operands`);
    return {
      type: 'compare',
      op: key as CompareOp,
      left: fromSExpr(val[0]),
      right: fromSExpr(val[1]),
    };
  }

  // not_exists is the ONE Simple negation-dual operator that is also a valid expression-tree
  // alias: spec §5.2 explicitly makes it the exception to the exists-guard rule — it compiles
  // to bare not(exists(...)) (field missing -> true), identical to the canonical { not: { exists: ... } }.
  // Keep it as a lenient alias (zero divergence, zero fail-open).
  if (key === 'not_exists') {
    return { type: 'not', arg: { type: 'exists', arg: fromSExpr(val) } };
  }

  // The remaining not_* operators (not_in/not_contains/not_starts_with/not_ends_with/
  // not_between) are Simple-projection operators that MUST compile WITH an exists guard
  // (exists(field) AND not(...), spec §5.2). A lenient bare not(...) would drop that guard and
  // flip null propagation (fail-open). Reject them: write { not: { in: [...] } } plus an explicit
  // exists guard when field presence matters. Keeps the canonical tree unique (E7).

  if (STRING_OPS.includes(key as StringOp)) {
    if (!Array.isArray(val) || val.length !== 2)
      throw new SExprParseError(`${key} must have two operands`);
    return {
      type: 'string',
      op: key as StringOp,
      left: fromSExpr(val[0]),
      right: fromSExpr(val[1]),
    };
  }
  if (ARITH_OPS.includes(key as ArithOp)) {
    if (!Array.isArray(val)) throw new SExprParseError(`${key}'s value must be an array`);
    return { type: 'arith', op: key as ArithOp, args: val.map(fromSExpr) };
  }
  if (QUANT_KINDS.includes(key as QuantifierKind)) {
    if (typeof val !== 'object' || val === null)
      throw new SExprParseError(`${key}'s value must be an object {binding,over,predicate}`);
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

  throw new SExprParseError(`unknown node key name: ${key}`);
}

/** Round-trip test helper: toSExpr → fromSExpr should round-trip (structurally equivalent) */
export function roundtrip(node: ExprNode): ExprNode {
  return fromSExpr(toSExpr(node));
}

/**
 * Check whether a value is an S-expression expression tree (rather than a flat {logic, conditions} / shorthand structure).
 *
 * Judgment basis (negative, loose-first):
 * - non-object / array / null / string → not
 * - contains conditions / logic / expr / decision_table keys → not a pure S-expression (it's a when-level structure)
 * - otherwise try fromSExpr parse, success = S-expression
 *
 * This is the unified entry for "when form judgment" (shared by evaluation / gloss / serializer, avoiding per-site judgment).
 */
export function isSExprWhen(when: unknown): boolean {
  if (when === null || when === undefined) return false;
  if (typeof when !== 'object' || Array.isArray(when)) return false;
  const obj = when as Record<string, unknown>;
  // A when-level structure (containing conditions / logic / expr / decision_table) is not a pure S-expression
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
 * Extract the S-expression raw value of the expression tree from the when structure (Spec §12 authoritative form: when.expr).
 *
 * Recognizes two Expression-projection writing forms:
 * - wrapped form (SPEC §12 authoritative): `when: { expr: { lt: [...] } }` → returns expr's value
 * - top-level tree (compatible form): `when: { lt: [...] }` → returns when itself
 *
 * Returns null when it is not an Expression projection (possibly flat conditions or other).
 */
export function extractWhenExpr(when: unknown): unknown | null {
  if (when === null || when === undefined || typeof when !== 'object' || Array.isArray(when)) {
    return null;
  }
  const obj = when as Record<string, unknown>;

  // SPEC §12 authoritative: when.expr wrapped form
  if ('expr' in obj) {
    const inner = obj['expr'];
    try {
      fromSExpr(inner); // validate that expr's value is a valid S-expression
      return inner;
    } catch {
      return null;
    }
  }

  // Compatible form: when is a tree at the top level
  if (isSExprWhen(when)) {
    return when;
  }

  return null;
}
