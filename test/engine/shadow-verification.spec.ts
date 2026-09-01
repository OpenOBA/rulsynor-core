/**
 * 影子验证等价测试 — 旧 evaluator（平铺）vs 表达式树内核（归一前对照）
 *
 * 目的：验证「rule-definition 平铺条件 → 树编译 → 树求值」与
 * 旧 Evaluator.evaluate 的「条件求值」在单规则粒度上等价。
 * 这是归一（替换条件求值层）的前置安全网。
 */

import { Evaluator } from '../../src/engine/evaluator.js'
import { ExprTreeEvaluator, objectContext } from '../../src/engine/expr-tree/evaluator.js'
import { ruleWhenToExpr } from '../../src/engine/expr-tree/rule-to-expr.js'
import type { RuleDefinition } from '../../src/engine/rule-definition.js'

const oldEvaluator = new Evaluator()
const treeEvaluator = new ExprTreeEvaluator()

/** 构造一个单规则（conditions + conditionLogic），decision 用 DENY 以便区分「匹配」与「未匹配」 */
function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'TEST-001',
    name: 'Test Rule',
    description: 'test',
    category: 'custom',
    conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
    conditionLogic: 'AND',
    action: { decision: 'DENY', reason: 'test' },
    priority: 100,
    enabled: true,
    ...overrides,
  }
}

/**
 * 判断旧 evaluator 对单规则是否「命中」（条件匹配）。
 * 注意：旧 evaluator 有 override/ring 逻辑，但单规则 DENY 时，
 * decision === 'DENY' 等价于「条件匹配」。
 */
function oldMatches(rule: RuleDefinition, context: Record<string, unknown>): boolean {
  const result = oldEvaluator.evaluate([rule], context)
  return result.decision === 'DENY'
}

/** 判断新内核对单规则是否「条件匹配」 */
function treeMatches(rule: RuleDefinition, context: Record<string, unknown>): boolean {
  const tree = ruleWhenToExpr(rule)
  if (tree === null) return false // 含非纯条件，无法验证
  const r = treeEvaluator.evaluate(tree, objectContext(context))
  return r.value === true
}

describe('影子验证：旧 evaluator vs 表达式树内核（单规则等价）', () => {
  const cases: Array<{ name: string; rule: RuleDefinition; context: Record<string, unknown> }> = [
    {
      name: 'eq 匹配',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }] }),
      context: { 'tool.name': 'exec' },
    },
    {
      name: 'eq 不匹配',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }] }),
      context: { 'tool.name': 'read_file' },
    },
    {
      name: 'gt 匹配',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'amount', operator: 'gt', value: 100 }] }),
      context: { 'tool.name': 'exec', amount: 150 },
    },
    {
      name: 'in 匹配',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'cat', operator: 'in', value: ['a', 'b'] }] }),
      context: { 'tool.name': 'exec', cat: 'a' },
    },
    {
      name: 'contains 匹配',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'cmd', operator: 'contains', value: 'rm' }] }),
      context: { 'tool.name': 'exec', cmd: 'rm -rf /' },
    },
    {
      name: 'AND 多条件匹配',
      rule: makeRule({
        conditions: [
          { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' },
          { kind: 'context_matches', field: 'amount', operator: 'gt', value: 100 },
        ],
      }),
      context: { 'tool.name': 'exec', amount: 150 },
    },
    {
      name: 'OR 多条件（一个满足）',
      rule: makeRule({
        conditionLogic: 'OR',
        conditions: [
          { kind: 'context_matches', field: 'status', operator: 'eq', value: 'done' },
          { kind: 'context_matches', field: 'status', operator: 'eq', value: 'archived' },
        ],
      }),
      context: { 'tool.name': 'exec', status: 'archived' },
    },
    {
      name: 'exists 字段存在',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'agent.id', operator: 'exists' }] }),
      context: { 'tool.name': 'exec', 'agent.id': 'did:erdl:xxx' },
    },
    {
      name: '字段缺失（空值传播）',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'agent.id', operator: 'exists' }] }),
      context: { 'tool.name': 'exec' },
    },
    {
      name: 'eq 对象深比较（JSON.stringify 相等）',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'meta', operator: 'eq', value: { a: 1, b: 2 } }] }),
      context: { 'tool.name': 'exec', meta: { a: 1, b: 2 } },
    },
    {
      name: 'contains 对象深度搜索',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'tool.args', operator: 'contains', value: 'passwd' }] }),
      context: { 'tool.name': 'exec', 'tool.args': { path: '/etc/passwd', flag: '-l' } },
    },
    {
      name: 'match 大小写不敏感（对齐旧 i flag）',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'cmd', operator: 'match', value: 'DROP' }] }),
      context: { 'tool.name': 'exec', cmd: 'drop table users' },
    },
    {
      name: 'gt 字符串字典序（对齐旧 string vs string）',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'ver', operator: 'gt', value: '1.0' }] }),
      context: { 'tool.name': 'exec', ver: '1.2' },
    },
    {
      name: 'lt 字符串字典序',
      rule: makeRule({ conditions: [{ kind: 'context_matches', field: 'ver', operator: 'lt', value: '2.0' }] }),
      context: { 'tool.name': 'exec', ver: '1.5' },
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const oldR = oldMatches(c.rule, c.context)
      const treeR = treeMatches(c.rule, c.context)
      expect(treeR).toBe(oldR)
    })
  }
})

/**
 * 有意偏离旧 evaluator bug 的正确语义（归一 review，2026-08-15）
 * 这些 case 里旧 evaluator 的行为是 bug，新内核修正为标准语义。
 * 不用断言「新旧等价」，而是断言「新内核正确」。
 */
describe('新内核正确语义（有意偏离旧 bug）', () => {
  it('ne 与 eq 互补：对象同内容时 ne 应 false（旧 evaluator 的 ne 用引用比较，不互补）', () => {
    const rule = makeRule({ conditions: [{ kind: 'context_matches', field: 'meta', operator: 'ne', value: { a: 1, b: 2 } }] })
    // 新内核：对象同内容 → deep 相等 → ne 应为 false（规则不命中）
    expect(treeMatches(rule, { 'tool.name': 'exec', meta: { a: 1, b: 2 } })).toBe(false)
  })
  it('starts_with 严格要求 string value（旧 evaluator 做 String 隐式转换）', () => {
    const rule = makeRule({ conditions: [{ kind: 'context_matches', field: 's', operator: 'starts_with', value: 123 as any }] })
    // 新内核：value 非 string → 不匹配（严格类型，不做隐式 String 转换）
    expect(treeMatches(rule, { 'tool.name': 'exec', s: '123abc' })).toBe(false)
  })
})

