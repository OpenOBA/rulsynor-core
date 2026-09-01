/**
 * rule-config — RuleConfig 纯类型定义（剥离 TypeORM 实体装饰器）
 *
 * 原 rulsynor 的 RuleConfig 是 TypeORM 实体（@Entity/@Column），core 零依赖，
 * 改为纯 TS interface（字段一致，去掉装饰器），供规则 YAML 序列化与存储接口使用。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-21（M2 剥离 rule-config.entity 依赖）
 * @license MIT
 */

export interface RuleConfig {
  id: string
  name: string
  category: string
  content: Record<string, unknown>
  source: string
  /** 规则依据的法规条款出处 */
  legal_basis: string | null
  /** 规则依据的法规原文全文 */
  source_text: string | null
  /** 规则的自然语言可读回读（gloss） */
  gloss: string | null
  /** 规则分级 A/B/C */
  grade: string | null
  version: number
  user_id: string | null
  owner_id: string | null
  scope: string
  overrides_rule_name: string | null
  is_overridden: boolean
  priority: number
  decision: string
  ring_level: number
  enabled: boolean
  is_draft: boolean
  is_deleted: boolean
  /** 规则类别：guard（工具调用守卫）/ approval（业务审批） */
  rule_kind: string
  /** 规则集（部门/业务场景隔离维度） */
  rule_set: string
  hit_count: number
  last_hit_at: Date | null
  embedding: number[] | null
  created_at: Date
  updated_at: Date
}
