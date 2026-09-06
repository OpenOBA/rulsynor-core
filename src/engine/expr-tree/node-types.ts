/**
 * ERDL expression tree — typed expression-tree kernel (SPEC §10 SafeExpr expression engine)
 *
 * The semantic kernel is a typed expression tree. This file's TS discriminated union has 20 types:
 * parameterized nodes (compare 6 operators / string 4 operators / arith 5 operators /
 * quantifier 3 kinds / aggregate 5 functions) are merged into a single type, so the type count
 * is less than the S-expression semantic key count (38, see s-expression.ts).
 * The node set is frozen at spec level [FREEZE-2] — additive-only: it may be extended, but
 * existing nodes' semantics may not change (never pruned, never redefined).
 *
 * This file defines two views of the kernel: the [in-memory type representation] and the
 * [S-expression canonical serialization]:
 *  - TS internal: discriminated union (type field), for the evaluator's exhaustive switch + type safety
 *  - S-expression (SPEC §5.3 external form, key names are nodes): for cross-implementation hashing / vectors / LLM generation benchmarking
 *
 * The two are two projections of the same tree with zero semantic loss, not two evaluators (E7).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

// ═══════════════════════════════════════════
// 17 types (parameterized nodes merged, see header; frozen)
// ═══════════════════════════════════════════

/** Value access: field / var / literal */
export type FieldNode = { type: 'field'; field: string };
export type VarNode = { type: 'var'; path: string }; // only '$' or '$.path'; clock/random read forbidden
export type LiteralNode = { type: 'literal'; value: unknown };

/** Logic: and / or / not */
export type AndNode = { type: 'and'; args: ExprNode[] };
export type OrNode = { type: 'or'; args: ExprNode[] };
export type NotNode = { type: 'not'; arg: ExprNode };

/** Comparison: eq / ne / gt / gte / lt / lte (operands may be field/variable/literal/arithmetic subtree) */
export type CompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
export type CompareNode = { type: 'compare'; op: CompareOp; left: ExprNode; right: ExprNode };

/** Set: in */
export type InNode = { type: 'in'; left: ExprNode; right: ExprNode }; // right evaluates to an array

/** String: contains / match / starts_with / ends_with */
export type StringOp = 'contains' | 'match' | 'starts_with' | 'ends_with';
export type StringNode = { type: 'string'; op: StringOp; left: ExprNode; right: ExprNode };

/** Existence/dimension: exists / length / between */
export type ExistsNode = { type: 'exists'; arg: ExprNode };
export type LengthNode = { type: 'length'; arg: ExprNode };
export type BetweenNode = { type: 'between'; value: ExprNode; min: ExprNode; max: ExprNode };

/** Quantifier: all / any / none (per-element array judgment; empty-array fold, see E8) */
export type QuantifierKind = 'all' | 'any' | 'none';
export type QuantifierNode = {
  type: 'quantifier';
  kind: QuantifierKind;
  /** Bound variable name of the quantified element (e.g. 'x') */
  binding: string;
  /** Array source being iterated */
  over: ExprNode;
  /** Predicate judged on each element (may reference binding) */
  predicate: ExprNode;
};

/** Arithmetic: add / sub / mul / div / round (fixed-point decimal deterministic operations, E2) */
export type ArithOp = 'add' | 'sub' | 'mul' | 'div' | 'round';
export type ArithNode = { type: 'arith'; op: ArithOp; args: ExprNode[] };

/** Time: days_between / epoch_ms (wall-clock read forbidden, E9; as_of injected by the engine) */
export type DaysBetweenNode = { type: 'days_between'; from: ExprNode; to: ExprNode };
export type EpochMsNode = { type: 'epoch_ms'; arg: ExprNode };

/** Time addition unit (parameterized; aligned with Civil Code §200 year/month/day/hour) */
export type DateAddUnit = 'years' | 'months' | 'days' | 'hours';
/** Time addition/subtraction: date_add{unit}, positive amount = forward, negative = backward (aligned with §200 + backward) */
export type DateAddNode = { type: 'date_add'; unit: DateAddUnit; base: ExprNode; amount: ExprNode };

/** Time component unit (parameterized) */
export type DatePartUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'day_of_week';
/** Extract a time component: date_part{unit} (day_of_week: 1=Monday … 7=Sunday) */
export type DatePartNode = { type: 'date_part'; unit: DatePartUnit; arg: ExprNode };

/** Last day of the month containing the given date (§202 underlying primitive of month-end rollback) */
export type MonthLastDayNode = { type: 'month_last_day'; arg: ExprNode };

/** Aggregate: aggregate(count/sum/avg/min/max), array aggregation + optional structured window */
export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type AggregateNode = { type: 'aggregate'; fn: AggregateFn; over: ExprNode };

/** Expression-tree node union (20 discriminated-union types after the time-node family expansion) */
export type ExprNode =
  | FieldNode
  | VarNode
  | LiteralNode
  | AndNode
  | OrNode
  | NotNode
  | CompareNode
  | InNode
  | StringNode
  | ExistsNode
  | LengthNode
  | BetweenNode
  | QuantifierNode
  | ArithNode
  | DaysBetweenNode
  | EpochMsNode
  | DateAddNode
  | DatePartNode
  | MonthLastDayNode
  | AggregateNode;

// ═══════════════════════════════════════════
// Node type classification (for validation / resource limits / canonicalization)
// ═══════════════════════════════════════════

export const NODE_TYPE_LABELS: Record<ExprNode['type'], string> = {
  field: 'field',
  var: 'var',
  literal: 'literal',
  and: 'and',
  or: 'or',
  not: 'not',
  compare: 'compare',
  in: 'in',
  string: 'string',
  exists: 'exists',
  length: 'length',
  between: 'between',
  quantifier: 'quantifier',
  arith: 'arith',
  days_between: 'days_between',
  epoch_ms: 'epoch_ms',
  aggregate: 'aggregate',
  date_add: 'date_add',
  date_part: 'date_part',
  month_last_day: 'month_last_day',
};

/** Leaf nodes (no children) */
export type LeafNodeType = 'field' | 'var' | 'literal';
/** Logic combinators */
export type LogicNodeType = 'and' | 'or' | 'not';

export function isLeaf(node: ExprNode): node is FieldNode | VarNode | LiteralNode {
  return node.type === 'field' || node.type === 'var' || node.type === 'literal';
}
