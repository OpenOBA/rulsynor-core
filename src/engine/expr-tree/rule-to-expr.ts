/**
 * rule-to-expr — RuleDefinition（平铺 conditions）→ 表达式树编译（归一桥梁）
 *
 * 把旧平铺求值器（evaluator.ts）的 RuleCondition[] 编译为表达式树，
 * 供影子验证（新旧对照）与归一（替换条件求值层）使用。
 *
 * 对齐语义：
 * - 运算符别名归一：matches→match、neq→ne（与旧 evaluator 的 v1.3 aliasing 一致）
 * - 仅编译纯条件（field+operator+value）；within/rate/pattern/keywords 不编译（有状态/非纯）
 * - conditionLogic：AND（缺省）/ OR → and/or 树
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type { RuleDefinition, RuleCondition } from '../rule-definition.js'
import type { ExprNode } from './node-types.js'
import { fromSExpr, extractWhenExpr } from './s-expression.js'
import { compileSimpleConditions, type SimpleCondition, type SimpleOperator } from './simple-compiler.js'
import { CONDITION_OPERATORS } from '../erdl-schema.js'

/** RuleCondition 的 operator → SimpleOperator（归一别名 + 过滤非纯算子） */
export function normalizeOperator(op: string | undefined): SimpleOperator | null {
  if (!op) return null
  // 别名归一（与旧 evaluator v1.3 aliasing 一致）
  if (op === 'matches') op = 'match'
  if (op === 'neq') op = 'ne'
  // 判定是否为 SimpleOperator
  // 2026-08-28 review 收口：原为本地 28 项数组（第二份枚举）。现用单一事实源判定。
  return (CONDITION_OPERATORS as readonly string[]).includes(op) ? (op as SimpleOperator) : null
}

/** 单个 RuleCondition → SimpleCondition（无法编译的返回 null） */
export function ruleConditionToSimple(cond: RuleCondition): SimpleCondition | null {
  // 非纯条件（within/rate/pattern/keywords）不编译
  if (cond.within || cond.rate || cond.pattern || cond.keywords) return null
  const field = cond.field
  if (!field) return null
  const op = normalizeOperator(cond.operator)
  if (op === null) return null
  return { field, operator: op, value: cond.value }
}

/**
 * RuleDefinition 的 when 条件 → 表达式树。
 * 返回 null 表示该规则含非纯条件（within/rate/pattern/keywords），无法编译成纯树。
 */
export function ruleWhenToExpr(rule: RuleDefinition): ExprNode | null {
  const conds = rule.conditions ?? []
  if (conds.length === 0) {
    // 空条件 = 恒真（catch-all）
    return { type: 'literal', value: true }
  }
  const simples: SimpleCondition[] = []
  for (const cond of conds) {
    const s = ruleConditionToSimple(cond)
    if (s === null) return null // 含非纯条件
    simples.push(s)
  }
  const logic = rule.conditionLogic ?? 'AND'
  return compileSimpleConditions(simples, logic)
}

/**
 * LLM 生成的规则 JSON 的 when → 表达式树（统一入口，同时支持两种形态）。
 *
 * 两种 when 形态：
 * - 平铺 { logic, conditions }（Simple 投影面）
 * - S-expression 表达式树（Expression 投影面，含时间运算等扩展节点）
 *
 * 供 regulation-rule / rule.service computeGlossGrade 等 NL 生成入口使用；
 * 对不规范 JSON 做容错 + 别名归一。返回 null 表示无法编译。
 */
export function jsonWhenToExpr(when: Record<string, unknown>): ExprNode | null {
  // §12 Expression 投影面：优先识别 when.expr 包裹形态（SPEC §12 权威），
  // 兼容 when 顶层即树的旧形态。
  const exprValue = extractWhenExpr(when)
  if (exprValue !== null) {
    try {
      return fromSExpr(exprValue)
    } catch {
      return null
    }
  }

  const conds = when?.conditions as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(conds) || conds.length === 0) {
    // 空条件 → 恒真
    return { type: 'literal', value: true }
  }
  const logic = (when.logic as 'AND' | 'OR') ?? 'AND'
  const simples: SimpleCondition[] = []
  for (const c of conds) {
    const field = c?.field as string | undefined
    const op = c?.operator as string | undefined
    if (!field || !op) return null
    const normOp = normalizeOperator(op)
    if (normOp === null) return null
    simples.push({ field, operator: normOp, value: c.value })
  }
  return compileSimpleConditions(simples, logic)
}
