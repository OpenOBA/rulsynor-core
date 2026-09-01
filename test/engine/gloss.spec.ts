/**
 * gloss 单测 — SPEC v1.2 §14（G1 确定性渲染 + G3 display_name + 双语）
 */

import { renderNode, renderGloss } from '../../src/engine/expr-tree/gloss.js'
import { compileSimpleCondition } from '../../src/engine/expr-tree/simple-compiler.js'
import type { ExprNode } from '../../src/engine/expr-tree/node-types.js'

describe('gloss — 节点渲染（G1 确定性）', () => {
  it('literal 渲染', () => {
    const n: ExprNode = { type: 'literal', value: 42 }
    expect(renderNode(n, 'zh')).toBe('42')
    expect(renderNode({ type: 'literal', value: 'abc' }, 'zh')).toBe('"abc"')
  })
  it('field 渲染（fallback 用字段名）', () => {
    const n: ExprNode = { type: 'field', field: 'age' }
    expect(renderNode(n, 'zh')).toBe('age')
  })
  it('compare 渲染中文', () => {
    const n: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    expect(renderNode(n, 'zh')).toBe('age 大于 60')
  })
  it('compare 渲染英文', () => {
    const n: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    expect(renderNode(n, 'en')).toBe('age is greater than 60')
  })
  it('and 组合渲染', () => {
    const n: ExprNode = {
      type: 'and',
      args: [
        { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 16 } },
        { type: 'compare', op: 'lt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } },
      ],
    }
    expect(renderNode(n, 'zh')).toBe('age 大于 16，age 小于 60')
  })
  it('between 渲染体现闭区间（含端点，无「之间」歧义）', () => {
    const n: ExprNode = { type: 'between', value: { type: 'field', field: 'age' }, min: { type: 'literal', value: 16 }, max: { type: 'literal', value: 60 } }
    expect(renderNode(n, 'zh')).toContain('闭区间')
    expect(renderNode(n, 'en')).toContain('inclusive')
  })
  it('quantifier any 渲染消歧（at least one，非模糊 any）', () => {
    const n: ExprNode = {
      type: 'quantifier', kind: 'any', binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: { type: 'compare', op: 'gt', left: { type: 'var', path: 'x' }, right: { type: 'literal', value: 0 } },
    }
    expect(renderNode(n, 'en')).toContain('at least one')
  })
})

describe('gloss — SPEC §14 示例对照', () => {
  it('lt(div(sub(price,cost),price), 0.15) 渲染', () => {
    const node: ExprNode = {
      type: 'compare', op: 'lt',
      left: {
        type: 'arith', op: 'div',
        args: [
          { type: 'arith', op: 'sub', args: [{ type: 'field', field: 'tool.args.price' }, { type: 'field', field: 'context.cost' }] },
          { type: 'field', field: 'tool.args.price' },
        ],
      },
      right: { type: 'literal', value: 0.15 },
    }
    const cond = renderNode(node, 'zh')
    // 验证包含关键片段（不逐字对比，因运算符符号选择可微调）
    expect(cond).toContain('除以')
    expect(cond).toContain('0.15')
    expect(cond).toContain('小于')
  })
})

describe('gloss — G3 display_name', () => {
  it('字段用 display_name 替换', () => {
    const n: ExprNode = { type: 'compare', op: 'eq', left: { type: 'field', field: 'is_retired' }, right: { type: 'literal', value: true } }
    const fieldNames = { is_retired: '已退休' }
    expect(renderNode(n, 'zh', fieldNames)).toBe('已退休 等于 true')
  })
  it('无 display_name 时 fallback 原始字段名', () => {
    const n: ExprNode = { type: 'field', field: 'unknown_field' }
    expect(renderNode(n, 'zh', {})).toBe('unknown_field')
  })
})

describe('gloss — 完整 renderGloss（条件 + 决策）', () => {
  it('中文：当...时，需人工审批', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 })
    const gloss = renderGloss(tree, 'REQUEST_HUMAN', 'zh')
    expect(gloss).toBe('当 amount 大于 10000 时，需人工审批')
  })
  it('英文：When..., require human approval', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 })
    const gloss = renderGloss(tree, 'REQUEST_HUMAN', 'en')
    expect(gloss).toBe('When amount is greater than 10000, require human approval')
  })
})

describe('gloss — G1 确定性（同树同 gloss）', () => {
  it('同一条件两次渲染结果一致', () => {
    const tree1 = compileSimpleCondition({ field: 'age', operator: 'gt', value: 60 })
    const tree2 = compileSimpleCondition({ field: 'age', operator: 'gt', value: 60 })
    expect(renderGloss(tree1, 'DENY', 'zh')).toBe(renderGloss(tree2, 'DENY', 'zh'))
  })
})

describe('gloss — 优先级括号（消除 and/or 嵌套歧义）', () => {
  it('or 的子节点为 and → 加括号', () => {
    // or( and(A,B), C ) → (A，B)，或 C
    const tree: ExprNode = {
      type: 'or',
      args: [
        { type: 'and', args: [
          { type: 'literal', value: 'A' },
          { type: 'literal', value: 'B' },
        ] },
        { type: 'literal', value: 'C' },
      ],
    }
    expect(renderNode(tree, 'zh')).toBe('("A"，"B")，或 "C"')
  })
  it('and 的子节点为 or → 加括号', () => {
    // and( A, or(B,C) ) → A，(B，或 C)
    const tree: ExprNode = {
      type: 'and',
      args: [
        { type: 'literal', value: 'A' },
        { type: 'or', args: [
          { type: 'literal', value: 'B' },
          { type: 'literal', value: 'C' },
        ] },
      ],
    }
    expect(renderNode(tree, 'zh')).toBe('"A"，("B"，或 "C")')
  })
  it('同类嵌套（and 套 and）不加括号（结合律）', () => {
    const tree: ExprNode = {
      type: 'and',
      args: [
        { type: 'and', args: [{ type: 'literal', value: 'A' }, { type: 'literal', value: 'B' }] },
        { type: 'literal', value: 'C' },
      ],
    }
    expect(renderNode(tree, 'zh')).toBe('"A"，"B"，"C"')
  })
  it('not 的子节点为 and/or → 加括号（半角）', () => {
    const tree: ExprNode = {
      type: 'not',
      arg: { type: 'and', args: [{ type: 'literal', value: 'A' }, { type: 'literal', value: 'B' }] },
    }
    expect(renderNode(tree, 'zh')).toBe('非 ("A"，"B")')
  })
})
