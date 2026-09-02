/**
 * decision-table — decision-table projection (SPEC v2.0 §13)
 *
 * A decision table is a matrix form (rows = condition combinations, columns = condition
 * dimensions), for pricing/approval/discount rules written by business/finance people.
 * Compiled to the same kernel (expression tree) — each row's condition combination compiles
 * to an and tree; row semantics are explained below.
 *
 * SPEC §13 only defines the property "matrix form, compiled to the same kernel", not the
 * concrete row/column syntax. This implementation uses standard decision-table semantics
 * (DMN simplified) and [explicitly annotates] this structural convention, to avoid dangling:
 * - column = condition field (column name)
 * - row = the column's condition value (all conditions in a row are AND-ed)
 * - one decision (action) per row
 * - row hit strategy: single hit (first match), selected by priority by the caller
 *
 * The compile output is a list of "row → { condition tree (ExprNode) + decision }"; each row's
 * condition tree is an and-combination of the same expression-tree kernel — this is the concrete
 * implementation of "compiled to the same kernel".
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

import type { ExprNode } from './node-types.js';
import { compileSimpleCondition } from './simple-compiler.js';

/** Decision table (matrix form) */
export interface DecisionTable {
  /** Condition columns (field names) */
  columns: string[];
  /** Rows: each row is condition values + decision */
  rows: DecisionTableRow[];
}

/** One row of a decision table */
export interface DecisionTableRow {
  /** Condition values for each column of this row (key=column name, value=expected value; missing column = unconstrained) */
  conditions: Record<string, unknown>;
  /** The row's decision (action) */
  decision: string;
  /** Priority (under single-hit, first match wins) */
  priority?: number;
}

/** Compile output: one row → condition tree + decision */
export interface CompiledDecisionRow {
  /** The expression tree compiled from this row's conditions (and-combination) */
  expr: ExprNode;
  /** This row's decision */
  decision: string;
  /** Priority */
  priority: number;
}

export class DecisionTableError extends Error {
  constructor(message: string) {
    super(`[DecisionTable] ${message}`);
    this.name = 'DecisionTableError';
  }
}

/**
 * Compile a decision table → a list of row condition trees.
 * Each row's conditions compile to an and tree (all non-null conditions as eq), one decision per row.
 */
export function compileDecisionTable(table: DecisionTable): CompiledDecisionRow[] {
  if (!table.columns || table.columns.length === 0) {
    throw new DecisionTableError('decision table must have at least one column');
  }
  if (!table.rows || table.rows.length === 0) {
    throw new DecisionTableError('decision table must have at least one row');
  }

  return table.rows.map((row, idx) => {
    const conds: ExprNode[] = [];
    for (const col of table.columns) {
      const value = row.conditions[col];
      if (value === undefined) continue; // this column is unconstrained
      conds.push(compileSimpleCondition({ field: col, operator: 'eq', value }));
    }
    if (conds.length === 0) {
      throw new DecisionTableError(`row ${idx + 1} has no condition constraint`);
    }
    const expr: ExprNode = conds.length === 1 ? conds[0] : { type: 'and', args: conds };
    return {
      expr,
      decision: row.decision,
      priority: row.priority ?? idx, // defaults to row order
    };
  });
}
