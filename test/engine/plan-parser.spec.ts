/**
 * PlanParser — Unit Tests
 *
 * Verifies LLM Plan text parsing into StructuredPlan for ERDL evaluation.
 * Covers normal format, edge cases, and LLM format variations.
 *
 * @author 唐浩然 · 2026-07-21
 */

import { PlanParser } from '../../src/engine/plan-parser.js'

const parser = new PlanParser()

describe('PlanParser', () => {
  // ─── Plan Detection ───

  describe('hasRecognizablePlan()', () => {
    it('中英文 PLAN marker', () => {
      expect(parser.hasRecognizablePlan('PLAN:\n步骤1: test')).toBe(true)
      expect(parser.hasRecognizablePlan('计划:\n1. test')).toBe(true)
    })

    it('no plan marker', () => {
      expect(parser.hasRecognizablePlan('I will just do it')).toBe(false)
    })

    it('uppercase PLAN marker', () => {
      expect(parser.hasRecognizablePlan('Here is my\nPLAN:\n1. do something')).toBe(true)
    })
  })

  // ─── Plan Parsing ───

  describe('parse() — 标准格式', () => {
    const planText = `PLAN:
步骤1: 扫描所有 .ts 文件 | 工具: glob, grep | 操作: READ | 目的: 收集文件列表
步骤2: 运行 ESLint 检测 | 工具: exec | 操作: EXEC | 目的: 检测语法问题
步骤3: 逐个修改文件 | 工具: edit | 操作: WRITE | 目的: 删除未使用 import
步骤4: 编译检查 | 工具: exec | 操作: EXEC | 目的: 验证修改正确性
成功标准: 编译 + ESLint 双通过
预计轮次: 4
风险: 低
替代方案: 如果 ESLint 不可用，手动检查每个 import`

    const plan = parser.parse(planText)

    it('hasPlan = true', () => {
      expect(plan.hasPlan).toBe(true)
    })

    it('提取 4 个步骤', () => {
      expect(plan.steps.length).toBe(4)
    })

    it('步骤 1 — glob+grep + READ', () => {
      const s1 = plan.steps[0]
      expect(s1.index).toBe(1)
      expect(s1.description).toContain('扫描')
      expect(s1.tools).toContain('glob')
      expect(s1.tools).toContain('grep')
      expect(s1.opSem).toBe('OP_READ')
      expect(s1.purpose).toContain('收集')
    })

    it('步骤 2 — exec + EXEC', () => {
      const s2 = plan.steps[1]
      expect(s2.index).toBe(2)
      expect(s2.tools).toContain('exec')
      expect(s2.opSem).toBe('OP_EXEC')
    })

    it('步骤 3 — edit + WRITE', () => {
      const s3 = plan.steps[2]
      expect(s3.index).toBe(3)
      expect(s3.tools).toContain('edit')
      expect(s3.opSem).toBe('OP_WRITE')
    })

    it('提取元数据', () => {
      expect(plan.goal).toBe('未说明')
      expect(plan.successCriteria).toContain('ESLint')
      expect(plan.estimatedRounds).toBe(4)
      expect(plan.riskLevel).toBe('low')
      expect(plan.alternatives).toContain('ESLint')
    })
  })

  // ─── English Format ───

  describe('parse() — 英文格式', () => {
    const planText = `PLAN:
Step 1: Scan all files | Tools: glob | Operation: READ | Purpose: find ts files
Step 2: Run linter | Tools: exec | Operation: EXEC | Purpose: check issues
Success: All tests pass
Rounds: 3
Risk: medium`

    const plan = parser.parse(planText)

    it('2 steps', () => {
      expect(plan.steps.length).toBe(2)
    })

    it('op semantic normalization', () => {
      expect(plan.steps[0].opSem).toBe('OP_READ')
      expect(plan.steps[1].opSem).toBe('OP_EXEC')
    })

    it('risk = medium', () => {
      expect(plan.riskLevel).toBe('medium')
    })
  })

  // ─── Edge Cases ───

  describe('edge cases', () => {
    it('没有 PLAN section → empty steps, hasPlan=false', () => {
      const plan = parser.parse('Just some random LLM output')
      expect(plan.hasPlan).toBe(false)
      expect(plan.steps.length).toBe(0)
    })

    it('empty plan text → empty steps', () => {
      const plan = parser.parse('PLAN:\n')
      expect(plan.steps.length).toBe(0)
    })

    it('只有目标没有步骤', () => {
      const plan = parser.parse('PLAN:\n目标: 清理代码\n成功标准: 编译通过')
      expect(plan.steps.length).toBe(0)
      expect(plan.goal).toBe('清理代码')
      expect(plan.successCriteria).toBe('编译通过')
    })

    it('工具字段包含多个工具', () => {
      const plan = parser.parse('PLAN:\n步骤1: 扫描 | 工具: glob, grep, list_dir | 操作: READ | 目的: 收集')
      expect(plan.steps[0].tools).toHaveLength(3)
      expect(plan.steps[0].tools).toContain('glob')
      expect(plan.steps[0].tools).toContain('grep')
      expect(plan.steps[0].tools).toContain('list_dir')
    })

    it('操作语义中文映射', () => {
      const chineseOps = [
        { text: '操作: 读取 | 目的: test', expected: 'OP_READ' },
        { text: '操作: 写入 | 目的: test', expected: 'OP_WRITE' },
        { text: '操作: 删除 | 目的: test', expected: 'OP_DELETE' },
        { text: '操作: 执行 | 目的: test', expected: 'OP_EXEC' },
        { text: '操作: 网络 | 目的: test', expected: 'OP_NETWORK' },
        { text: '操作: 记忆 | 目的: test', expected: 'OP_MEMORY' },
      ]
      for (const { text, expected } of chineseOps) {
        const plan = parser.parse(`PLAN:\n步骤1: test | ${text}`)
        expect(plan.steps[0].opSem).toBe(expected)
      }
    })

    it('步骤用数字编号而非 "步骤"', () => {
      const plan = parser.parse('PLAN:\n1. 扫描文件 | 工具: glob | 操作: READ | 目的: 收集\n2. 编译 | 工具: exec | 操作: EXEC | 目的: 检查')
      expect(plan.steps.length).toBe(2)
    })

    it('LLM 省略了某些字段 → 仍然解析', () => {
      const plan = parser.parse('PLAN:\n步骤1: 扫描文件 | 工具: glob')
      expect(plan.steps.length).toBe(1)
      expect(plan.steps[0].tools).toContain('glob')
      expect(plan.steps[0].opSem).toBeTruthy() // fallback
    })
  })
})
