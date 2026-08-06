/**
 * Rulsynor — IRuleStore Interface
 *
 * Abstracts rule storage backends so Evaluator can consume rules without
 * knowing whether they come from the file system or the database.
 *
 * Implementations:
 *   - FileRuleStore: loads from ~/.openoba/rules/*.erdl.yaml
 *   - DbRuleStore:   loads from rule_config table (PostgreSQL)
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-20 · rule architecture migration (DB as single source of truth)
 */

import type { RuleDefinition, AgentIdentity } from './rule-definition.js'

export interface IRuleStore {
  /** Load rules into memory. Returns count of loaded rules. */
  load(): Promise<number>

  /** Get all active rules */
  getAll(): RuleDefinition[]

  /** Get a specific rule by ID */
  get(id: string): RuleDefinition | undefined

  /** Get rule count */
  count(): number

  /** Reload rules atomically (no empty window during swap) */
  reload(): number

  /** Add a runtime rule (not persisted) */
  addRuntime(rule: RuleDefinition): void

  /** Register callback for when rules change */
  onRulesChanged(cb: () => void): void

  /** Get agent identity */
  getAgentIdentity(): AgentIdentity

  /** Check if this agent is a guardian */
  isGuardian(): boolean
}

/** NestJS DI token for IRuleStore */
export const RULE_STORE = Symbol('IRuleStore')
