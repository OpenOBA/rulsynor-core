/**
 * grade + fn-registry 单测 — SPEC v1.2 §16（函数委派 + 规则分级）
 */

import { deriveGradeFromTree } from '../../src/engine/expr-tree/grade.js'
import { compileSimpleCondition } from '../../src/engine/expr-tree/simple-compiler.js'
import { ERDLFnRegistry } from '../../src/engine/fn-registry.js'
import type { ExprNode } from '../../src/engine/expr-tree/node-types.js'

describe('grade — 规则分级（§16.2）', () => {
  it('纯 Simple 条件 → Grade A', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 })
    expect(deriveGradeFromTree(tree, false)).toBe('A')
  })
  it('含算术节点 → Grade B', () => {
    const tree: ExprNode = {
      type: 'compare', op: 'gt',
      left: { type: 'arith', op: 'mul', args: [{ type: 'field', field: 'a' }, { type: 'field', field: 'b' }] },
      right: { type: 'literal', value: 100 },
    }
    expect(deriveGradeFromTree(tree, false)).toBe('B')
  })
  it('含量词 → Grade B', () => {
    const tree: ExprNode = {
      type: 'quantifier', kind: 'all', binding: 'x',
      over: { type: 'field', field: 'items' },
      predicate: { type: 'compare', op: 'gt', left: { type: 'var', path: 'x' }, right: { type: 'literal', value: 0 } },
    }
    expect(deriveGradeFromTree(tree, false)).toBe('B')
  })
  it('含函数委派 → Grade C', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 })
    expect(deriveGradeFromTree(tree, true)).toBe('C')
  })
  it('含聚合 → Grade B', () => {
    const tree: ExprNode = {
      type: 'compare', op: 'gt',
      left: { type: 'aggregate', fn: 'count', over: { type: 'field', field: 'items' } },
      right: { type: 'literal', value: 3 },
    }
    expect(deriveGradeFromTree(tree, false)).toBe('B')
  })
  it('嵌套：and 内含算术子树 → Grade B', () => {
    const tree: ExprNode = {
      type: 'and',
      args: [
        compileSimpleCondition({ field: 'age', operator: 'gt', value: 16 }),
        { type: 'arith', op: 'add', args: [{ type: 'literal', value: 1 }, { type: 'literal', value: 2 }] },
      ],
    }
    expect(deriveGradeFromTree(tree, false)).toBe('B')
  })
})

describe('fn-registry — §16.1 确定性豁免声明', () => {
  it('未声明 deterministic → isDeterministic false', () => {
    const reg = new ERDLFnRegistry()
    reg.register({ signature: { name: 'f', signature: 'f() → number', params: [], returns: 'number' }, impl: () => 1 })
    expect(reg.isDeterministic('f')).toBe(false)
  })
  it('声明 deterministic → isDeterministic true', () => {
    const reg = new ERDLFnRegistry()
    reg.register({ signature: { name: 'f', signature: 'f() → number', params: [], returns: 'number' }, impl: () => 1, deterministic: true })
    expect(reg.isDeterministic('f')).toBe(true)
  })
  it('未注册函数 → invoke 抛错（注册制）', async () => {
    const reg = new ERDLFnRegistry()
    await expect(reg.invoke('nonexistent')).rejects.toThrow('not registered')
  })
  it('未注册函数 → isDeterministic false', () => {
    const reg = new ERDLFnRegistry()
    expect(reg.isDeterministic('nonexistent')).toBe(false)
  })
})
