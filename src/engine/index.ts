export { Evaluator, type CompiledRule, type MatchCondition, type EvalContext, type EvalResult, type MatchedRuleDetail } from './evaluator.js';
export { SafeExprEvaluator, safeExprFromCondition } from './safe-expr.js';
// NOTE: RuleCompilerImpl uses import.meta.url for vector loading — not test-safe.
// Use direct import from './rule-compiler.js' in production code.
// export { RuleCompilerImpl } from './rule-compiler.js';
export { ERDLFnRegistry } from './fn-registry.js';
// NOTE: OpSemRegistry uses import.meta.url for yaml loading — not test-safe.
// export { OpSemRegistry } from './op-sem-registry.js';
export { GuardStateManager } from './guard-state-manager.js';
export type { RuleDefinition, RuleMatch } from './rule-definition.js';
