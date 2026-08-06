/**
 * Evaluator — 规则评估引擎（Phase 0 三层拆分）
 *
 * 三层结构：
 *   - StaticRuleTree：无状态规则排序 + 遍历（src/static-rule-tree.ts）
 *   - RuntimeEvaluator：operator 运行时求值（src/runtime-evaluator.ts）
 *   - GuardStateManager：有状态评估（within/rate 跨步追踪）
 *
 * Evaluator 作为编排层，组合三层。
 * 确定性：相同输入 → 相同输出。零 LLM 参与。
 */

import { GuardStateManager } from './guard-state-manager.js';
import { findFirstMatchingRule } from './static-rule-tree.js';

/** 评估上下文 */
export interface EvalContext {
  toolName: string;
  toolArgs: Record<string, unknown>;
  sessionId: string;
  agentId: string;
  [key: string]: unknown;
}

/** ���配条件 */
export interface MatchCondition {
  field: string;
  operator: string;
  value?: unknown;
  /** SPEC §3.3: 时间窗口 ms（仅 within/rate operator 使用） */
  windowMs?: number;
}

/** 编译后的规则 */
export interface CompiledRule {
  id: string;
  name: string;
  priority: number;
  ring: number;
  decision: string;
  reason: string;
  severity?: string;
  conditions: MatchCondition[];
  conditionLogic: 'AND' | 'OR';
  enabled: boolean;
}

/** 评估结果 */
export interface EvalResult {
  decision: string;
  reason: string;
  matchedRuleId?: string;
  matchedRuleName?: string;
  severity?: string;
  ring?: number;
}

/**
 * Evaluator — 规则评估引擎（编排层）
 *
 * 组合 StaticRuleTree + RuntimeEvaluator + GuardStateManager。
 * 按 Ring+Priority 排序规则，first-match-wins。
 * 无规则匹配 → ALLOW（默认放行）。
 */
export class Evaluator {
  private stateManager: GuardStateManager;

  constructor(stateManager: GuardStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * 评估 tool_call 是否通过所有规则
   *
   * 对齐 SPEC §3.3 within/rate：评估前先检查有状态 operator。
   * within 跨步窗口追踪由 GuardStateManager 管理。
   */
  evaluate(context: EvalContext, rules: CompiledRule[]): EvalResult {
    // Pre-check: 对含有 within/rate 条件的规则，先检查状态窗口
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const temporalConditions = rule.conditions.filter(
        c => c.operator === 'within' || c.operator === 'rate',
      );
      if (temporalConditions.length === 0) continue;

      for (const c of temporalConditions) {
        if (c.operator === 'within' && typeof c.value === 'number') {
          const windowMs = c.windowMs || 60000;
          const limit = c.value as number;
          // Key includes the actual tool name so different tools have independent counters
          const withinKey = `${rule.id}:${context.toolName}`;
          const count = this.stateManager.recordWithin(withinKey, windowMs);
          if (count > limit) {
            return {
              decision: rule.decision,
              reason: `${rule.reason} (within: ${count}/${limit})`,
              matchedRuleId: rule.id,
              matchedRuleName: rule.name,
              severity: rule.severity || 'HIGH',
              ring: rule.ring,
            };
          }
        }
        if (c.operator === 'rate' && typeof c.value === 'number') {
          const windowMs = c.windowMs || 60000;
          const limit = c.value as number;
          const rateKey = `${rule.id}:${context.toolName}`;
          const count = this.stateManager.recordRate(rateKey, windowMs);
          if (count > limit) {
            return {
              decision: rule.decision,
              reason: `${rule.reason} (rate: ${count}/${limit})`,
              matchedRuleId: rule.id,
              matchedRuleName: rule.name,
              severity: rule.severity || 'HIGH',
              ring: rule.ring,
            };
          }
        }
      }
    }

    // Standard evaluation: first-match-wins on stateless conditions
    return findFirstMatchingRule(rules, context);
  }
}
