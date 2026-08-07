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
import { sortRulesByRingAndPriority, evaluateConditionGroup } from './static-rule-tree.js';

/** 评估上下文 */
export interface EvalContext {
  toolName: string;
  toolArgs: Record<string, unknown>;
  sessionId: string;
  agentId: string;
  [key: string]: unknown;
}

/** 匹配条件 */
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
  /** ERDL then.alternative — suggested alternative action when blocked */
  alternative?: string;
  /** ERDL then.correction — correction target text (CORRECT decision) */
  correction?: string;
}

/** 单个匹配规则的详情 */
export interface MatchedRuleDetail {
  ruleId: string;
  decision: string;
  reason?: string | null;
  instruction?: string | null;
  correction?: string | null;
  ring?: number;
}

/** 评估结果 */
export interface EvalResult {
  decision: string;
  reason: string;
  matchedRuleId?: string;
  matchedRuleName?: string;
  severity?: string;
  ring?: number;
  /** 所有匹配到的规则详情（含 within/rate 触发的） */
  matchedRules?: MatchedRuleDetail[];
  /** 评估的规则总数 */
  totalEvaluated?: number;
  /** 匹配的规则总数 */
  totalMatched?: number;
}

/**
 * Evaluator — 规则评估引擎（编排层）
 *
 * Ring+Priority 排序后 first-match-wins。
 * within/rate 条件仅做只读查询（不写），避免副作用污染计数器。
 * 时序计数器由调用方在 actionTaken='allowed' 后通过 commitTemporal 提交。
 */
export class Evaluator {
  private stateManager: GuardStateManager;

  constructor(stateManager: GuardStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * 评估 tool_call 是否通过所有规则
   *
   * Ring+Priority 排序后 first-match-wins。
   * within/rate 仅查询（不写），避免 DENY 污染计数器。
   */
  evaluate(context: EvalContext, rules: CompiledRule[]): EvalResult {
    const sorted = sortRulesByRingAndPriority(rules);
    let totalEvaluated = 0;
    let totalMatched = 0;

    for (const rule of sorted) {
      if (!rule.enabled) continue;
      totalEvaluated++;

      // Rule with zero conditions → match-all (safety: require explicit ALLOW; deny by deafult for catch-all)
      if (!rule.conditions || rule.conditions.length === 0) {
        totalMatched++;
        return this.buildResult(rule, totalEvaluated, totalMatched);
      }

      // Separate temporal (within/rate) from stateless conditions
      const temporalConditions = rule.conditions.filter(
        c => c.operator === 'within' || c.operator === 'rate',
      );
      const statelessConditions = rule.conditions.filter(
        c => c.operator !== 'within' && c.operator !== 'rate',
      );

      // Evaluate with conditionLogic semantics
      // For AND: stateless AND temporal must ALL pass
      // For OR:  stateless OR temporal must pass (any match wins)
      let statelessMatched = true;
      let temporalMatched = true;

      if (statelessConditions.length > 0) {
        statelessMatched = evaluateConditionGroup(statelessConditions, rule.conditionLogic, context);
      }

      if (temporalConditions.length > 0) {
        temporalMatched = this.evaluateTemporalConditions(temporalConditions);
      }

      // Combine based on rule's condition logic
      const hasStateless = statelessConditions.length > 0;
      const hasTemporal = temporalConditions.length > 0;

      let ruleMatched = false;
      if (!hasStateless && !hasTemporal) {
        // No conditions → match (shouldn't happen, caught above)
        ruleMatched = true;
      } else if (rule.conditionLogic === 'AND') {
        ruleMatched = (!hasStateless || statelessMatched) && (!hasTemporal || temporalMatched);
      } else {
        // OR: any side matching wins
        ruleMatched = (hasStateless && statelessMatched) || (hasTemporal && temporalMatched);
      }

      if (!ruleMatched) continue;

      totalMatched++;

      // If temporal conditions exist and threshold NOT exceeded, the rule does NOT fire.
      // within/rate are inverse: they only fire when the threshold IS exceeded.
      if (temporalConditions.length > 0) {
        const temporalFired = this.checkTemporalExceeded(temporalConditions, rule, context);
        if (!temporalFired) continue; // threshold not reached → skip this rule
        return temporalFired;
      }

      // Rule matched (all stateless conditions passed, no temporal conditions)
      return this.buildResult(rule, totalEvaluated, totalMatched);
    }

    return {
      decision: 'ALLOW',
      reason: 'No rules matched — default ALLOW',
      totalEvaluated,
      totalMatched: 0,
    };
  }

  /** Evaluate temporal conditions — check if the temporal pattern matches (not threshold). */
  private evaluateTemporalConditions(temporalConditions: MatchCondition[]): boolean {
    // Temporal conditions are always considered "matching" if they exist —
    // the runtime counter is the actual gate. We only reject if the value is
    // unparseable (which means the condition is malformed).
    for (const c of temporalConditions) {
      const numericValue = typeof c.value === 'number' ? c.value
        : typeof c.value === 'string' ? Number(c.value) : NaN;
      if (isNaN(numericValue)) return false; // malformed condition → no match
    }
    return true;
  }

  /** Check if temporal threshold is exceeded (triggers DENY even on rule match) */
  private checkTemporalExceeded(
    temporalConditions: MatchCondition[],
    rule: CompiledRule,
    context: EvalContext,
  ): EvalResult | null {
    for (const c of temporalConditions) {
      const numericValue = typeof c.value === 'number' ? c.value
        : typeof c.value === 'string' ? Number(c.value) : NaN;
      if (isNaN(numericValue)) continue;
      const windowMs = c.windowMs || 60000;
      const limit = numericValue;
      const tKey = `${rule.id}\u0000${context.toolName}`;
      if (c.operator === 'within') {
        const count = this.stateManager.getWithinCount(tKey, windowMs);
        if (count >= limit) {
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
      if (c.operator === 'rate') {
        const count = this.stateManager.getRateCount(tKey);
        if (count >= limit) {
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
    return null;
  }

  /** Build a consistent EvalResult for a matched rule */
  private buildResult(rule: CompiledRule, totalEvaluated: number, totalMatched: number): EvalResult {
    return {
      decision: rule.decision,
      reason: rule.reason,
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
      severity: rule.severity || 'LOW',
      ring: rule.ring,
      matchedRules: [{
        ruleId: rule.id,
        decision: rule.decision,
        reason: rule.reason,
        ring: rule.ring,
        correction: rule.correction,
      }],
      totalEvaluated,
      totalMatched,
    };
  }

  /**
   * 提交时序计数器（调用方在 actionTaken='allowed' 后调用）
   */
  commitTemporal(context: EvalContext, matchedRules: CompiledRule[]): void {
    const sorted = sortRulesByRingAndPriority(matchedRules);
    for (const rule of sorted) {
      const temporal = rule.conditions.filter(c => c.operator === 'within' || c.operator === 'rate');
      for (const c of temporal) {
        const numericValue = typeof c.value === 'number' ? c.value
          : typeof c.value === 'string' ? Number(c.value) : NaN;
        if (isNaN(numericValue)) continue;
        const tKey = `${rule.id}\u0000${context.toolName}`;
        const windowMs = c.windowMs || 60000;
        if (c.operator === 'within') {
          this.stateManager.recordWithin(tKey, windowMs);
        }
        if (c.operator === 'rate') {
          this.stateManager.recordRate(tKey, windowMs);
        }
      }
    }
  }
}
