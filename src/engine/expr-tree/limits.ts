/**
 * limits — 资源上限检查（SPEC v2.0 §10 E4）
 *
 * 防表达式树膨胀攻击的硬性资源配额：
 * - 算术深度 ≤ 2
 * - 树深 ≤ 6
 * - 节点数 ≤ 64
 * - 数组 ≤ 10000
 * - 单规则求值 ≤ 50ms
 * - 量词不嵌套
 * - 正则步数 ≤ 10000（见 safe-regex）
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type { ExprNode } from './node-types.js'

export const LIMITS = {
  MAX_ARITH_DEPTH: 2,
  MAX_TREE_DEPTH: 6,
  MAX_NODES: 64,
  MAX_ARRAY_LENGTH: 10000,
  MAX_EVAL_MS: 50,
  MAX_REGEX_STEPS: 10000,
}

export class ExprLimitError extends Error {
  constructor(message: string) {
    super(`[ExprLimit] ${message}`)
    this.name = 'ExprLimitError'
  }
}

/** 统计树的节点数、深度、算术深度 */
export function measure(node: ExprNode, depth = 0, arithDepth = 0): { nodes: number; depth: number; arithDepth: number } {
  let nodes = 1
  let maxDepth = depth
  let maxArithDepth = arithDepth
  const curArith = node.type === 'arith' ? arithDepth + 1 : arithDepth
  if (node.type === 'arith') maxArithDepth = Math.max(maxArithDepth, curArith)

  const children = childNodes(node)
  for (const child of children) {
    const m = measure(child, depth + 1, curArith)
    nodes += m.nodes
    maxDepth = Math.max(maxDepth, m.depth)
    maxArithDepth = Math.max(maxArithDepth, m.arithDepth)
  }
  return { nodes, depth: maxDepth, arithDepth: maxArithDepth }
}

/** 校验树是否超限，超限抛 ExprLimitError */
export function enforceLimits(root: ExprNode): void {
  const { nodes, depth, arithDepth } = measure(root)
  if (nodes > LIMITS.MAX_NODES) {
    throw new ExprLimitError(`节点数 ${nodes} 超过上限 ${LIMITS.MAX_NODES}`)
  }
  if (depth > LIMITS.MAX_TREE_DEPTH) {
    throw new ExprLimitError(`树深 ${depth} 超过上限 ${LIMITS.MAX_TREE_DEPTH}`)
  }
  if (arithDepth > LIMITS.MAX_ARITH_DEPTH) {
    throw new ExprLimitError(`算术深度 ${arithDepth} 超过上限 ${LIMITS.MAX_ARITH_DEPTH}`)
  }
  // E4：数组字面量长度 ≤ 10000（§10.2）
  const arrLen = maxArrayLength(root)
  if (arrLen > LIMITS.MAX_ARRAY_LENGTH) {
    throw new ExprLimitError(`数组长度 ${arrLen} 超过上限 ${LIMITS.MAX_ARRAY_LENGTH}`)
  }
  // E4：量词不嵌套（§10.2）
  if (hasNestedQuantifier(root)) {
    throw new ExprLimitError('量词不嵌套：quantifier 谓词内不得再含量词')
  }
}

/** 遍历树，返回最大数组字面量长度 */
function maxArrayLength(node: ExprNode): number {
  let max = 0
  const walk = (n: ExprNode): void => {
    if (n.type === 'literal' && Array.isArray(n.value)) max = Math.max(max, n.value.length)
    for (const c of childNodes(n)) walk(c)
  }
  walk(node)
  return max
}

/** 检查量词是否嵌套（quantifier 的 predicate 子树内再含量词） */
function hasNestedQuantifier(root: ExprNode): boolean {
  const walk = (n: ExprNode, insideQuantifier: boolean): boolean => {
    if (n.type === 'quantifier') {
      if (insideQuantifier) return true
      if (walk(n.predicate, true)) return true
      if (walk(n.over, false)) return true
      return false
    }
    for (const c of childNodes(n)) {
      if (walk(c, insideQuantifier)) return true
    }
    return false
  }
  return walk(root, false)
}

/** 取节点的所有子节点 */
export function childNodes(node: ExprNode): ExprNode[] {
  switch (node.type) {
    case 'field':
    case 'var':
    case 'literal':
      return []
    case 'and':
    case 'or':
      return node.args
    case 'not':
      return [node.arg]
    case 'compare':
      return [node.left, node.right]
    case 'in':
      return [node.left, node.right]
    case 'string':
      return [node.left, node.right]
    case 'exists':
      return [node.arg]
    case 'length':
      return [node.arg]
    case 'between':
      return [node.value, node.min, node.max]
    case 'quantifier':
      return [node.over, node.predicate]
    case 'arith':
      return node.args
    case 'days_between':
      return [node.from, node.to]
    case 'epoch_ms':
      return [node.arg]
    case 'date_add':
      return [node.base, node.amount]
    case 'date_part':
      return [node.arg]
    case 'month_last_day':
      return [node.arg]
    case 'aggregate':
      return [node.over]
  }
}
