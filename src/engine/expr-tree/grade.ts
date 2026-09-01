/**
 * grade — 规则分级（SPEC v2.0 §16.2）
 *
 * Grade 决定审计强度与可重算性声明；Grade 元数据走扩展字段，不进核心冻结字段。
 *
 * | Grade | 表达方式 | 审计 SLA |
 * |:---:|------|------|
 * | A | 纯 Simple（28 条件运算符） | 最高，同级文本可重算 |
 * | B | Expression 树（完整内核：量词/算术/聚合/时间） | 高，eval_trace MUST |
 * | C | 含函数委派 | 分层，C 级不得冒充纯文本可重算 |
 *
 * Grade 由规则内容【推导】而来，非手动标注：
 * - 用了函数委派 → C
 * - 用了 Simple 28 条件运算符之外的内核节点（算术/量词/聚合/时间） → B
 * - 仅用 Simple 28 条件运算符 → A
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type { ExprNode } from './node-types.js';
import { childNodes } from './limits.js';

export type RuleGrade = 'A' | 'B' | 'C';

/** Simple 28 条件运算符对应的节点类型（无算术/量词/聚合/时间扩展） */
const SIMPLE_ONLY_NODE_TYPES = new Set<ExprNode['type']>([
  'field',
  'var',
  'literal',
  'and',
  'or',
  'not',
  'compare',
  'in',
  'string',
  'exists',
  'length',
  'between',
]);

/**
 * 推导表达式树的 Grade（不含函数委派判断，函数委派由外部传入 hasFnDelegation）。
 * - 含函数委派 → C
 * - 含扩展节点（算术/量词/聚合/时间）→ B
 * - 仅 Simple 节点 → A
 */
export function deriveGradeFromTree(root: ExprNode, hasFnDelegation: boolean): RuleGrade {
  if (hasFnDelegation) return 'C';
  if (treeUsesExtensionNodes(root)) return 'B';
  return 'A';
}

/** 判断树是否用了 Simple 之外的内核扩展节点（算术/量词/聚合/时间） */
function treeUsesExtensionNodes(node: ExprNode): boolean {
  // 根节点若为扩展类型 → true
  if (!SIMPLE_ONLY_NODE_TYPES.has(node.type)) return true;
  // 递归检查子节点
  const children = childNodes(node);
  for (const child of children) {
    if (treeUsesExtensionNodes(child)) return true;
  }
  return false;
}

/** Grade 的审计 SLA 提示（用于文档/展示） */
export const GRADE_AUDIT_SLA: Record<RuleGrade, string> = {
  A: '最高：同级文本可重算',
  B: '高：eval_trace MUST',
  C: '分层：C 级不得冒充纯文本可重算',
};
