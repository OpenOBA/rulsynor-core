/**
 * simple-compiler 单测 — SPEC v1.2 §11（30 运算符 → 表达式树）
 *
 * 覆盖：
 * - 30 运算符全量编译映射（无悬空）
 * - 等价验证：编译进树 → 求值 == 平铺运算符语义
 * - and/or 组合
 */

import { compileSimpleCondition, compileSimpleConditions, type SimpleOperator } from '../../src/engine/expr-tree/simple-compiler.js'
import { ExprTreeEvaluator, objectContext } from '../../src/engine/expr-tree/evaluator.js'
import { hashTree } from '../../src/engine/expr-tree/canonical.js'

const ev = new ExprTreeEvaluator()

function evaluateSimple(field: string, operator: SimpleOperator, value: unknown, context: Record<string, unknown>): boolean {
  const tree = compileSimpleCondition({ field, operator, value })
  const r = ev.evaluate(tree, objectContext(context))
  return r.value === true
}

describe('Simple 编译器 — 30 运算符全量映射', () => {
  // ── 比较 6 ──
  it('eq / ne', () => {
    expect(evaluateSimple('age', 'eq', 35, { age: 35 })).toBe(true)
    expect(evaluateSimple('age', 'eq', 35, { age: 36 })).toBe(false)
    expect(evaluateSimple('age', 'ne', 35, { age: 36 })).toBe(true)
  })
  it('gt / gte / lt / lte', () => {
    expect(evaluateSimple('age', 'gt', 60, { age: 61 })).toBe(true)
    expect(evaluateSimple('age', 'gte', 60, { age: 60 })).toBe(true)
    expect(evaluateSimple('age', 'lt', 60, { age: 59 })).toBe(true)
    expect(evaluateSimple('age', 'lte', 60, { age: 60 })).toBe(true)
  })

  // ── 列表 2 ──
  it('in / not_in', () => {
    expect(evaluateSimple('cat', 'in', ['a', 'b'], { cat: 'a' })).toBe(true)
    expect(evaluateSimple('cat', 'in', ['a', 'b'], { cat: 'c' })).toBe(false)
    expect(evaluateSimple('cat', 'not_in', ['a', 'b'], { cat: 'c' })).toBe(true)
  })

  // ── 字符串 5 ──
  it('contains / not_contains', () => {
    expect(evaluateSimple('cmd', 'contains', 'rm', { cmd: 'rm -rf /' })).toBe(true)
    expect(evaluateSimple('cmd', 'not_contains', 'rm', { cmd: 'ls' })).toBe(true)
  })
  it('starts_with / ends_with / not_starts_with / not_ends_with', () => {
    expect(evaluateSimple('path', 'starts_with', '/etc', { path: '/etc/nginx' })).toBe(true)
    expect(evaluateSimple('path', 'ends_with', '.conf', { path: '/etc/nginx.conf' })).toBe(true)
    expect(evaluateSimple('path', 'not_starts_with', '/tmp', { path: '/etc/nginx' })).toBe(true)
    expect(evaluateSimple('path', 'not_ends_with', '.log', { path: '/etc/nginx.conf' })).toBe(true)
  })
  it('match', () => {
    expect(evaluateSimple('cmd', 'match', '^(rm|sudo)$', { cmd: 'rm' })).toBe(true)
  })

  // ── 存在 2 ──
  it('exists / not_exists', () => {
    expect(evaluateSimple('x', 'exists', undefined, { x: 1 })).toBe(true)
    expect(evaluateSimple('x', 'exists', undefined, {})).toBe(false)
    expect(evaluateSimple('x', 'not_exists', undefined, {})).toBe(true)
  })

  // ── 长度 5 ──
  it('length_gt / gte / lt / lte / eq', () => {
    expect(evaluateSimple('s', 'length_gt', 2, { s: 'abc' })).toBe(true)
    expect(evaluateSimple('s', 'length_gte', 3, { s: 'abc' })).toBe(true)
    expect(evaluateSimple('s', 'length_lt', 4, { s: 'abc' })).toBe(true)
    expect(evaluateSimple('s', 'length_lte', 3, { s: 'abc' })).toBe(true)
    expect(evaluateSimple('s', 'length_eq', 3, { s: 'abc' })).toBe(true)
  })

  // ── 范围 2 ──
  it('between / not_between', () => {
    expect(evaluateSimple('age', 'between', [16, 60], { age: 30 })).toBe(true)
    expect(evaluateSimple('age', 'between', [16, 60], { age: 70 })).toBe(false)
    expect(evaluateSimple('age', 'not_between', [16, 60], { age: 70 })).toBe(true)
  })

  // ── 计数 4 ──
  it('count_gt / gte / lt / lte（数组计数）', () => {
    expect(evaluateSimple('items', 'count_gt', 2, { items: [1, 2, 3] })).toBe(true)
    expect(evaluateSimple('items', 'count_gte', 3, { items: [1, 2, 3] })).toBe(true)
    expect(evaluateSimple('items', 'count_lt', 4, { items: [1, 2, 3] })).toBe(true)
    expect(evaluateSimple('items', 'count_lte', 3, { items: [1, 2, 3] })).toBe(true)
  })
  it('count_* 对非数组/缺失字段 → false（自洽边界）', () => {
    // 字段缺失
    expect(evaluateSimple('items', 'count_gt', 0, {})).toBe(false)
    // 字段是标量（非数组）
    expect(evaluateSimple('items', 'count_gt', 0, { items: 'not-array' })).toBe(false)
  })
})

describe('Simple 编译器 — 组合', () => {
  it('单条件 → 直接返回该节点', () => {
    const tree = compileSimpleConditions([{ field: 'age', operator: 'gt', value: 60 }])
    expect(tree.type).toBe('compare')
  })
  it('多条件 AND → and 树', () => {
    const conds = [
      { field: 'age', operator: 'gt' as const, value: 16 },
      { field: 'age', operator: 'lt' as const, value: 60 },
    ]
    const tree = compileSimpleConditions(conds, 'AND')
    expect(tree.type).toBe('and')
    const r = ev.evaluate(tree, objectContext({ age: 30 }))
    expect(r.value).toBe(true)
  })
  it('多条件 OR → or 树', () => {
    const conds = [
      { field: 'status', operator: 'eq' as const, value: 'done' },
      { field: 'status', operator: 'eq' as const, value: 'archived' },
    ]
    const tree = compileSimpleConditions(conds, 'OR')
    expect(tree.type).toBe('or')
    const r = ev.evaluate(tree, objectContext({ status: 'archived' }))
    expect(r.value).toBe(true)
  })
  it('编译进树后哈希稳定（同一条件 → 同一哈希）', () => {
    const a = compileSimpleCondition({ field: 'age', operator: 'gt', value: 60 })
    const b = compileSimpleCondition({ field: 'age', operator: 'gt', value: 60 })
    expect(hashTree(a)).toBe(hashTree(b))
  })
})
