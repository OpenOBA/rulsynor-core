/**
 * rule-to-expr — RuleDefinition (flat conditions) → expression-tree compilation (normalization bridge)
 *
 * Compiles the old flat evaluator's (evaluator.ts) RuleCondition[] into an expression tree,
 * for shadow verification (old vs new) and normalization (replacing the condition evaluation layer).
 *
 * Alignment semantics:
 * - operator alias normalization: matches→match, neq→ne (consistent with the old evaluator's v1.3 aliasing)
 * - only pure conditions are compiled (field+operator+value); within/rate/pattern/keywords are not compiled (stateful/non-pure)
 * - conditionLogic: AND (default) / OR → and/or tree
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license MIT
 */

import type { RuleDefinition, RuleCondition } from '../rule-definition.js';
import type { ExprNode } from './node-types.js';
import { fromSExpr, extractWhenExpr } from './s-expression.js';
import {
  compileSimpleConditions,
  type SimpleCondition,
  type SimpleOperator,
} from './simple-compiler.js';
import { CONDITION_OPERATORS } from '../erdl-schema.js';

/** RuleCondition's operator → SimpleOperator (normalize aliases + filter non-pure operators) */
export function normalizeOperator(op: string | undefined): SimpleOperator | null {
  if (!op) return null;
  // Alias normalization (consistent with the old evaluator v1.3 aliasing)
  if (op === 'matches') op = 'match';
  if (op === 'neq') op = 'ne';
  // Check whether it is a SimpleOperator
  // 2026-08-28 review consolidation: originally a local 28-item array (a second enum). Now uses the single source of truth.
  return (CONDITION_OPERATORS as readonly string[]).includes(op) ? (op as SimpleOperator) : null;
}

/** A single RuleCondition → SimpleCondition (returns null when not compilable) */
export function ruleConditionToSimple(cond: RuleCondition): SimpleCondition | null {
  // Non-pure conditions (within/rate/pattern/keywords) are not compiled
  if (cond.within || cond.rate || cond.pattern || cond.keywords) return null;
  const field = cond.field;
  if (!field) return null;
  const op = normalizeOperator(cond.operator);
  if (op === null) return null;
  return { field, operator: op, value: cond.value };
}

/**
 * RuleDefinition's when condition → expression tree.
 * Returns null when the rule contains non-pure conditions (within/rate/pattern/keywords) and cannot compile to a pure tree.
 */
export function ruleWhenToExpr(rule: RuleDefinition): ExprNode | null {
  const conds = rule.conditions ?? [];
  if (conds.length === 0) {
    // Empty condition = always true (catch-all)
    return { type: 'literal', value: true };
  }
  const simples: SimpleCondition[] = [];
  for (const cond of conds) {
    const s = ruleConditionToSimple(cond);
    if (s === null) return null; // contains a non-pure condition
    simples.push(s);
  }
  const logic = rule.conditionLogic ?? 'AND';
  return compileSimpleConditions(simples, logic);
}

/**
 * The when of an LLM-generated rule JSON → expression tree (unified entry, supports both forms).
 *
 * Two when forms:
 * - flat { logic, conditions } (Simple projection)
 * - S-expression expression tree (Expression projection, including extension nodes like time operations)
 *
 * For NL generation entries like regulation-rule / rule.service computeGlossGrade; tolerates
 * irregular JSON + alias normalization. Returns null when not compilable.
 */
export function jsonWhenToExpr(when: Record<string, unknown>): ExprNode | null {
  // §12 Expression projection: prefer the when.expr wrapped form (SPEC §12 authoritative),
  // compatible with the old form where when is a tree at the top level.
  const exprValue = extractWhenExpr(when);
  if (exprValue !== null) {
    try {
      return fromSExpr(exprValue);
    } catch {
      return null;
    }
  }

  const conds = when?.conditions as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(conds) || conds.length === 0) {
    // Empty condition → always true
    return { type: 'literal', value: true };
  }
  const logic = (when.logic as 'AND' | 'OR') ?? 'AND';
  const simples: SimpleCondition[] = [];
  for (const c of conds) {
    const field = c?.field as string | undefined;
    const op = c?.operator as string | undefined;
    if (!field || !op) return null;
    const normOp = normalizeOperator(op);
    if (normOp === null) return null;
    simples.push({ field, operator: normOp, value: c.value });
  }
  return compileSimpleConditions(simples, logic);
}
