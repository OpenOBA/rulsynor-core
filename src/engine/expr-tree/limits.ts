/**
 * limits — resource limit check (SPEC §10 E4)
 *
 * Hard resource quotas against expression-tree bloat attacks:
 * - arithmetic depth ≤ 2
 * - tree depth ≤ 6
 * - node count ≤ 64
 * - array ≤ 10000
 * - per-rule evaluation ≤ 50ms
 * - quantifier must not nest
 * - regex step count ≤ 10000 (see safe-regex)
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

import type { ExprNode } from './node-types.js';

export const LIMITS = {
  MAX_ARITH_DEPTH: 2,
  MAX_TREE_DEPTH: 6,
  MAX_NODES: 64,
  MAX_ARRAY_LENGTH: 10000,
  MAX_EVAL_MS: 50,
  MAX_REGEX_STEPS: 10000,
};

export class ExprLimitError extends Error {
  constructor(message: string) {
    super(`[ExprLimit] ${message}`);
    this.name = 'ExprLimitError';
  }
}

/** Count the tree's node count, depth, and arithmetic depth */
export function measure(
  node: ExprNode,
  depth = 0,
  arithDepth = 0,
): { nodes: number; depth: number; arithDepth: number } {
  let nodes = 1;
  let maxDepth = depth;
  let maxArithDepth = arithDepth;
  const curArith = node.type === 'arith' ? arithDepth + 1 : arithDepth;
  if (node.type === 'arith') maxArithDepth = Math.max(maxArithDepth, curArith);

  const children = childNodes(node);
  for (const child of children) {
    const m = measure(child, depth + 1, curArith);
    nodes += m.nodes;
    maxDepth = Math.max(maxDepth, m.depth);
    maxArithDepth = Math.max(maxArithDepth, m.arithDepth);
  }
  return { nodes, depth: maxDepth, arithDepth: maxArithDepth };
}

/** Validate whether the tree exceeds limits; throws ExprLimitError when exceeded */
export function enforceLimits(root: ExprNode): void {
  const { nodes, depth, arithDepth } = measure(root);
  if (nodes > LIMITS.MAX_NODES) {
    throw new ExprLimitError(`node count ${nodes} exceeds the limit ${LIMITS.MAX_NODES}`);
  }
  if (depth > LIMITS.MAX_TREE_DEPTH) {
    throw new ExprLimitError(`tree depth ${depth} exceeds the limit ${LIMITS.MAX_TREE_DEPTH}`);
  }
  if (arithDepth > LIMITS.MAX_ARITH_DEPTH) {
    throw new ExprLimitError(
      `arithmetic depth ${arithDepth} exceeds the limit ${LIMITS.MAX_ARITH_DEPTH}`,
    );
  }
  // E4: array literal length ≤ 10000 (§10.2)
  const arrLen = maxArrayLength(root);
  if (arrLen > LIMITS.MAX_ARRAY_LENGTH) {
    throw new ExprLimitError(`array length ${arrLen} exceeds the limit ${LIMITS.MAX_ARRAY_LENGTH}`);
  }
  // E4: quantifier must not nest (§10.2)
  if (hasNestedQuantifier(root)) {
    throw new ExprLimitError(
      'quantifier must not nest: the quantifier predicate must not contain another quantifier',
    );
  }
}

/** Traverse the tree, return the max array literal length */
function maxArrayLength(node: ExprNode): number {
  let max = 0;
  const walk = (n: ExprNode): void => {
    if (n.type === 'literal' && Array.isArray(n.value)) max = Math.max(max, n.value.length);
    for (const c of childNodes(n)) walk(c);
  };
  walk(node);
  return max;
}

/** Check whether quantifiers are nested (a quantifier predicate subtree containing another quantifier) */
function hasNestedQuantifier(root: ExprNode): boolean {
  const walk = (n: ExprNode, insideQuantifier: boolean): boolean => {
    if (n.type === 'quantifier') {
      if (insideQuantifier) return true;
      if (walk(n.predicate, true)) return true;
      if (walk(n.over, false)) return true;
      return false;
    }
    for (const c of childNodes(n)) {
      if (walk(c, insideQuantifier)) return true;
    }
    return false;
  };
  return walk(root, false);
}

/** Get all child nodes of a node */
export function childNodes(node: ExprNode): ExprNode[] {
  switch (node.type) {
    case 'field':
    case 'var':
    case 'literal':
      return [];
    case 'and':
    case 'or':
      return node.args;
    case 'not':
      return [node.arg];
    case 'compare':
      return [node.left, node.right];
    case 'in':
      return [node.left, node.right];
    case 'string':
      return [node.left, node.right];
    case 'exists':
      return [node.arg];
    case 'length':
      return [node.arg];
    case 'between':
      return [node.value, node.min, node.max];
    case 'quantifier':
      return [node.over, node.predicate];
    case 'arith':
      return node.args;
    case 'days_between':
      return [node.from, node.to];
    case 'epoch_ms':
      return [node.arg];
    case 'date_add':
      return [node.base, node.amount];
    case 'date_part':
      return [node.arg];
    case 'month_last_day':
      return [node.arg];
    case 'aggregate':
      return [node.over];
  }
}
