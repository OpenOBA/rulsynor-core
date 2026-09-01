/**
 * s-expression + canonical 单测 — SPEC v1.2 §10.3 + §14 + §28
 *
 * 覆盖：
 * - S-expression 双向往返（TS 树 ↔ 键名式）
 * - SPEC §14 示例的精确序列化形态
 * - 规范化哈希一致性（结构等价 → 相同哈希）
 * - 数字规范化（整数不带小数点、浮点确定性、NFC）
 */

import { toSExpr, roundtrip } from '../../src/engine/expr-tree/s-expression.js'
import { hashTree, hashTreeWithPrefix, canonicalTree } from '../../src/engine/expr-tree/canonical.js'
import type { ExprNode } from '../../src/engine/expr-tree/node-types.js'

describe('S-expression 双向往返', () => {
  it('compare 节点 roundtrip', () => {
    const node: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    expect(roundtrip(node)).toEqual(node)
  })
  it('arith 嵌套 roundtrip', () => {
    const node: ExprNode = {
      type: 'arith', op: 'div',
      args: [
        { type: 'arith', op: 'sub', args: [{ type: 'field', field: 'a' }, { type: 'field', field: 'b' }] },
        { type: 'field', field: 'c' },
      ],
    }
    expect(roundtrip(node)).toEqual(node)
  })
  it('quantifier roundtrip', () => {
    const node: ExprNode = {
      type: 'quantifier', kind: 'all', binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: { type: 'compare', op: 'gt', left: { type: 'var', path: 'x' }, right: { type: 'literal', value: 0 } },
    }
    expect(roundtrip(node)).toEqual(node)
  })
})

describe('S-expression 精确形态（贴 SPEC §14）', () => {
  it('lt(div(sub(a,b),c), 0.15) 序列化为键名式', () => {
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
    const sexpr = toSExpr(node)
    expect(sexpr).toEqual({
      lt: [
        { div: [
          { sub: [{ field: 'tool.args.price' }, { field: 'context.cost' }] },
          { field: 'tool.args.price' },
        ]},
        0.15,
      ],
    })
  })
  it('literal 裸值，field 对象（贴 SPEC）', () => {
    const literal: ExprNode = { type: 'literal', value: 42 }
    const field: ExprNode = { type: 'field', field: 'age' }
    expect(toSExpr(literal)).toBe(42)
    expect(toSExpr(field)).toEqual({ field: 'age' })
  })
})

describe('规范化树哈希（§10.3 + §28）', () => {
  it('结构等价的两棵树 → 相同哈希', () => {
    const a: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    // 同一棵树，roundtrip 后哈希应不变
    const b = roundtrip(a)
    expect(hashTree(a)).toBe(hashTree(b))
  })
  it('不同树 → 不同哈希', () => {
    const a: ExprNode = { type: 'compare', op: 'gt', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    const b: ExprNode = { type: 'compare', op: 'gte', left: { type: 'field', field: 'age' }, right: { type: 'literal', value: 60 } }
    expect(hashTree(a)).not.toBe(hashTree(b))
  })
  it('整数 2 与浮点 2.0 → 相同哈希（同一 IEEE754 值）', () => {
    const a: ExprNode = { type: 'literal', value: 2 }
    const b: ExprNode = { type: 'literal', value: 2.0 }
    expect(hashTree(a)).toBe(hashTree(b))
  })
  it('NFC 字符串规范化：é 与 e+组合符 → 相同哈希', () => {
    const composed: ExprNode = { type: 'literal', value: 'café' }
    const decomposed: ExprNode = { type: 'literal', value: 'cafe\u0301' } // e + 组合符
    expect(hashTree(composed)).toBe(hashTree(decomposed))
  })
  it('类型不混淆：number 与 string 字面量哈希不同（严格类型）', () => {
    const num2: ExprNode = { type: 'literal', value: 2 }
    const str2: ExprNode = { type: 'literal', value: '2' }
    const num15: ExprNode = { type: 'literal', value: 1.5 }
    const str15: ExprNode = { type: 'literal', value: '1.5' }
    const boolTrue: ExprNode = { type: 'literal', value: true }
    const strTrue: ExprNode = { type: 'literal', value: 'true' }
    expect(hashTree(num2)).not.toBe(hashTree(str2))
    expect(hashTree(num15)).not.toBe(hashTree(str15))
    expect(hashTree(boolTrue)).not.toBe(hashTree(strTrue))
  })
  it('带 sha256: 前缀', () => {
    const node: ExprNode = { type: 'literal', value: 1 }
    expect(hashTreeWithPrefix(node)).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})

describe('canonicalTree JCS 字节序列', () => {
  it('输出确定性字节（对象键字典序）', () => {
    const node: ExprNode = { type: 'compare', op: 'eq', left: { type: 'field', field: 'x' }, right: { type: 'field', field: 'y' } }
    const c1 = canonicalTree(node)
    const c2 = canonicalTree(roundtrip(node))
    expect(c1).toBe(c2)
  })
})
