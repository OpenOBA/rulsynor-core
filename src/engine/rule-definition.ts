/**
 * ERDL MCP Server — Rule Definition Types
 *
 * Core type definitions for ERDL rules.
 * Supports personal rules, team standards, enterprise policies, and compliance mandates.
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-07 · updated 2026-07-09 (compliance scope + extended categories)
 * @license MIT
 */

// ============================================
// Rule Condition
// ============================================

/**
 * Condition kind — ERDL SPEC §5 defines a single kind: context_matches.
 * All conditions evaluate field + operator + value against the execution context.
 */
export type ConditionKind = 'context_matches'

/** Spec v1.1 comparison operators */
export type ConditionOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'contains' | 'not_contains'
  | 'match' | 'matches'
  | 'starts_with' | 'ends_with'
  | 'exists' | 'not_exists'
  | 'neq'

export interface RuleCondition {
  kind: ConditionKind

  /** Keywords to match against agent intent (intent_contains) */
  keywords?: string[]

  /** Regex pattern to match (intent_matches / context_matches) */
  pattern?: string

  /** Context field path for context_matches or Spec mode (e.g., "file", "language") */
  field?: string

  /** Expected value for context_matches comparison */
  value?: unknown

  /** Spec v1.1 comparison operator (when using field/operator/value mode) */
  operator?: ConditionOperator

  /** SPEC §3.3: Time window constraint (e.g., "5m") */
  within?: string

  /** SPEC §3.3: Rate limit constraint (e.g., "10/1m") */
  rate?: string
}

// ============================================
// Rule Action / Decision
// ============================================

/** SPEC v1.1 §3.4: 17 complete actions.
 *  CENSOR is a rulsynor extension (after-audit pipeline), not in SPEC v1.1. */
export type Decision =
  // SPEC §3.4: 13 external-visible
  | 'ALLOW' | 'DENY' | 'CORRECT' | 'NOTIFY'
  | 'EMERGENCY_HALT' | 'ROLLBACK' | 'QUARANTINE'
  | 'REQUEST_HUMAN' | 'ESCALATE' | 'DELEGATE'
  | 'WORKFLOW' | 'WORKFLOW_PROGRESS' | 'WORKFLOW_WAITING'
  // SPEC §3.4: 4 internal reasoning (not in Decision Object)
  | 'STRATEGIZE' | 'AUDIT' | 'CALCULATE' | 'VALIDATE'
  // Internal state
  | 'PASS'
  // rulsynor extension (after-audit, not in SPEC v1.1)
  | 'CENSOR'

/** ERDL SPEC v1.1 §3.2 — override level enum (critical > high > normal > low) */
export type OverrideLevel = 'critical' | 'high' | 'normal' | 'low'

/** Execution Ring — ERDL Protocol Spec */
export type RingLevel = 0 | 1 | 2 | 3

/** Agent role in the ERDL Protocol */
export type AgentRole = 'guardian' | 'operator' | 'observed'

export interface RuleAction {
  /** What should happen when this rule matches */
  decision: Decision
  /** Instruction for the LLM to follow */
  instruction?: string
  /** Reason shown to user when blocked or halted */
  reason?: string
  /**
   * Human-friendly bilingual explanation of WHY this rule exists and WHAT harm it prevents.
   * Shown in agent chat feedback, not just on DENY — also on ALLOW as context.
   */
  explanation?: string | { zh: string; en: string }
  /**
   * Suggested alternative action when the operation is blocked.
   * Shown as "替代方案: ..." or "Alternative: ...".
   */
  alternative?: string | { zh: string; en: string }
  /** Execution Ring level (0-3). Guardian rules default Ring 0. */
  ring?: RingLevel
  /** Correction target text (CORRECT decision) */
  correction?: string
}

// ============================================
// Rule Definition
// ============================================

/**
 * Rule category for organization.
 *
 * coding — code standards and patterns
 * engineering — engineering discipline and workflow
 * security — security rules and vulnerability prevention
 * writing — content and documentation standards
 * design — UI/UX and visual design constraints
 * performance — runtime efficiency and optimization
 * testing — test coverage and quality gates
 * compliance — regulatory and legal mandates
 * accessibility — a11y and inclusive design
 * custom — user-defined / uncategorized
 */
export type RuleCategory =
  | 'coding'
  | 'engineering'
  | 'security'
  | 'writing'
  | 'design'
  | 'performance'
  | 'testing'
  | 'compliance'
  | 'accessibility'
  | 'custom'

export interface RuleDefinition {
  /** Unique rule ID (derived from name, e.g., "dangerous_command_intercept") */
  id: string

  /** Human-readable rule name */
  name: string

  /** One-line description */
  description: string

  /** Category for organization */
  category: RuleCategory

  /** Match conditions (ERDL SPEC §5 field/operator/value) */
  conditions: RuleCondition[]

  /** Condition logic: AND = all must match, OR = any must match (SPEC §5) */
  conditionLogic?: 'AND' | 'OR'

  /** Action to take when matched */
  action: RuleAction

  /** Priority: lower number = higher priority (1-1000) */
  priority: number

  /** Whether this rule is currently active */
  enabled: boolean

  /**
   * ERDL SPEC §3.2 + §11.4: hard constraint that immediately terminates all other rule
   * evaluations upon match. Cannot be bypassed by LLMs.
   *
   * SPEC v1.1 §3.2 levels: critical | high | normal | low
   * - critical/high: can override a prior DENY → ALLOW (same Ring only)
   * - normal/low: do not enable override behavior (treated as non-override)
   * - undefined: no override
   */
  override?: OverrideLevel

  /** Rule version (for tracking changes) */
  version?: number

  /**
   * SPEC v1.1 §3.2.2: unless exemption conditions.
   * Evaluated BEFORE when conditions. If unless matches → ALLOW (exempt).
   * Same structure as conditions.
   */
  unless?: { logic?: 'AND' | 'OR'; conditions: RuleCondition[] }

  /** P4.3: Workflow definition — multi-step checkpoint verification */
  workflow?: WorkflowDefinition

  /** Compliance scope level (1-5). 1=personal, 2=organizational, 3=national, 4=regional, 5=global */
  scopeLevel?: 1 | 2 | 3 | 4 | 5

  /** Hit count (runtime counter) */
  hitCount?: number
}

// ============================================
// Evaluation Result
// ============================================

export interface RuleMatch {
  ruleId: string
  ruleName: string
  decision: Decision
  instruction?: string
  reason?: string
  explanation?: string | { zh: string; en: string }
  alternative?: string | { zh: string; en: string }
  ring?: RingLevel
  correction?: string
  priority: number
}

export interface EvaluationResult {
  /** Overall decision: ALLOW if any matched, DENY if blocked, PASS if no rules fired */
  decision: Decision

  /** All matched rules, in evaluation order (excludes unless exemptions) */
  matchedRules: RuleMatch[]

  /** SPEC v1.1 §3.8: unless exemptions — rules exempted via unless, recorded separately.
   *  Not included in matchedRules (v1.1 vectors expect matched_rules=[] when only unless fires). */
  unlessExemptions?: RuleMatch[]

  /** The highest-priority instruction (for ALLOW) or reason (for DENY) */
  primaryInstruction?: string
  primaryReason?: string
  primaryExplanation?: string | { zh: string; en: string }
  primaryAlternative?: string | { zh: string; en: string }
  /** Correction text (CORRECT decision) */
  primaryCorrection?: string

  /** Total rules evaluated */
  totalEvaluated: number

  /** Total rules matched */
  totalMatched: number
}

// ============================================
// Create Rule from NL
// ============================================

export interface RuleCreationRequest {
  naturalLanguage: string
  category: RuleCategory
  autoActivate?: boolean
}

export interface RuleCreationResult {
  ruleId: string
  name: string
  status: 'created' | 'updated'
  filePath: string
}

// ============================================
// Simulate
// ============================================

export interface SimulateScenario {
  /** Human description of the scenario */
  description: string
  /** Simulated agent intent */
  intent: string
  /** Simulated context */
  context: Record<string, unknown>
  /** Expected outcome */
  expectedDecision: Decision
}

export interface SimulateResult {
  scenario: SimulateScenario
  actualDecision: Decision
  matched: boolean
  matchedRules: RuleMatch[]
}

// ============================================
// Agent Identity (ERDL Protocol Spec)
// ============================================

export interface AgentIdentity {
  /** Agent role: guardian (enforces rules) or observed (subject to rules) */
  role: AgentRole
  /** IDs of agents this guardian observes */
  observes?: string[]
}

// ============================================
// P4.3: Workflow Definition
// ============================================

/** Workflow step definition — embedded in RuleDefinition */
export interface WorkflowDefinition {
  on_failure: 'DENY' | 'REQUEST_HUMAN'
  timeout_seconds: number
  max_steps: number
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  description: string
  verify: RuleCondition[]
  auto_pass_if?: string
  post_action?: string
}

/** Runtime workflow state — maintained by GuardService per session */
export interface WorkflowState {
  ruleName: string
  ruleId: string
  steps: WorkflowStep[]
  current_step: number
  started_at: Date
  session_id: string
}
