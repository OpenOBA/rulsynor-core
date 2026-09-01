/**
 * decision-table 单测 — SPEC v1.2 §13（决策表投影 → 同一内核）
 */

import { compileDecisionTable, type DecisionTable } from '../../src/engine/expr-tree/decision-table.js'
import { ExprTreeEvaluator, objectContext } from '../../src/engine/expr-tree/evaluator.js'

const ev = new ExprTreeEvaluator()

describe('decision-table — 编译决策表到表达式树', () => {
  const table: DecisionTable = {
    columns: ['disease_category', 'share_count'],
    rows: [
      { conditions: { disease_category: '罕见重疾' }, decision: 'PAY 60000' },
      { conditions: { disease_category: '普通重疾' }, decision: 'PAY 30000' },
      { conditions: { disease_category: '一般轻症' }, decision: 'PAY 5000' },
    ],
  }

  it('编译出行数 = 决策表行数', () => {
    const rows = compileDecisionTable(table)
    expect(rows.length).toBe(3)
  })

  it('每行条件编译成 and/eq 树，能正确求值', () => {
    const rows = compileDecisionTable(table)
    // 第一行：disease_category eq 罕见重疾
    const r0 = ev.evaluate(rows[0].expr, objectContext({ disease_category: '罕见重疾' }))
    expect(r0.value).toBe(true)
    const r0Miss = ev.evaluate(rows[0].expr, objectContext({ disease_category: '普通重疾' }))
    expect(r0Miss.value).toBe(false)
  })

  it('多列条件行 → and 树（所有列都匹配）', () => {
    const multiTable: DecisionTable = {
      columns: ['age', 'is_retired'],
      rows: [
        { conditions: { age: 60, is_retired: true }, decision: 'DENY' },
      ],
    }
    const rows = compileDecisionTable(multiTable)
    expect(rows[0].expr.type).toBe('and')
    expect(ev.evaluate(rows[0].expr, objectContext({ age: 60, is_retired: true })).value).toBe(true)
    expect(ev.evaluate(rows[0].expr, objectContext({ age: 60, is_retired: false })).value).toBe(false)
  })

  it('缺失列约束 → 跳过该列（不约束）', () => {
    const table2: DecisionTable = {
      columns: ['age', 'is_retired'],
      rows: [
        { conditions: { age: 60 }, decision: 'DENY' },  // 不约束 is_retired
      ],
    }
    const rows = compileDecisionTable(table2)
    expect(rows[0].expr.type).toBe('compare') // 只有 age eq，单条件非 and
    expect(ev.evaluate(rows[0].expr, objectContext({ age: 60 })).value).toBe(true)
    expect(ev.evaluate(rows[0].expr, objectContext({ age: 60, is_retired: true })).value).toBe(true)
  })

  it('优先级缺省按行序', () => {
    const rows = compileDecisionTable(table)
    expect(rows[0].priority).toBe(0)
    expect(rows[1].priority).toBe(1)
    expect(rows[2].priority).toBe(2)
  })

  it('空列/空行 → 抛错', () => {
    expect(() => compileDecisionTable({ columns: [], rows: [{ conditions: {}, decision: 'X' }] })).toThrow()
    expect(() => compileDecisionTable({ columns: ['a'], rows: [] })).toThrow()
  })

  it('某行无任何条件 → 抛错', () => {
    expect(() => compileDecisionTable({ columns: ['a'], rows: [{ conditions: {}, decision: 'X' }] })).toThrow()
  })
})
