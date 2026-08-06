/**
 * StaticRuleTree — 无状态规则决策树（Phase 0 三层拆分）
 *
 * 将 Evaluator 中的规则排序和遍历逻辑提取为独立模块。
 * 负责：按 Ring + Priority 排序规则，条件组 AND/OR 求值。
 *
 * 确定性：纯函数，相同输入 → 相同输出。不持有状态。
 */

import { CompiledRule, MatchCondition, EvalContext, EvalResult } from './evaluator.js';
import { evaluateCondition } from './runtime-evaluator.js';

/**
 * 对规则列表按 SPEC §3.5 Execution Rings + §3.2 priority 排序
 * Ring 0 先评估，Ring 3 最后。
 * 同 Ring 内 priority 升序（值越小越优先）。
 */
export function sortRulesByRingAndPriority(rules: CompiledRule[]): CompiledRule[] {
  return [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => {
      if (a.ring !== b.ring) return a.ring - b.ring;
      return a.priority - b.priority;
    });
}

/**
 * 评估条件组（AND / OR 逻辑）
 */
export function evaluateConditionGroup(
  conditions: MatchCondition[],
  logic: 'AND' | 'OR',
  context: EvalContext,
): boolean {
  if (!conditions || conditions.length === 0) {
    return false;
  }

  if (logic === 'AND') {
    return conditions.every(c => evaluateCondition(c, context));
  }
  return conditions.some(c => evaluateCondition(c, context));
}

/**
 * 遍历规则树，找到第一条匹配规则
 *
 * 按 Ring+Priority 排序后顺序遍历，first-match-wins。
 * 无规则匹配 → ALLOW（默认放行）。
 */
export function findFirstMatchingRule(
  rules: CompiledRule[],
  context: EvalContext,
): EvalResult {
  const sorted = sortRulesByRingAndPriority(rules);

  for (const rule of sorted) {
    const matched = evaluateConditionGroup(
      rule.conditions,
      rule.conditionLogic,
      context,
    );

    if (matched) {
      return {
        decision: rule.decision,
        reason: rule.reason,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        severity: rule.severity,
        ring: rule.ring,
      };
    }
  }

  return {
    decision: 'ALLOW',
    reason: 'No rules matched — default ALLOW',
  };
}
