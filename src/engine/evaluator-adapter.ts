/**
 * EvaluatorAdapter — rulsynor-core → rulsynor GuardService integration bridge
 *
 * Wraps @rulsynor/core's three-layer Evaluator behind the interface
 * that rulsynor's GuardService expects.
 *
 * This file lives in rulsynor-core as it's the integration point between
 * core engine and NestJS server. When core is mature, this adapter moves
 * into repos/rulsynor alongside GuardService.
 *
 * Feature flag: RULSYNOR_USE_CORE_EVALUATOR=true → use core, else legacy.
 *
 * @author Tang Haoran · OpenOBA AI Executive
 * @since 2026-08-03
 */

import { Evaluator } from './evaluator.js';
import { GuardStateManager } from './guard-state-manager.js';
import { VirtualClock } from './clock.js';
import type { CompiledRule, MatchCondition, EvalContext, EvalResult } from './evaluator.js';

/**
 * Legacy-compatible evaluation result (mirrors repos/rulsynor EvaluationResult)
 */
export interface LegacyEvalResult {
  decision: string;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    decision: string;
    reason?: string;
    ring?: number;
    priority: number;
  }>;
  primaryReason?: string;
  primaryInstruction?: string;
  totalEvaluated: number;
  totalMatched: number;
}

/**
 * Legacy-compatible rule input (mirrors repos/rulsynor RuleDefinition subset)
 */
export interface LegacyRuleInput {
  id: string;
  name: string;
  priority: number;
  conditions: Array<{ field?: string; operator?: string; value?: unknown }>;
  conditionLogic?: 'AND' | 'OR';
  action: { decision: string; reason?: string; instruction?: string; ring?: number };
  enabled: boolean;
}

/**
 * Converts legacy rulsynor RuleDefinition to core CompiledRule
 */
export function toCoreRule(rule: LegacyRuleInput): CompiledRule {
  return {
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    ring: rule.action.ring ?? 3,
    decision: rule.action.decision,
    reason: rule.action.reason || rule.action.instruction || '',
    conditions: (rule.conditions || [])
      .filter(c => c.field)
      .map(c => ({
        field: c.field!,
        operator: c.operator || 'eq',
        value: c.value,
      })),
    conditionLogic: rule.conditionLogic || 'AND',
    enabled: rule.enabled,
  };
}

/**
 * Converts core EvalResult to legacy EvaluationResult format
 */
export function toLegacyResult(coreResult: EvalResult, totalEvaluated: number): LegacyEvalResult {
  const match = coreResult.matchedRuleId ? {
    ruleId: coreResult.matchedRuleId,
    ruleName: coreResult.matchedRuleName || '',
    decision: coreResult.decision,
    reason: coreResult.reason,
    ring: coreResult.ring,
    priority: 100,
  } : null;

  return {
    decision: coreResult.decision,
    matchedRules: match ? [match] : [],
    primaryReason: coreResult.reason,
    primaryInstruction: undefined,
    totalEvaluated,
    totalMatched: match ? 1 : 0,
  };
}

/**
 * Builds EvalContext from rulsynor GuardInput-like context
 */
export function toCoreContext(input: {
  toolName: string;
  toolArgs: Record<string, unknown>;
  context: Record<string, unknown>;
  sessionId: string;
  agentId: string;
}): EvalContext {
  const ctx: EvalContext = {
    toolName: input.toolName,
    toolArgs: input.toolArgs,
    sessionId: input.sessionId,
    agentId: input.agentId,
  };
  // Flatten context fields for dot-notation field resolution
  for (const [key, value] of Object.entries(input.context)) {
    ctx[key] = value;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        ctx[`${key}.${subKey}`] = subValue;
      }
    }
  }
  for (const [key, value] of Object.entries(input.toolArgs)) {
    ctx[`tool.args.${key}`] = value;
  }
  ctx['tool.name'] = input.toolName;
  return ctx;
}

/**
 * EvaluatorAdapter — wraps core engine for rulsynor consumption.
 *
 * Usage in GuardService (when integrated):
 *   const adapter = new EvaluatorAdapter();
 *   const coreRules = rules.map(toCoreRule);
 *   const coreCtx = toCoreContext(input);
 *   const result = adapter.evaluate(coreRules, coreCtx);
 */
export class EvaluatorAdapter {
  private readonly engine: Evaluator;

  constructor() {
    const clock = new VirtualClock();
    const stateManager = new GuardStateManager(clock);
    this.engine = new Evaluator(stateManager);
  }

  evaluate(rules: CompiledRule[], context: EvalContext): EvalResult {
    return this.engine.evaluate(context, rules);
  }
}
