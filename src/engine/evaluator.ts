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
import { evaluateCondition } from './runtime-evaluator.js';

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

    for (const rule of sorted) {
      if (!rule.enabled) continue;

      // Separate temporal (within/rate) from stateless conditions
      const temporalConditions = rule.conditions.filter(
        c => c.operator === 'within' || c.operator === 'rate',
      );
      const statelessConditions = rule.conditions.filter(
        c => c.operator !== 'within' && c.operator !== 'rate',
      );

      // 1. Evaluate stateless conditions first (no side effects)
      if (statelessConditions.length > 0) {
        const matched = evaluateConditionGroup(statelessConditions, rule.conditionLogic, context);
        if (!matched) continue;
      }

      // 2. Read-only temporal check (query, do NOT write)
      if (temporalConditions.length > 0) {
        for (const c of temporalConditions) {
          if (c.operator === 'within' && typeof c.value === 'number') {
            const windowMs = c.windowMs || 60000;
            const limit = c.value as number;
            // \u0000 separator prevents collision: "a:b"+"c" ≠ "a"+"b:c"
            const withinKey = `${rule.id}\u0000${context.toolName}`;
            const count = this.stateManager.getWithinCount(withinKey, windowMs);
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
          if (c.operator === 'rate' && typeof c.value === 'number') {
            const windowMs = c.windowMs || 60000;
            const limit = c.value as number;
            const rateKey = `${rule.id}\u0000${context.toolName}`;
            const count = this.stateManager.getRateCount(rateKey);
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
      }

      // Rule matched (all conditions passed)
      return {
        decision: rule.decision,
        reason: rule.reason,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        severity: rule.severity || 'LOW',
        ring: rule.ring,
      };
    }

    return {
      decision: 'ALLOW',
      reason: 'No rules matched — default ALLOW',
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
        if (c.operator === 'within' && typeof c.value === 'number') {
          this.stateManager.recordWithin(`${rule.id}\u0000${context.toolName}`, c.windowMs || 60000);
        }
        if (c.operator === 'rate' && typeof c.value === 'number') {
          this.stateManager.recordRate(`${rule.id}\u0000${context.toolName}`, c.windowMs || 60000);
        }
      }
    }
  }
}
