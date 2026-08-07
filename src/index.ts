export { Evaluator, SafeExprEvaluator, ERDLFnRegistry, GuardStateManager, type MatchedRuleDetail } from './engine/index.js';
export type { RuleDefinition, RuleMatch, CompiledRule, MatchCondition, EvalContext, EvalResult } from './engine/index.js';
export { buildDecisionObject, generateAID } from './guard/index.js';
export { getComplianceProfile } from './compliance/index.js';
export { PROVENANCE } from './provenance.js';
export { loadPresetRules, toRuleDefinitions, toERDLRuleSet, toCompiledRules } from './rules/index.js';
export { advanceCorrectLoop, parseRequestHumanSignal, buildDoPayload, assignAbArm, trustLabel, parseToolCalls } from './preflight/index.js';
export type { CorrectLoopState, CorrectLoopContext, RequestHumanSignal, DoPayload, AbArm, ToolEnhancement, ToolEngineResult } from './preflight/index.js';
export { extractNavigationGuide } from './guidance/index.js';
export type { NavigationGuide, GuidanceRuleMatch, GuidanceOptions } from './guidance/index.js';
export { runReActLoop, createToolExecutor } from './runtime.js';
export type { RuntimeOptions, RuntimeResult, LLMMessage, LLMResponse, ToolExecutor } from './runtime.js';

// ── Engine advanced APIs (for integrators and adapter consumption) ──
export { EvaluatorAdapter, toCoreRule, toCoreContext, toLegacyResult } from './engine/evaluator-adapter.js';
export type { LegacyEvalResult, LegacyRuleInput } from './engine/evaluator-adapter.js';
export { SystemClock, VirtualClock } from './engine/clock.js';
export type { Clock } from './engine/clock.js';
export { OpSemRegistry } from './engine/op-sem-registry.js';
export type { OpSemCode, OpSemResult, RiskLevel } from './engine/op-sem-registry.js';
export { RuleCompilerImpl } from './engine/rule-compiler.js';