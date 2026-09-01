/**
 * grade — rule grading (SPEC v2.0 §16.2)
 *
 * Grade determines audit strength and recomputability declaration; Grade metadata goes through
 * extension fields, not into the core frozen fields.
 *
 * | Grade | Expression form | Audit SLA |
 * |:---:|------|------|
 * | A | pure Simple (28 condition operators) | highest, same-level text recomputable |
 * | B | Expression tree (full kernel: quantifier/arithmetic/aggregate/time) | high, eval_trace MUST |
 * | C | contains function delegation | layered, C must not masquerade as plain-text recomputable |
 *
 * Grade is [derived] from rule content, not manually annotated:
 * - uses function delegation → C
 * - uses kernel nodes beyond the Simple 28 condition operators (arithmetic/quantifier/aggregate/time) → B
 * - uses only the Simple 28 condition operators → A
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license MIT
 */

import type { ExprNode } from './node-types.js';
import { childNodes } from './limits.js';

export type RuleGrade = 'A' | 'B' | 'C';

/** Node types corresponding to the Simple 28 condition operators (no arithmetic/quantifier/aggregate/time extensions) */
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
 * Derive the Grade of an expression tree (excluding the function-delegation judgment, which is
 * passed in externally via hasFnDelegation).
 * - contains function delegation → C
 * - contains extension nodes (arithmetic/quantifier/aggregate/time) → B
 * - only Simple nodes → A
 */
export function deriveGradeFromTree(root: ExprNode, hasFnDelegation: boolean): RuleGrade {
  if (hasFnDelegation) return 'C';
  if (treeUsesExtensionNodes(root)) return 'B';
  return 'A';
}

/** Check whether the tree uses kernel extension nodes beyond Simple (arithmetic/quantifier/aggregate/time) */
function treeUsesExtensionNodes(node: ExprNode): boolean {
  // If the root is an extension type → true
  if (!SIMPLE_ONLY_NODE_TYPES.has(node.type)) return true;
  // Recursively check child nodes
  const children = childNodes(node);
  for (const child of children) {
    if (treeUsesExtensionNodes(child)) return true;
  }
  return false;
}

/** Grade audit SLA hint (for docs/display) */
export const GRADE_AUDIT_SLA: Record<RuleGrade, string> = {
  A: 'Highest: same-level text recomputable',
  B: 'High: eval_trace MUST',
  C: 'Layered: C must not masquerade as plain-text recomputable',
};
