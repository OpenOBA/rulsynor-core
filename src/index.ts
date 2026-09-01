export { Evaluator, ERDLFnRegistry, GuardStateManager } from './engine/index.js';
export type {
  RuleDefinition,
  RuleMatch,
  EvaluationResult,
  RuleCondition,
  Decision,
  OverrideLevel,
  RingLevel,
  RuleAction,
} from './engine/index.js';
export { safeRegExp, SafeRegExpError } from './engine/safe-regex.js';
// 2026-08-28: the deterministic-kernel single source of truth is exported outward. Previously erdl-schema was not re-exported via index,
// so external consumers (incl. third-party integrations, LLM schema injectors) could not access the operator/decision/node/category enums,
// the "single source of truth" only held within the repo and was unavailable externally — a substantive gap, now filled.
export {
  OP_COMPARE,
  OP_LIST,
  OP_STRING,
  OP_BOUNDARY_NEG,
  OP_EXISTENCE,
  OP_LENGTH,
  OP_RANGE,
  OP_COUNT,
  CONDITION_OPERATORS,
  CONDITION_MODIFIERS,
  ALL_OPERATORS,
  OP_VALUE_NONE,
  OP_VALUE_ARRAY,
  OP_VALUE_TUPLE,
  OP_VALUE_SCALAR,
  operatorValueShape,
  OPERATOR_ALIASES,
  OP_COMPILE_DIRECT,
  OP_COMPILE_VIA_NOT,
  OP_COMPILE_VIA_LENGTH_COUNT,
  isConditionOperator,
  normalizeOperatorName,
  DO_DECISIONS,
  WORKFLOW_SUBSTATES,
  INTERNAL_REASONING,
  INTERNAL_STATES,
  RULSYNOR_EXTENSIONS,
  ALL_DECISIONS,
  GUARD_ALLOWED_DECISIONS,
  BLOCKING_DECISIONS,
  isDODecision,
  isDecision,
  RULE_CATEGORIES,
  RULE_NAME_PREFIXES,
  OCCUPATION_CATEGORIES,
  SEMANTIC_NODES,
  SEMANTIC_NODE_NAMES,
  EXPR_NODE_TYPES,
  SCHEMA_COUNTS,
  SPEC_BASELINE,
} from './engine/erdl-schema.js';
export type {
  ConditionOperator,
  ConditionModifier,
  AnyOperator,
  OperatorValueShape,
  DODecision,
  RuleCategory,
  OccupationCategory,
} from './engine/erdl-schema.js';
export { buildDecisionObject, generateAID } from './guard/index.js';
export type {
  DecisionObject,
  DecisionObjectInput,
  GuardInput,
  RuleMatch as GuardRuleMatch,
  RuleDefinition as GuardRuleDefinition,
} from './guard/index.js';
export { getComplianceProfile, resetComplianceProfileCache } from './compliance/index.js';
export type { ComplianceProfile, RegulatoryReference } from './compliance/index.js';
export { PROVENANCE } from './provenance.js';
export {
  loadPresetRules,
  toRuleDefinitions,
  toERDLRuleSet,
  toCompiledRules,
} from './rules/index.js';
export type { PresetRule } from './rules/index.js';
export {
  advanceCorrectLoop,
  parseRequestHumanSignal,
  buildDoPayload,
  assignAbArm,
  trustLabel,
  parseToolCalls,
} from './preflight/index.js';
export type {
  CorrectLoopState,
  CorrectLoopContext,
  RequestHumanSignal,
  DoPayload,
  AbArm,
  ToolEnhancement,
  ToolEngineResult,
} from './preflight/index.js';
export { extractNavigationGuide } from './guidance/index.js';
export type { NavigationGuide, GuidanceRuleMatch, GuidanceOptions } from './guidance/index.js';
export { runReActLoop, createToolExecutor } from './runtime.js';
export type {
  RuntimeOptions,
  RuntimeResult,
  LLMMessage,
  LLMResponse,
  ToolExecutor,
} from './runtime.js';

// ── Engine advanced APIs ──
export { SystemClock, VirtualClock } from './engine/clock.js';
export type { Clock } from './engine/clock.js';
export { OpSemRegistry } from './engine/op-sem-registry.js';
export { PlanParser } from './engine/plan-parser.js';
export type { ParsedPlan, ParsedPlanStep } from './engine/plan-parser.js';
