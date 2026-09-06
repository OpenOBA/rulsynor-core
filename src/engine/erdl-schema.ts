/**
 * erdl-schema — the **single source of truth** for the ERDL deterministic kernel
 * (SPEC authoritative enums).
 *
 * Why this file exists (verified 2026-08-28 reconciliation): the operator/decision
 * enums were previously scattered across 6 places with 4 different values, drifting
 * apart — the kernel supported 30 operators, the validator admitted 13, the UI showed 13,
 * the regulation entry checked 15, and the LLM prompt was only told 6. With multiple
 * definitions of a "deterministic" kernel, determinism existed in name only.
 *
 * This file is the sole authoritative source for these enums: **types are derived from
 * the constants** (`typeof X[number]`) — a second union type or string array MUST NOT
 * be written elsewhere. All consumers MUST import from this file.
 *
 * Authority anchors (ERDL language spec v2.1):
 *  - §5.2 + 附录 B: 30 operators = 28 condition operators + 2 condition modifiers
 *  - §5.2: 28 condition operators → expression-tree compile mapping
 *    (13 direct + 6 via-not + 9 length/count composite)
 *  - §6 + 附录 C: 13 base decision types (the result.decision value domain)
 *  - §5.3 + 附录 A: 34 semantic nodes (10 groups, FREEZE-2)
 *
 * Freeze level: operator/node sets are `[FREEZE-2]` (additive-only, no semantic change);
 * the 13-decision value domain enters the audit chain with the DO.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-28
 * @license BSL 1.1
 */

// ═══════════════════════════════════════════════════════════════
// 1. Operators (SPEC §5.2: 28 conditions + 2 modifiers = 30)
// ═══════════════════════════════════════════════════════════════

/** Comparison family (6) (§5.2) */
export const OP_COMPARE = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] as const;
/** List family (2) */
export const OP_LIST = ['in', 'not_in'] as const;
/** String family (5) */
export const OP_STRING = ['contains', 'not_contains', 'match', 'starts_with', 'ends_with'] as const;
/** Boundary-negation family (2) */
export const OP_BOUNDARY_NEG = ['not_starts_with', 'not_ends_with'] as const;
/** Existence family (2 — the only operators that sense field absence) */
export const OP_EXISTENCE = ['exists', 'not_exists'] as const;
/** Length family (5) */
export const OP_LENGTH = [
  'length_gt',
  'length_gte',
  'length_lt',
  'length_lte',
  'length_eq',
] as const;
/** Range family (2) */
export const OP_RANGE = ['between', 'not_between'] as const;
/** Count family (4) */
export const OP_COUNT = ['count_gt', 'count_gte', 'count_lt', 'count_lte'] as const;

/** 28 condition operators (compiled into the expression-tree evaluator, §5.2) */
export const CONDITION_OPERATORS = [
  ...OP_COMPARE,
  ...OP_LIST,
  ...OP_STRING,
  ...OP_BOUNDARY_NEG,
  ...OP_EXISTENCE,
  ...OP_LENGTH,
  ...OP_RANGE,
  ...OP_COUNT,
] as const;

/**
 * 2 condition modifiers (stateful operators; state lives outside the tree, maintained by
 * GuardStateManager; the window count enters the DO as `evaluation.temporal_state`,
 * see RFC-002 §2.4).
 * Truth semantics (decided 2026-08-27): count reaches threshold → fire; below → record + allow.
 *  - rate   = rate limiting: allow + count the first N, fire from the (N+1)-th
 *    (nginx limit_req / Redis INCR semantics)
 *  - within = the threshold-1 form of rate: allow + record the first, fire from the 2nd
 *    within the window (dedup)
 */
export const CONDITION_MODIFIERS = ['within', 'rate'] as const;

/** Full set of 30 semantic units (28 conditions + 2 modifiers) */
export const ALL_OPERATORS = [...CONDITION_OPERATORS, ...CONDITION_MODIFIERS] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];
export type ConditionModifier = (typeof CONDITION_MODIFIERS)[number];
export type AnyOperator = (typeof ALL_OPERATORS)[number];

/**
 * The **value shape** of each operator (added in the 2026-08-28 full review).
 *
 * Why it is needed: template authoring and UI dropdowns can only offer operators whose
 * value shape matches the input. Example: a template's value is a scalar input; if `between`
 * (which requires a `[min, max]` pair) appears in the dropdown, selecting it always fails
 * compilation with "between requires a [min, max] array" — selectable but guaranteed to break.
 * Value shape previously lived only in a human-readable table; it now lives in the single
 * source of truth, shared by UI / validator / LLM prompt.
 */
export const OP_VALUE_NONE = ['exists', 'not_exists'] as const;
export const OP_VALUE_ARRAY = ['in', 'not_in'] as const;
export const OP_VALUE_TUPLE = ['between', 'not_between'] as const;
/** Operators whose value is scalar (number/string/bool/regex) = 28 minus the three classes above */
export const OP_VALUE_SCALAR = CONDITION_OPERATORS.filter(
  op =>
    !(OP_VALUE_NONE as readonly string[]).includes(op) &&
    !(OP_VALUE_ARRAY as readonly string[]).includes(op) &&
    !(OP_VALUE_TUPLE as readonly string[]).includes(op),
) as readonly ConditionOperator[];

export type OperatorValueShape = 'none' | 'scalar' | 'array' | 'tuple';

/** The expected value shape for a given operator */
export function operatorValueShape(op: string): OperatorValueShape | null {
  if ((OP_VALUE_NONE as readonly string[]).includes(op)) return 'none';
  if ((OP_VALUE_ARRAY as readonly string[]).includes(op)) return 'array';
  if ((OP_VALUE_TUPLE as readonly string[]).includes(op)) return 'tuple';
  if ((CONDITION_OPERATORS as readonly string[]).includes(op)) return 'scalar';
  return null;
}

/**
 * Lenient parse aliases (historical compatibility; NOT new operators).
 * After normalization they MUST fall within CONDITION_OPERATORS. SPEC §5.2
 * registers these two aliases (宽容别名): matches→match, neq→ne.
 */
export const OPERATOR_ALIASES: Readonly<Record<string, ConditionOperator>> = Object.freeze({
  matches: 'match',
  neq: 'ne',
});

/** §5.2 compile-destination classification (used by vectors and docs to self-verify "no dangling") */
export const OP_COMPILE_DIRECT = [
  ...OP_COMPARE,
  'in',
  'contains',
  'starts_with',
  'ends_with',
  'match',
  'exists',
  'between',
] as const;
export const OP_COMPILE_VIA_NOT = [
  'not_in',
  'not_contains',
  'not_starts_with',
  'not_ends_with',
  'not_exists',
  'not_between',
] as const;
export const OP_COMPILE_VIA_LENGTH_COUNT = [...OP_LENGTH, ...OP_COUNT] as const;

export function isConditionOperator(v: unknown): v is ConditionOperator {
  return typeof v === 'string' && (CONDITION_OPERATORS as readonly string[]).includes(v);
}

/** Normalize an operator name (including aliases); returns null if invalid */
export function normalizeOperatorName(op: string | undefined | null): ConditionOperator | null {
  if (!op) return null;
  const mapped = OPERATOR_ALIASES[op] ?? op;
  return isConditionOperator(mapped) ? mapped : null;
}

// ═══════════════════════════════════════════════════════════════
// 2. Decisions (SPEC §6 + 附录 C: 13 base decisions = DO result.decision value domain)
// ═══════════════════════════════════════════════════════════════

/** 13 base decision types (the **only** value domain allowed into DO `result.decision`, §6 + 附录 C authoritative enum) */
export const DO_DECISIONS = [
  'ALLOW',
  'DENY',
  'CORRECT',
  'NOTIFY',
  'REQUEST_HUMAN',
  'ESCALATE',
  'DELEGATE',
  'DEFER',
  'EMERGENCY_HALT',
  'ROLLBACK',
  'QUARANTINE',
  'WORKFLOW',
  'GUIDE',
] as const;

/** WORKFLOW state-machine substates (not independent decision types, not counted in 13) */
export const WORKFLOW_SUBSTATES = ['WORKFLOW_WAITING', 'WORKFLOW_PROGRESS'] as const;
/** 4 internal reasoning actions (do not enter the DO) */
export const INTERNAL_REASONING = ['STRATEGIZE', 'AUDIT', 'CALCULATE', 'VALIDATE'] as const;
/** Internal state (does not enter the DO) */
export const INTERNAL_STATES = ['PASS'] as const;
/** rulsynor extension (post-audit pipeline; outside the SPEC 13) */
export const RULSYNOR_EXTENSIONS = ['CENSOR'] as const;

/** All decision identifiers the engine can flow internally (21 = 13 + 2 substates + 4 reasoning + 1 state + 1 extension) */
export const ALL_DECISIONS = [
  ...DO_DECISIONS,
  ...WORKFLOW_SUBSTATES,
  ...INTERNAL_REASONING,
  ...INTERNAL_STATES,
  ...RULSYNOR_EXTENSIONS,
] as const;

/**
 * Decision subset allowed in Guard rules (2026-08-28 review consolidation: originally a
 * local array in rule-validator). = Ring 0-2 actions + Ring 3 exception (ALLOW/CORRECT).
 * Internal reasoning actions (STRATEGIZE etc.) must not enter Guard.
 */
export const GUARD_ALLOWED_DECISIONS = [
  'DENY',
  'EMERGENCY_HALT', // Ring 0
  'ROLLBACK',
  'QUARANTINE', // Ring 1
  'REQUEST_HUMAN',
  'ESCALATE',
  'DELEGATE', // Ring 2
  'CORRECT',
  'ALLOW', // Ring 3 exception
] as const;

/** Blocking decisions (quality-gate wild-when-with-blocking-then etc. judge by this).
 *  6 = DENY + its action variants ROLLBACK/QUARANTINE + CORRECT + REQUEST_HUMAN + EMERGENCY_HALT.
 *  Consolidated 2026-09-06: ROLLBACK/QUARANTINE reclassified as restrictive (blocking)
 *  polarity (SPEC §6), so an unconditional `when:true` + ROLLBACK/QUARANTINE is as unsafe
 *  as `when:true` + DENY and must be rejected the same way. */
export const BLOCKING_DECISIONS = ['DENY', 'CORRECT', 'REQUEST_HUMAN', 'EMERGENCY_HALT', 'ROLLBACK', 'QUARANTINE'] as const;

export type DODecision = (typeof DO_DECISIONS)[number];
export type Decision = (typeof ALL_DECISIONS)[number];

/** Whether a value may enter the DO result.decision (§6 value-domain gate) */
export function isDODecision(v: unknown): v is DODecision {
  return typeof v === 'string' && (DO_DECISIONS as readonly string[]).includes(v);
}
export function isDecision(v: unknown): v is Decision {
  return typeof v === 'string' && (ALL_DECISIONS as readonly string[]).includes(v);
}

// ═══════════════════════════════════════════════════════════════
// 3. Rule categories
// ═══════════════════════════════════════════════════════════════

/**
 * Rule categories (ADR-001, 2026-08-28): 11 in total.
 * `observability` was added 2026-08-28 — research verified it was already used in 5 code
 * sites (validator/serializer/import/template/frontend) and 1 existing rule; the kernel type
 * missing it was the drifting side. Category enums are not FREEZE-2 frozen, so additive.
 */
export const RULE_CATEGORIES = [
  'coding',
  'engineering',
  'security',
  'writing',
  'design',
  'performance',
  'testing',
  'compliance',
  'accessibility',
  'observability',
  'custom',
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

/**
 * Rule-name CAT prefix registry (ADR-003, registration-based extensible, not a closed set).
 * Prefix → category. New business-domain prefixes MUST be registered here and synced to the
 * SPEC before use; "use first, register later" is forbidden. The name gate checks this table
 * unconditionally (the historical implementation only looked it up when the regex failed,
 * making the whitelist ineffective — fixed).
 */
export const RULE_NAME_PREFIXES: Readonly<Record<string, RuleCategory>> = Object.freeze({
  SEC: 'security',
  COD: 'coding',
  ENG: 'engineering',
  PRF: 'performance',
  TST: 'testing',
  WRT: 'writing',
  OBS: 'observability',
  CUS: 'custom',
  ETH: 'compliance', // Ethics
  CMP: 'compliance', // Compliance
  POL: 'compliance', // Policy
  OCC: 'custom', // Occupation
  CNV: 'writing', // Convention
  SBP: 'compliance', // Soil & water conservation Balance Plan (106 existing rules, ADR-003 registered)
});

/**
 * Occupation categories (ADR-004) — a domain independent of rule categories
 * (occupation = organizational role classification). Current inventory: only `review`;
 * new ones go through registration, validated on occupation assembly.
 */
export const OCCUPATION_CATEGORIES = ['review'] as const;
export type OccupationCategory = (typeof OCCUPATION_CATEGORIES)[number];

// ═══════════════════════════════════════════════════════════════
// 4. 34 semantic nodes (SPEC §5.3, FREEZE-2) — countable per group, no dangling
// ═══════════════════════════════════════════════════════════════

/**
 * 34 semantic nodes listed per group (10 groups). The relationship to the 20 discriminant
 * types in `expr-tree/node-types.ts` is "semantic node ↔ type projection" (parameterized
 * nodes merged), not a count contradiction (§5.3).
 */
export const SEMANTIC_NODES = Object.freeze({
  Values: ['field', 'var', 'literal'],
  Logic: ['and', 'or', 'not'],
  Comparison: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  Set: ['in'],
  String: ['contains', 'match', 'starts_with', 'ends_with'],
  Existence: ['exists', 'length', 'between'],
  Quantifier: ['all', 'any', 'none'],
  Arithmetic: ['add', 'sub', 'mul', 'div', 'round'],
  Time: ['days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day'],
  Aggregate: ['aggregate'],
}) as Readonly<Record<string, readonly string[]>>;

/** Flattened list of the 34 semantic nodes */
export const SEMANTIC_NODE_NAMES: readonly string[] = Object.freeze(
  Object.values(SEMANTIC_NODES).flat(),
);

/** Full set of expression-tree discriminant types (20, ExprNode['type'] in node-types.ts) */
export const EXPR_NODE_TYPES = [
  'field',
  'var',
  'literal',
  'and',
  'or',
  'not',
  'compare',
  'in',
  'string',
  'exists',
  'length',
  'between',
  'quantifier',
  'arith',
  'days_between',
  'epoch_ms',
  'date_add',
  'date_part',
  'month_last_day',
  'aggregate',
] as const;

// ═══════════════════════════════════════════════════════════════
// 5. Self-verifying constants (for docs/prompt/tests; prevent hand-written number drift)
// ═══════════════════════════════════════════════════════════════

export const SCHEMA_COUNTS = Object.freeze({
  conditionOperators: CONDITION_OPERATORS.length, // 28
  conditionModifiers: CONDITION_MODIFIERS.length, // 2
  allOperators: ALL_OPERATORS.length, // 30
  doDecisions: DO_DECISIONS.length, // 13
  allDecisions: ALL_DECISIONS.length, // 21
  semanticNodes: SEMANTIC_NODE_NAMES.length, // 34
  exprNodeTypes: EXPR_NODE_TYPES.length, // 20
  ruleCategories: RULE_CATEGORIES.length, // 11 (ADR-001)
  ruleNamePrefixes: Object.keys(RULE_NAME_PREFIXES).length, // 14 (ADR-003)
  occupationCategories: OCCUPATION_CATEGORIES.length, // 1 (ADR-004)
});

/** SPEC alignment baseline (editing this file MUST re-check the SPEC master line numbers) */
export const SPEC_BASELINE = Object.freeze({
  spec: 'erdl-spec-v2.1',
  operators: '§5.2 + 附录 B (30 = 28 + 2)',
  decisions: '§6 + 附录 C (13)',
  nodes: '§5.3 + 附录 A (34 nodes, 10 groups)',
  temporalSemantics: 'RFC-002 §2.4 + semantics decided 2026-08-27',
});
