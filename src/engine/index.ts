export { Evaluator } from './evaluator.js';
export { ERDLFnRegistry } from './fn-registry.js';
export type { OpSemCode, OpSemResult, RiskLevel } from './op-sem-registry.js';
export { GuardStateManager } from './guard-state-manager.js';
export type {
  RuleDefinition,
  RuleMatch,
  EvaluationResult,
  RuleCondition,
  Decision,
  OverrideLevel,
  RingLevel,
  RuleAction,
  TemporalStateEntry,
} from './rule-definition.js';

// ── expression-tree kernel (E7 single evaluation core) exported outward ──
export { ExprTreeEvaluator, objectContext } from './expr-tree/evaluator.js';
export type { EvalTrace } from './expr-tree/eval-trace.js';
export { renderGloss, renderDecisionTableGloss } from './expr-tree/gloss.js';
export { deriveGradeFromTree } from './expr-tree/grade.js';
export type { RuleGrade } from './expr-tree/grade.js';
export { jsonWhenToExpr, ruleWhenToExpr } from './expr-tree/rule-to-expr.js';
export { fromSExpr } from './expr-tree/s-expression.js';
