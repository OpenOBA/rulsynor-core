/**
 * decision-table — 决策表投影（SPEC v2.0 §13）
 *
 * 决策表是矩阵形态（行=条件组合，列=条件维度），面向业务/财务人员的定价、审批、折扣类规则。
 * 编译到同一内核（表达式树）——每行的条件组合编译为 and 树，行间语义见下方说明。
 *
 * SPEC §13 仅定义「矩阵形态，编译到同一内核」的性质，未定义具体行列语法。
 * 本实现采用标准决策表语义（DMN 简化），并【显式标注】此结构约定，避免悬空：
 * - 列 = 条件字段（列名）
 * - 行 = 该列的条件值（一行内所有条件 AND）
 * - 每行一个决策（action）
 * - 行间命中策略：单命中（first match），由调用方按优先级选择
 *
 * 编译产物是「行 → { 条件树(ExprNode) + 决策 }」的列表，
 * 每行的条件树是同一表达式树内核的 and 组合——这正是「编译到同一内核」的落地。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type { ExprNode } from './node-types.js';
import { compileSimpleCondition } from './simple-compiler.js';

/** 决策表（矩阵形态） */
export interface DecisionTable {
  /** 条件列（字段名） */
  columns: string[];
  /** 行：每行是 条件值 + 决策 */
  rows: DecisionTableRow[];
}

/** 决策表的一行 */
export interface DecisionTableRow {
  /** 该行各列的条件值（key=列名，value=期望值；缺失列=不约束） */
  conditions: Record<string, unknown>;
  /** 该行的决策（action） */
  decision: string;
  /** 优先级（单命中策略下，先匹配优先） */
  priority?: number;
}

/** 编译产物：一行 → 条件树 + 决策 */
export interface CompiledDecisionRow {
  /** 该行条件编译成的表达式树（and 组合） */
  expr: ExprNode;
  /** 该行决策 */
  decision: string;
  /** 优先级 */
  priority: number;
}

export class DecisionTableError extends Error {
  constructor(message: string) {
    super(`[DecisionTable] ${message}`);
    this.name = 'DecisionTableError';
  }
}

/**
 * 编译决策表 → 行条件树列表。
 * 每行的 conditions 编译为 and 树（所有非 null 条件 eq），一行一个决策。
 */
export function compileDecisionTable(table: DecisionTable): CompiledDecisionRow[] {
  if (!table.columns || table.columns.length === 0) {
    throw new DecisionTableError('决策表必须至少有一列');
  }
  if (!table.rows || table.rows.length === 0) {
    throw new DecisionTableError('决策表必须至少有一行');
  }

  return table.rows.map((row, idx) => {
    const conds: ExprNode[] = [];
    for (const col of table.columns) {
      const value = row.conditions[col];
      if (value === undefined) continue; // 该列不约束
      conds.push(compileSimpleCondition({ field: col, operator: 'eq', value }));
    }
    if (conds.length === 0) {
      throw new DecisionTableError(`第 ${idx + 1} 行没有任何条件约束`);
    }
    const expr: ExprNode = conds.length === 1 ? conds[0] : { type: 'and', args: conds };
    return {
      expr,
      decision: row.decision,
      priority: row.priority ?? idx, // 缺省按行序
    };
  });
}
