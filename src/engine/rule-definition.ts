/**
 * ERDL MCP Server  — Rule Definition Types
 *
 * Core type definitions for ERDL rules.
 * Supports personal rules, team standards, enterprise policies, and compliance mandates.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-07-07 · updated 2026-07-09 (compliance scope + extended categories)
 * @license MIT
 */

// ============================================
// Rule Condition
// ============================================

/**
 * Condition kind  — ERDL SPEC v2.0 §11 defines a single kind: context_matches.
 * All conditions evaluate field + operator + value against the execution context.
 */
import type { ConditionOperator as SchemaConditionOperator } from './erdl-schema.js';

export type ConditionKind = 'context_matches';

/** Spec v2.0 §11 comparison operators */
// 2026-08-28 review: was a local 28-item union type (a second enum definition).
// Now derived from the single source of truth; listing operators again in this file is forbidden.
export type ConditionOperator = SchemaConditionOperator;

export interface RuleCondition {
  /** Condition kind (SPEC v1.1 legacy, deprecated in v2.0; kept optional for old-data compatibility, ignored by evaluation logic) */
  kind?: ConditionKind;

  /** Keywords to match against agent intent (intent_contains) */
  keywords?: string[];

  /** Regex pattern to match (intent_matches / context_matches) */
  pattern?: string;

  /** Context field path for context_matches or Spec mode (e.g., "file", "language") */
  field?: string;

  /** Expected value for context_matches comparison */
  value?: unknown;

  /** Spec v2.0 §11 comparison operator (when using field/operator/value mode) */
  operator?: ConditionOperator;

  /** SPEC v2.0 §11: Time window constraint (e.g., "5m") */
  within?: string;

  /** SPEC v2.0 §11: Rate limit constraint (e.g., "10/1m") */
  rate?: string;

  /**
   * Structured expression tree (S-expression JSON form, SPEC v2.0 §12 external form).
   * Carries complex conditions that field/operator/value cannot express (time arithmetic/arithmetic/fn delegation etc.).
   * Converted to a tree via fromSExpr at evaluation; mutually exclusive with field/operator/value (E5).
   */
  expr?: unknown;
}

// ============================================
// Rule Action / Decision
// ============================================

/** SPEC v2.0 §27: decision types (13 external + 4 internal + rulsynor extensions).
 *  CENSOR is a rulsynor extension (after-audit pipeline), not in SPEC v2.0. */
export type Decision =
  // SPEC v2.0 §27: 13 externally visible
  | 'ALLOW'
  | 'DENY'
  | 'CORRECT'
  | 'NOTIFY'
  | 'EMERGENCY_HALT'
  | 'ROLLBACK'
  | 'QUARANTINE'
  | 'REQUEST_HUMAN'
  | 'ESCALATE'
  | 'DELEGATE'
  | 'DEFER'
  | 'WORKFLOW'
  | 'WORKFLOW_PROGRESS'
  | 'WORKFLOW_WAITING'
  // rulsynor extension: positive guidance (guide) — when matched, guides the LLM to act per SOP/best practice
  | 'GUIDE'
  // SPEC v2.0 §27: 4 internal reasoning (not in Decision Object)
  | 'STRATEGIZE'
  | 'AUDIT'
  | 'CALCULATE'
  | 'VALIDATE'
  // Internal state
  | 'PASS'
  // rulsynor extension (after-audit, not in SPEC v2.0)
  | 'CENSOR';

/** ERDL SPEC v2.0 §9  — override level enum (critical > high > normal > low) */
export type OverrideLevel = 'critical' | 'high' | 'normal' | 'low';

/** Execution Ring  — ERDL Protocol Spec */
export type RingLevel = 0 | 1 | 2 | 3;

/** Agent role in the ERDL Protocol */
export type AgentRole = 'guardian' | 'operator' | 'observed';

export interface RuleAction {
  /** What should happen when this rule matches */
  decision: Decision;
  /** Instruction for the LLM to follow */
  instruction?: string;
  /**
   * List of linked knowledge entry ids (references to full SOP / best practice / regulation text).
   * On a guide-type decision (GUIDE etc.) match, the LLM retrieves full knowledge details from these.
   * Rules stay lightweight, knowledge stays rich, each does its own job.
   */
  knowledge_refs?: string[];
  /** Reason shown to user when blocked or halted */
  reason?: string;
  /**
   * Human-friendly bilingual explanation of WHY this rule exists and WHAT harm it prevents.
   * Shown in agent chat feedback, not just on DENY  — also on ALLOW as context.
   */
  explanation?: string | { zh: string; en: string };
  /**
   * Suggested alternative action when the operation is blocked.
   * Shown as "Alternative: ..." (localized).
   */
  alternative?: string | { zh: string; en: string };
  /** Execution Ring level (0-3). Guardian rules default Ring 0. */
  ring?: RingLevel;
  /** Correction target text (CORRECT decision) */
  correction?: string;
}

// ============================================
// Rule Definition
// ============================================

/**
 * Rule category for organization.
 *
 * coding  — code standards and patterns
 * engineering  — engineering discipline and workflow
 * security  — security rules and vulnerability prevention
 * writing  — content and documentation standards
 * design  — UI/UX and visual design constraints
 * performance  — runtime efficiency and optimization
 * testing  — test coverage and quality gates
 * compliance  — regulatory and legal mandates
 * accessibility  — a11y and inclusive design
 * custom  — user-defined / uncategorized
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
  | 'observability'
  | 'custom';

/**
 * SPEC v1.2 legacy §3.2.0  — Six-tier rule hierarchy.
 * Tier 0 (Moral), 1 (Compliance), 2 (Security), 3 (Policy), 4 (Role), 5 (Convention).
 */
export type RuleTier = 0 | 1 | 2 | 3 | 4 | 5;

export const TIER_LABELS: Record<RuleTier, string> = {
  0: 'Moral',
  1: 'Compliance',
  2: 'Security',
  3: 'Policy',
  4: 'Role',
  5: 'Convention',
};

/** SPEC v1.2 legacy §3.2.0a  — Tier override semantics */
export type TierOverride = 'none' | 'human_approval' | 'emergency_override' | 'always';

export const TIER_RING_COMPAT: Record<RuleTier, number[]> = {
  0: [0],
  1: [0, 1],
  2: [0, 1, 2],
  3: [1, 2, 3],
  4: [2, 3],
  5: [3],
};

export interface RuleDefinition {
  /** Unique rule ID (derived from name, e.g., "dangerous_command_intercept") */
  id: string;

  /** Human-readable rule name */
  name: string;

  /** One-line description */
  description: string;

  /** Category for organization */
  category: RuleCategory;

  /** Match conditions (ERDL SPEC v2.0 §11 field/operator/value) */
  conditions: RuleCondition[];

  /** Condition logic: AND = all must match, OR = any must match (SPEC v2.0 §11) */
  conditionLogic?: 'AND' | 'OR';

  /** Action to take when matched */
  action: RuleAction;

  /** Priority: lower number = higher priority (1-1000) */
  priority: number;

  /** Whether this rule is currently active */
  enabled: boolean;

  /**
   * ERDL SPEC v2.0 §9 + §10: hard constraint that immediately terminates all other rule
   * evaluations upon match. Cannot be bypassed by LLMs.
   *
   * SPEC v2.0 §9 levels: critical | high | normal | low
   * - critical/high: can override a prior DENY  — ALLOW (same Ring only)
   * - normal/low: do not enable override behavior (treated as non-override)
   * - undefined: no override
   */
  override?: OverrideLevel;

  /** Rule version (for tracking changes) */
  version?: number;

  /**
   * Legal basis (source of the regulation clause, e.g. Article 23(2) of the Petition Work Regulations).
   * Rendered for approval adjudication (seed extraction and DB read-back deferred, not MVP).
   */
  legal_basis?: string | null;

  /**
   * Excerpt of the legal text (the original regulation the rule is based on).
   * Rendered for approval adjudication (seed extraction deferred, not MVP).
   */
  source_text?: string | null;

  /**
   * SPEC v2.0 §11: unless exemption conditions.
   * Evaluated BEFORE when conditions. If unless matches  — ALLOW (exempt).
   * Same structure as conditions.
   */
  unless?: { logic?: 'AND' | 'OR'; conditions: RuleCondition[] };

  /** P4.3: Workflow definition  — multi-step checkpoint verification */
  workflow?: WorkflowDefinition;

  /** Compliance scope level (1-5). 1=personal, 2=organizational, 3=national, 4=regional, 5=global */
  scopeLevel?: 1 | 2 | 3 | 4 | 5;

  /** Hit count (runtime counter) */
  hitCount?: number;
}

// ============================================
// Evaluation Result
// ============================================

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  decision: Decision;
  instruction?: string;
  reason?: string;
  explanation?: string | { zh: string; en: string };
  alternative?: string | { zh: string; en: string };
  ring?: RingLevel;
  correction?: string;
  /** Corrected arguments carried by the CORRECT decision (parameter override) */
  correctedArgs?: Record<string, unknown>;
  priority: number;
}

/**
 * Window count snapshot for stateful operators (within/rate) (SPEC v2.0 §11 / RFC-002 §2.4).
 * Goes into the DO `evaluation.temporal_state`, so "why rate-limiting fired at this moment" can be recomputed offline.
 * Field structure frozen consistent with RFC-002 §2.4: { rule_id, operator, field, window_ms, count, limit? }.
 */
export interface TemporalStateEntry {
  rule_id: string;
  operator: 'within' | 'rate';
  field: string;
  window_ms: number;
  count: number;
  /** Upper limit of the rate operator (e.g. 5 in "5/1m"); within has no limit, omitted */
  limit?: number;
}

export interface EvaluationResult {
  /** Overall decision: ALLOW if any matched, DENY if blocked, PASS if no rules fired */
  decision: Decision;

  /** All matched rules, in evaluation order (excludes unless exemptions) */
  matchedRules: RuleMatch[];

  /** SPEC v2.0 §11: unless exemptions  — rules exempted via unless, recorded separately.
   *  Not included in matchedRules (v1.1 vectors expect matched_rules=[] when only unless fires). */
  unlessExemptions?: RuleMatch[];

  /** The highest-priority instruction (for ALLOW) or reason (for DENY) */
  primaryInstruction?: string;
  primaryReason?: string;
  primaryExplanation?: string | { zh: string; en: string };
  primaryAlternative?: string | { zh: string; en: string };
  /** Correction text (CORRECT decision) */
  primaryCorrection?: string;

  /** Total rules evaluated */
  totalEvaluated: number;

  /** Total rules matched */
  totalMatched: number;

  /** Window count snapshot of stateful operators (within/rate) (into DO temporal_state, RFC-002 §2.4); omitted/empty array when no match */
  temporalState?: TemporalStateEntry[];
}

// ============================================
// Create Rule from NL
// ============================================

export interface RuleCreationRequest {
  naturalLanguage: string;
  category: RuleCategory;
  autoActivate?: boolean;
}

export interface RuleCreationResult {
  ruleId: string;
  name: string;
  status: 'created' | 'updated';
  filePath: string;
}

// ============================================
// Simulate
// ============================================

export interface SimulateScenario {
  /** Human description of the scenario */
  description: string;
  /** Simulated agent intent */
  intent: string;
  /** Simulated context */
  context: Record<string, unknown>;
  /** Expected outcome */
  expectedDecision: Decision;
}

export interface SimulateResult {
  scenario: SimulateScenario;
  actualDecision: Decision;
  matched: boolean;
  matchedRules: RuleMatch[];
}

// ============================================
// Agent Identity (ERDL Protocol Spec)
// ============================================

export interface AgentIdentity {
  /** Agent role: guardian (enforces rules) or observed (subject to rules) */
  role: AgentRole;
  /** IDs of agents this guardian observes */
  observes?: string[];
}

// ============================================
// P4.3: Workflow Definition
// ============================================

/** Workflow step definition  — embedded in RuleDefinition */
export interface WorkflowDefinition {
  on_failure: 'DENY' | 'REQUEST_HUMAN';
  timeout_seconds: number;
  max_steps: number;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  description: string;
  verify: RuleCondition[];
  auto_pass_if?: string;
  post_action?: string;
}

/** Runtime workflow state  — maintained by GuardService per session */
export interface WorkflowState {
  ruleName: string;
  ruleId: string;
  steps: WorkflowStep[];
  current_step: number;
  started_at: Date;
  session_id: string;
}
