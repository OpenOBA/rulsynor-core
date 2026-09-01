/**
 * simple-compiler — Simple 条件运算符（28 个）→ 表达式树编译（SPEC v2.0 §11）
 *
 * SPEC v2.0 §11：“28 个条件运算符 + 2 个修饰符（within/rate）= 30 个语义单元”。
 * 本文件只编译 28 个条件运算符；within/rate 是有状态修饰符，在树外（GuardStateManager），不在此编译。
 * 求值核心从「运算符分支」收敛为「节点类型遍历」。
 *
 * 28 条件运算符编译归宿（SPEC v2.0 §11 权威映射）：
 * - 13 直接节点：eq/ne/gt/gte/lt/lte · in · contains/starts_with/ends_with/match · exists · between
 * - 6  not 组合：not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between
 * - 9  length/count 组合：length_gt/gte/lt/lte/eq（5）+ count_gt/gte/lt/lte（4）
 * - 2  时间修饰：within/rate（状态在树外 GuardStateManager，不编译进树求值——见下）
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import type { ExprNode } from './node-types.js'
import type { ConditionOperator } from '../erdl-schema.js'

/** Simple 条件运算符全集（28 个，SPEC v2.0 §11，规范级冻结；不含 within/rate 修饰符） */
// 2026-08-28 论证阶段收口：原为本地 28 项联合类型。它曾被加进 NO-DUP-ENUM 白名单，
// 而白名单掩盖了一个真副本 —— simple-compiler 完全可以从单一事实源派生。
// 结论：白名单只应给「结构上无法派生」的情形（如前端无后端依赖），不得给「能派生但没派生」。
export type SimpleOperator = ConditionOperator

/** Simple 条件（field + operator + value 三元组） */
export interface SimpleCondition {
  field: string
  operator: SimpleOperator
  value?: unknown
}

export class SimpleCompileError extends Error {
  constructor(message: string) {
    super(`[SimpleCompile] ${message}`)
    this.name = 'SimpleCompileError'
  }
}

/** 构造 field 引用节点 */
function field(name: string): ExprNode {
  return { type: 'field', field: name }
}

/** 构造 literal 节点 */
function literal(value: unknown): ExprNode {
  return { type: 'literal', value }
}

/** 构造比较节点 */
function cmp(op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte', left: ExprNode, right: ExprNode): ExprNode {
  return { type: 'compare', op, left, right }
}

/** 构造 not 节点 */
function not(arg: ExprNode): ExprNode {
  return { type: 'not', arg }
}

/**
 * exists 守卫（E11 空值传播）：派生算子（not_* / length_*）对缺失字段必须返回 false，
 * 而非经 not 翻转或数值比较后误判为 true。
 * 编译为 exists(field) AND <inner>——字段缺失（undefined/null）时 exists=false → 整体 false。
 * 修复（2026-08-27）：原实现 not_* 编译成 not(正向算子)，正向算子对缺失字段返回 false，
 * not(false)=true 翻转了空值传播（fail-open 安全漏洞）；length_* 同理（length(缺失)=0，0>负数/0==0 误判 true）。
 */
function andExists(fieldName: string, inner: ExprNode): ExprNode {
  return { type: 'and', args: [{ type: 'exists', arg: field(fieldName) }, inner] }
}

/**
 * 编译单个 Simple 条件 → 表达式树节点。
 * 对齐 §11 权威映射，无悬空。
 */
export function compileSimpleCondition(cond: SimpleCondition): ExprNode {
  const { field: fieldName, operator, value } = cond
  if (!fieldName) throw new SimpleCompileError('field 不能为空')

  switch (operator) {
    // ── 13 直接节点 ──
    case 'eq': case 'ne': case 'gt': case 'gte': case 'lt': case 'lte':
      return cmp(operator, field(fieldName), literal(value))
    case 'in':
      return { type: 'in', left: field(fieldName), right: literal(value) }
    case 'contains':
    case 'starts_with':
    case 'ends_with':
    case 'match':
      return { type: 'string', op: operator, left: field(fieldName), right: literal(value) }
    case 'exists':
      return { type: 'exists', arg: field(fieldName) }
    case 'between': {
      // value 应为 [min, max]
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(`between 需要 [min, max] 数组，实际 ${JSON.stringify(value)}`)
      }
      return { type: 'between', value: field(fieldName), min: literal(value[0]), max: literal(value[1]) }
    }

    // ── 6 not 组合（not_* 加 exists 守卫，字段缺失时不 not 翻转）──
    case 'not_in':
      return andExists(fieldName, not({ type: 'in', left: field(fieldName), right: literal(value) }))
    case 'not_contains':
      return andExists(fieldName, not({ type: 'string', op: 'contains', left: field(fieldName), right: literal(value) }))
    case 'not_starts_with':
      return andExists(fieldName, not({ type: 'string', op: 'starts_with', left: field(fieldName), right: literal(value) }))
    case 'not_ends_with':
      return andExists(fieldName, not({ type: 'string', op: 'ends_with', left: field(fieldName), right: literal(value) }))
    case 'not_exists':
      // not_exists 是唯一可感知字段存在性的算子之一（E11），保持 not(exists)，不加 exists 守卫
      return not({ type: 'exists', arg: field(fieldName) })
    case 'not_between': {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new SimpleCompileError(`not_between 需要 [min, max] 数组，实际 ${JSON.stringify(value)}`)
      }
      return andExists(fieldName, not({ type: 'between', value: field(fieldName), min: literal(value[0]), max: literal(value[1]) }))
    }

    // ── 9 length/count 组合（length_*/count_* 加 exists 守卫，字段缺失时不 0/null 值误判）──
    case 'length_gt': return andExists(fieldName, cmp('gt', lengthOf(fieldName), literal(value)))
    case 'length_gte': return andExists(fieldName, cmp('gte', lengthOf(fieldName), literal(value)))
    case 'length_lt': return andExists(fieldName, cmp('lt', lengthOf(fieldName), literal(value)))
    case 'length_lte': return andExists(fieldName, cmp('lte', lengthOf(fieldName), literal(value)))
    case 'length_eq': return andExists(fieldName, cmp('eq', lengthOf(fieldName), literal(value)))
    case 'count_gt': return andExists(fieldName, cmp('gt', countOf(fieldName), literal(value)))
    case 'count_gte': return andExists(fieldName, cmp('gte', countOf(fieldName), literal(value)))
    case 'count_lt': return andExists(fieldName, cmp('lt', countOf(fieldName), literal(value)))
    case 'count_lte': return andExists(fieldName, cmp('lte', countOf(fieldName), literal(value)))

    default:
      // within/rate 是有状态算子，不在此编译（状态在树外）
      throw new SimpleCompileError(`不支持的 Simple 运算符：${operator}`)
  }
}

/** length(field) 节点 */
function lengthOf(fieldName: string): ExprNode {
  return { type: 'length', arg: field(fieldName) }
}

/** count(field) 节点（聚合 count） */
function countOf(fieldName: string): ExprNode {
  return { type: 'aggregate', fn: 'count', over: field(fieldName) }
}

/**
 * 编译一组 Simple 条件 → and 组合树。
 * 空数组 → literal true（恒真）。
 */
export function compileSimpleConditions(conds: SimpleCondition[], logic: 'AND' | 'OR' = 'AND'): ExprNode {
  if (conds.length === 0) return literal(true)
  const nodes = conds.map(compileSimpleCondition)
  if (nodes.length === 1) return nodes[0]
  return { type: logic === 'OR' ? 'or' : 'and', args: nodes }
}
