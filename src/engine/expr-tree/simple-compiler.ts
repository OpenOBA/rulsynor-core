/**
 * simple-compiler — Simple condition operators (28) → expression-tree compilation (SPEC v2.0 §11)
 *
 * SPEC v2.0 §11: "28 condition operators + 2 modifiers (within/rate) = 30 semantic units".
 * This file only compiles the 28 condition operators; within/rate are stateful modifiers, outside
 * the tree (GuardStateManager), not compiled here. The evaluation core converges from
 * "operator branching" to "node-type traversal".
 *
 * 28 condition operators' compile destinations (SPEC v2.0 §11 authoritative mapping):
 * - 13 direct nodes: eq/ne/gt/gte/lt/lte · in · contains/starts_with/ends_with/match · exists · between
 * - 6  not-combinations: not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between
 * - 9  length/count combinations: length_gt/gte/lt/lte/eq (5) + count_gt/gte/lt/lte (4)
 * - 2  time modifiers: within/rate (state outside the tree in GuardStateManager, not compiled into tree evaluation — see below)
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

import type { ExprNode } from './node-types.js';
import type { ConditionOperator } from '../erdl-schema.js';

/** Full set of Simple condition operators (28, SPEC v2.0 §11, spec-level frozen; excluding within/rate modifiers) */
// 2026-08-28 argumentation-stage consolidation: originally a local 28-item union type. It was once
// added to the NO-DUP-ENUM whitelist, and the whitelist masked a true duplicate — simple-compiler
// can be fully derived from the single source of truth.
// Conclusion: the whitelist should only cover cases that are structurally underivable (e.g. frontend
// without backend dependency), never "derivable but not derived".
export type SimpleOperator = ConditionOperator;

/** Simple condition (field + operator + value triple) */
export interface SimpleCondition {
  field: string;
  operator: SimpleOperator;
  value?: unknown;
}

export class SimpleCompileError extends Error {
  constructor(message: string) {
    super(`[SimpleCompile] ${message}`);
    this.name = 'SimpleCompileError';
  }
}

/** Construct a field reference node */
function field(name: string): ExprNode {
  return { type: 'field', field: name };
}

/** Construct a literal node */
function literal(value: unknown): ExprNode {
  return { type: 'literal', value };
}

/** Construct a comparison node */
function cmp(
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte',
  left: ExprNode,
  right: ExprNode,
): ExprNode {
  return { type: 'compare', op, left, right };
}

/** Construct a not node */
function not(arg: ExprNode): ExprNode {
  return { type: 'not', arg };
}

/**
 * exists guard (E11 null propagation): derived operators (not_* / length_*) must return false for
 * missing fields, rather than being wrongly judged true after a not-flip or numeric comparison.
 * Compiled to exists(field) AND <inner> — when the field is missing (undefined/null), exists=false → overall false.
 * Fix (2026-08-27): the original implementation compiled not_* as not(positive operator); the positive
 * operator returns false for a missing field, so not(false)=true flipped null propagation (a fail-open
 * security hole); same for length_* (length(missing)=0, 0>negative/0==0 wrongly judged true).
 */
function andExists(fieldName: string, inner: ExprNode): ExprNode {
  return { type: 'and', args: [{ type: 'exists', arg: field(fieldName) }, inner] };
}

/**
 * Compile a single Simple condition → expression-tree node.
 * Aligned with the §11 authoritative mapping, no dangling.
 */
export function compileSimpleCondition(cond: SimpleCondition): ExprNode {
  const { field: fieldName, operator, value } = cond;
  if (!fieldName) throw new SimpleCompileError('field must not be empty');

  switch (operator) {
    // ── 13 direct nodes ──
    case 'eq':
    case 'ne':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return cmp(operator, field(fieldName), literal(value));
    case 'in':
      return { type: 'in', left: field(fieldName), right: literal(value) };
    case 'contains':
    case 'starts_with':
    case 'ends_with':
    case 'match':
      return { type: 'string', op: operator, left: field(fieldName), right: literal(value) };
    case 'exists':
      return { type: 'exists', arg: field(fieldName) };
    case 'between': {
      // value should be [min, max]
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(
          `between requires a [min, max] array, got ${JSON.stringify(value)}`,
        );
      }
      return {
        type: 'between',
        value: field(fieldName),
        min: literal(value[0]),
        max: literal(value[1]),
      };
    }

    // ── 6 not-combinations (not_* with exists guard, no not-flip when field missing) ──
    case 'not_in':
      return andExists(
        fieldName,
        not({ type: 'in', left: field(fieldName), right: literal(value) }),
      );
    case 'not_contains':
      return andExists(
        fieldName,
        not({ type: 'string', op: 'contains', left: field(fieldName), right: literal(value) }),
      );
    case 'not_starts_with':
      return andExists(
        fieldName,
        not({ type: 'string', op: 'starts_with', left: field(fieldName), right: literal(value) }),
      );
    case 'not_ends_with':
      return andExists(
        fieldName,
        not({ type: 'string', op: 'ends_with', left: field(fieldName), right: literal(value) }),
      );
    case 'not_exists':
      // not_exists is one of the only operators that sense field presence (E11), keep not(exists), no exists guard
      return not({ type: 'exists', arg: field(fieldName) });
    case 'not_between': {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(
          `not_between requires a [min, max] array, got ${JSON.stringify(value)}`,
        );
      }
      return andExists(
        fieldName,
        not({
          type: 'between',
          value: field(fieldName),
          min: literal(value[0]),
          max: literal(value[1]),
        }),
      );
    }

    // ── 9 length/count combinations (length_*/count_* with exists guard, no 0/null misjudgment when field missing) ──
    case 'length_gt':
      return andExists(fieldName, cmp('gt', lengthOf(fieldName), literal(value)));
    case 'length_gte':
      return andExists(fieldName, cmp('gte', lengthOf(fieldName), literal(value)));
    case 'length_lt':
      return andExists(fieldName, cmp('lt', lengthOf(fieldName), literal(value)));
    case 'length_lte':
      return andExists(fieldName, cmp('lte', lengthOf(fieldName), literal(value)));
    case 'length_eq':
      return andExists(fieldName, cmp('eq', lengthOf(fieldName), literal(value)));
    case 'count_gt':
      return andExists(fieldName, cmp('gt', countOf(fieldName), literal(value)));
    case 'count_gte':
      return andExists(fieldName, cmp('gte', countOf(fieldName), literal(value)));
    case 'count_lt':
      return andExists(fieldName, cmp('lt', countOf(fieldName), literal(value)));
    case 'count_lte':
      return andExists(fieldName, cmp('lte', countOf(fieldName), literal(value)));

    default:
      // within/rate are stateful operators, not compiled here (state outside the tree)
      throw new SimpleCompileError(`unsupported Simple operator: ${operator}`);
  }
}

/** length(field) node */
function lengthOf(fieldName: string): ExprNode {
  return { type: 'length', arg: field(fieldName) };
}

/** count(field) node (aggregate count) */
function countOf(fieldName: string): ExprNode {
  return { type: 'aggregate', fn: 'count', over: field(fieldName) };
}

/**
 * Compile a group of Simple conditions → and-combination tree.
 * Empty array → literal true (always true).
 */
export function compileSimpleConditions(
  conds: SimpleCondition[],
  logic: 'AND' | 'OR' = 'AND',
): ExprNode {
  if (conds.length === 0) return literal(true);
  const nodes = conds.map(compileSimpleCondition);
  if (nodes.length === 1) return nodes[0];
  return { type: logic === 'OR' ? 'or' : 'and', args: nodes };
}
