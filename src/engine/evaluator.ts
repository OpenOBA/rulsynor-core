/**
 * ERDL MCP Server — Rule Evaluator (ERDL Spec v2.0 §10 compliant)
 *
 * Execution Rings + override semantics + dual-mode condition evaluation.
 *
 * Algorithm (Spec v2.0 §10):
 *   1. Rules sorted by priority ascending (lower == higher priority)
 *   2. Evaluate in Ring order: Ring 0 first, then Ring 1, 2, 3
 *   3. Within each Ring, first-match-wins (short-circuit)
 *   4. override=true can override a DENY from a HIGHER-priority Ring
 *      (only DENY→ALLOW direction; never to a less-safe state)
 *   5. override within same Ring: override rule runs first regardless of priority
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-07 · updated 2026-07-09 (override + rings)
 * @license MIT
 */

import type {
  RuleDefinition,
  RuleCondition,
  EvaluationResult,
  RuleMatch,
  Decision,
  RingLevel,
  OverrideLevel,
  TemporalStateEntry,
} from './rule-definition.js';
import { GuardStateManager } from './guard-state-manager.js';
import { SystemClock, type Clock } from './clock.js';
import { ExprTreeEvaluator } from './expr-tree/evaluator.js';
import { normalizeOperator } from './expr-tree/rule-to-expr.js';
import { compileSimpleCondition } from './expr-tree/simple-compiler.js';
import { fromSExpr } from './expr-tree/s-expression.js';
import { ExprLimitError } from './expr-tree/limits.js';

// SPEC v2.0 §9: override level ranking — critical > high > normal > low
// normal/low do NOT enable override behavior (§9)
const OVERRIDE_RANK: Record<OverrideLevel, number> = { critical: 0, high: 1, normal: 2, low: 3 };
/** Returns rank for sorting; undefined/non-enabling levels sort last */
function overrideSortRank(rule: RuleDefinition): number {
  if (!rule.override) return 4;
  return OVERRIDE_RANK[rule.override] ?? 4;
}
/** SPEC v2.0 §9: only critical/high enable override behavior */
function overrideEnables(rule: RuleDefinition): boolean {
  return rule.override === 'critical' || rule.override === 'high';
}

export class Evaluator {
  // SPEC v2.0 §11: within/rate 有状态算子 —— 状态外置到 GuardStateManager（2026-08-15）
  // 表达式树/求值保持纯函数（E1）；滑动窗口计数由 stateManager 在树外维护。
  private readonly stateManager: GuardStateManager;

  // 归一（2026-08-15）：条件求值层用表达式树内核（E7 单一求值核心）
  private readonly treeEvaluator = new ExprTreeEvaluator();

  // E-10 fix: evaluation counter for periodic tracker cleanup
  private evalCount = 0;

  /** E9：时间源注入（默认 SystemClock）。测试用 VirtualClock 冻结 as_of，保证可复现。 */
  private readonly clock: Clock;

  /** E9：本次求值的时间基准（asOf）。evaluate() 入口注入一次，禁表达式树内核自读墙钟。
   *  同步求值期间不变，保证同一次决策内所有规则共享同一 asOf。 */
  private asOf: Date | null = null;

  constructor(stateManager?: GuardStateManager, clock?: Clock) {
    this.stateManager = stateManager ?? new GuardStateManager();
    this.clock = clock ?? new SystemClock();
  }

  evaluate(rules: RuleDefinition[], context: Record<string, unknown>): EvaluationResult {
    // E9：注入本次求值的时间基准（asOf）。引擎在此经注入 Clock 读一次时间，表达式树内核保持纯函数。
    this.asOf = new Date(this.clock.now());

    // E-10 fix: periodically clean up expired tracker entries to prevent memory leak
    this.evalCount++;
    if (this.evalCount % 100 === 0) {
      this.stateManager.cleanup(60 * 60 * 1000);
    }

    // E-04 fix: deep clone context to prevent mutation of caller's object
    // evaluate() may set context['workflow.active'] (lines 104, 477) — without cloning,
    // repeated evaluations with the same context object would be polluted by prior workflow state
    // S3 修复：structuredClone 替代 JSON 往返——保留 Date/BigInt、循环引用安全、不剥离 undefined
    context = structuredClone(context);

    // P4.3: if workflow is active, evaluate current step
    if (context['workflow.active']) {
      return this.evaluateWorkflowStep(context);
    }

    const enabled = rules.filter(r => r.enabled);
    if (enabled.length === 0) {
      // SPEC v2.0 §11: metadata.decision fallback takes precedence over default ALLOW
      const metadataDecision = context['metadata.decision'] as string | undefined;
      if (metadataDecision) {
        return {
          decision: metadataDecision as Decision,
          matchedRules: [],
          totalEvaluated: 0,
          totalMatched: 0,
          primaryReason: `No enabled rules; metadata.decision fallback: ${metadataDecision}`,
        };
      }
      // v1.3: no enabled rules → ALLOW (was PASS in v1.1)
      return { decision: 'ALLOW', matchedRules: [], totalEvaluated: 0, totalMatched: 0 };
    }

    // Group by Ring, sort within each Ring by priority (override rules jump to front)
    const byRing = new Map<number, RuleDefinition[]>();
    for (const rule of enabled) {
      const ring = rule.action.ring ?? 3;
      let ringRules = byRing.get(ring);
      if (!ringRules) {
        ringRules = [];
        byRing.set(ring, ringRules);
      }
      ringRules.push(rule);
    }

    // Sort Ring keys ascending (Ring 0 evaluates first)
    const ringKeys = [...byRing.keys()].sort((a, b) => a - b);

    const allMatched: RuleMatch[] = [];
    // RFC-002 §2.4: 有状态算子（within/rate）窗口计数快照（进 DO temporal_state）
    const temporalState: TemporalStateEntry[] = [];
    // SPEC v2.0 §11: unless exemptions recorded separately — NOT in matchedRules
    // (v1.1 vectors DO-024/DO-026 expect matched_rules=[] when only unless fires)
    const unlessExemptions: RuleMatch[] = [];
    let finalDecision: Decision = 'PASS';
    let lastDecisionRing: number | undefined; // track which ring set the current decision
    let finalInstruction: string | undefined;
    let finalReason: string | undefined;
    let finalCorrection: string | undefined;
    let finalExplanation: RuleDefinition['action']['explanation'] | undefined;
    let finalAlternative: RuleDefinition['action']['alternative'] | undefined;

    for (const ring of ringKeys) {
      const ringRules = byRing.get(ring);
      if (!ringRules) continue;

      // SPEC v2.0 §9: sort by priority ascending first, then override level within same priority.
      // v1.3: empty-condition rules (catch-all defaults) sort last within the ring
      // so explicit-condition rules always evaluate first.
      const sortedRingRules = [...ringRules].sort((a, b) => {
        const aEmpty = !a.conditions || a.conditions.length === 0 ? 1 : 0;
        const bEmpty = !b.conditions || b.conditions.length === 0 ? 1 : 0;
        if (aEmpty !== bEmpty) return aEmpty - bEmpty;
        if (a.priority !== b.priority) return a.priority - b.priority;
        const oa = overrideSortRank(a);
        const ob = overrideSortRank(b);
        return oa - ob;
      });

      for (const rule of sortedRingRules) {
        // SPEC v2.0 §11: unless exemption — evaluated BEFORE when
        if (rule.unless?.conditions && rule.unless.conditions.length > 0) {
          const unlessLogic = rule.unless.logic ?? 'AND';
          const unlessExempt =
            unlessLogic === 'OR'
              ? rule.unless.conditions.some(cond => this.evaluateLeaf(cond, context))
              : rule.unless.conditions.every(cond => this.evaluateLeaf(cond, context));
          if (unlessExempt) {
            unlessExemptions.push({
              ruleId: rule.name,
              ruleName: `${rule.name}/unless`,
              decision: 'ALLOW',
              reason: `unless condition matched — rule exempt`,
              priority: rule.priority,
              ring: (rule.action.ring ?? 3) as RingLevel,
            });
            if (finalDecision === 'PASS') {
              finalDecision = 'ALLOW';
              lastDecisionRing = ring;
            }
            continue;
          }
        }

        const matched =
          rule.conditions.length === 0 ||
          (rule.conditionLogic === 'OR'
            ? rule.conditions.some(cond => this.evaluateLeaf(cond, context))
            : rule.conditions.every(cond => this.evaluateLeaf(cond, context)));
        if (!matched) continue;

        const match = this.makeMatch(rule, ring as RingLevel);
        allMatched.push(match);
        // RFC-002 §2.4: 收集有状态算子（within/rate）窗口计数快照进 DO temporal_state
        this.collectTemporalState(rule, temporalState);

        // P4.3: WORKFLOW — if rule has workflow, start workflow mode
        if (match.decision === 'WORKFLOW' && rule.workflow) {
          context['workflow.active'] = {
            rule_name: rule.name,
            rule_id: rule.id,
            steps: rule.workflow.steps,
            current_step: 0,
            started_at: new Date(this.clock.now()),
          };
          // Return immediately to start workflow
          return this.evaluateWorkflowStep(context);
        }

        // SPEC v2.0 §10 + §9: override semantics
        // - override only allows DENY→ALLOW (safe direction); ALLOW→DENY is NOT allowed (DO-011)
        // - override critical/high enables cross-Ring coverage (DO-010: Ring 3 ALLOW covers Ring 0 DENY)
        // - EMERGENCY_HALT short-circuits (DO-013); DENY does NOT short-circuit (DO-010 evaluated=2)
        //
        // §9 gate: once a decision is made, non-override non-terminating rules
        // are treated differently by decision type:
        // - ALLOW + override-enabling + finalDecision=DENY → allow override (below)
        // - ALLOW + non-override + finalDecision=ALLOW → allow instruction accumulation
        // - ALLOW + non-override + finalDecision!=ALLOW → pop (can't change existing decision)
        // - CORRECT/NOTIFY/REQUEST_HUMAN + non-override → pop
        // - DENY/EMERGENCY_HALT: always let through
        if (finalDecision !== 'PASS') {
          const isTerminating = match.decision === 'DENY' || match.decision === 'EMERGENCY_HALT';
          const isAllowAccumulation = match.decision === 'ALLOW' && finalDecision === 'ALLOW';
          if (!overrideEnables(rule) && !isTerminating && !isAllowAccumulation) {
            allMatched.pop();
            continue;
          }
        }

        if (match.decision === 'ALLOW') {
          // override ALLOW covers prior DENY → ALLOW (safe direction, cross-Ring)
          if (overrideEnables(rule) && finalDecision === 'DENY') {
            finalDecision = 'ALLOW';
            lastDecisionRing = ring;
            finalInstruction = match.instruction;
            finalReason = match.reason;
            finalCorrection = match.correction;
            finalExplanation = match.explanation;
            finalAlternative = match.alternative;
            break; // override takes effect, stop evaluating this ring
          }
          if (finalDecision === 'PASS') {
            finalDecision = 'ALLOW';
            lastDecisionRing = ring;
          }
          // §9: accumulate instructions even when finalDecision is already ALLOW
          if (match.instruction) {
            finalInstruction = finalInstruction
              ? `${finalInstruction}; ${match.instruction}`
              : match.instruction;
          }
          continue; // keep evaluating for potential DENY/override rules
        }

        if (match.decision === 'EMERGENCY_HALT') {
          finalDecision = 'EMERGENCY_HALT';
          lastDecisionRing = ring;
          finalReason = match.reason;
          finalInstruction = match.instruction;
          finalExplanation = match.explanation;
          finalAlternative = match.alternative;
          // §9: only EMERGENCY_HALT short-circuits (DO-013 evaluated=1)
          if (ring === 0) {
            return {
              decision: finalDecision,
              matchedRules: allMatched,
              unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
              primaryReason: finalReason ?? `${finalDecision} triggered by Ring 0 rule`,
              primaryExplanation: finalExplanation,
              primaryAlternative: finalAlternative,
              totalEvaluated: allMatched.length, // DO-013: actual evaluated count on short-circuit
              totalMatched: allMatched.length,
              temporalState: temporalState.length > 0 ? temporalState : undefined,
            };
          }
          break; // stop this ring
        }

        if (match.decision === 'DENY') {
          // SPEC v2.0 §9: higher-ring DENY can override lower-ring ALLOW
          // SPEC v2.0 §9 + DO-011: within same ring, DENY does NOT override ALLOW
          // (unsafe direction; same-ring DENY after ALLOW → popped)
          // v1.3: empty-condition catch-all DENY never overrides an explicit-condition ALLOW
          const isCatchAllDeny = !rule.conditions || rule.conditions.length === 0;
          if (isCatchAllDeny && finalDecision === 'ALLOW') {
            allMatched.pop();
            continue;
          }
          if (finalDecision === 'PASS' || finalDecision === 'DENY') {
            finalDecision = 'DENY';
            lastDecisionRing = ring;
            finalReason = match.reason;
            finalInstruction = match.instruction;
            finalCorrection = match.correction;
            finalExplanation = match.explanation;
            finalAlternative = match.alternative;
          } else if (finalDecision === 'ALLOW') {
            // SPEC v2.0 §9 + §10:
            // - Cross-ring: higher-ring DENY overrides lower-ring ALLOW
            // - Same-ring: normal DENY overrides ALLOW (higher priority DENY wins)
            // - Same-ring: override DENY after ALLOW → popped (DO-011: unsafe direction)
            const allowRing = lastDecisionRing ?? ring;
            if (ring > allowRing || (ring === allowRing && !overrideEnables(rule))) {
              // Higher-ring OR same-ring non-override DENY → override ALLOW
              finalDecision = 'DENY';
              lastDecisionRing = ring;
              finalReason = match.reason;
              finalInstruction = match.instruction;
              finalCorrection = match.correction;
              finalExplanation = match.explanation;
              finalAlternative = match.alternative;
            } else {
              // Same-ring override DENY cannot override ALLOW (DO-011)
              allMatched.pop();
            }
          } else {
            // DENY cannot override ESCALATE/REQUEST_HUMAN — remove from matched
            allMatched.pop();
          }
          // DO-010: DENY does NOT short-circuit — continue evaluating for potential override ALLOW
          continue;
        }

        // CORRECT / REQUEST_HUMAN / ESCALATE / NOTIFY / WORKFLOW_PROGRESS: accumulate
        if (finalDecision === 'PASS') {
          finalDecision = match.decision;
        }
        if (match.reason && (match.decision === 'REQUEST_HUMAN' || match.decision === 'ESCALATE')) {
          finalReason = match.reason;
          finalExplanation = match.explanation;
        }
        if (match.correction && match.decision === 'CORRECT') {
          finalCorrection = match.correction;
          finalExplanation = match.explanation;
        }
        continue; // keep evaluating
      }
    }

    if (allMatched.length === 0) {
      // SPEC v2.0 §11: priority chain — rules[].then > metadata.decision > default PASS
      // metadata.decision is a file-level field; callers may inject it via context['metadata.decision']
      // DO-030: metadata.decision=DENY, no rules match → DENY (fallback kicks in)
      const metadataDecision = context['metadata.decision'] as string | undefined;
      if (metadataDecision) {
        return {
          decision: metadataDecision as Decision,
          matchedRules: [],
          totalEvaluated: enabled.length,
          totalMatched: 0,
          primaryReason: `No rules matched; metadata.decision fallback: ${metadataDecision}`,
        };
      }
      // v1.3: unless exemption (DO-024/DO-026) sets finalDecision=ALLOW even though
      // matched_rules=[] — return finalDecision rather than hardcoding PASS
      // v1.3 default fallback when no rules match is ALLOW (not PASS)
      if (finalDecision === 'PASS') finalDecision = 'ALLOW';
      return {
        decision: finalDecision as Decision,
        matchedRules: [],
        unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
        totalEvaluated: enabled.length,
        totalMatched: 0,
      };
    }

    return {
      decision: finalDecision,
      matchedRules: allMatched,
      unlessExemptions: unlessExemptions.length > 0 ? unlessExemptions : undefined,
      primaryReason: finalReason,
      primaryInstruction: finalInstruction,
      primaryCorrection: finalCorrection,
      primaryExplanation: finalExplanation,
      primaryAlternative: finalAlternative,
      totalEvaluated: enabled.length,
      totalMatched: allMatched.length,
      temporalState: temporalState.length > 0 ? temporalState : undefined,
    };
  }

  /** Build a RuleMatch from a matched rule */
  private makeMatch(rule: RuleDefinition, ring: RingLevel): RuleMatch {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      decision: rule.action.decision,
      instruction: rule.action.instruction,
      reason: rule.action.reason,
      explanation: rule.action.explanation,
      alternative: rule.action.alternative,
      ring: rule.action.ring ?? ring,
      correction: rule.action.correction,
      priority: rule.priority,
    };
  }

  simulate(rule: RuleDefinition, context: Record<string, unknown>): RuleMatch | null {
    if (!rule.enabled) return null;
    const ctx = { ...context };
    const matched =
      rule.conditions.length === 0 || rule.conditions.every(cond => this.evaluateLeaf(cond, ctx));
    if (!matched) return null;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      decision: rule.action.decision,
      instruction: rule.action.instruction,
      reason: rule.action.reason,
      priority: rule.priority,
    };
  }

  // ============================================
  // SPEC v2.0 §11: field/operator/value evaluation
  // ============================================

  /**
   * RFC-002 §2.4: 收集命中规则的有状态算子（within/rate）窗口计数快照。
   * 在命中后调用（计数已含本次命中前的放行次数），使重放验证时按序列累计可对齐。
   */
  private collectTemporalState(rule: RuleDefinition, out: TemporalStateEntry[]): void {
    for (const cond of rule.conditions) {
      if (cond.rate && cond.field) {
        const windowMs = this.parseWindow(cond.rate.split('/')[1] ?? '1m');
        const maxCount = parseInt(cond.rate.split('/')[0] ?? '10', 10);
        const rateKey = this.rateKey(cond.field, cond.operator ?? '', cond.value, cond.rate);
        out.push({
          rule_id: rule.id,
          operator: 'rate',
          field: cond.field,
          window_ms: windowMs,
          count: this.stateManager.getCount(rateKey, windowMs, true),
          limit: maxCount,
        });
      }
      if (cond.within && cond.field) {
        const windowMs = this.parseWindow(cond.within);
        const trackerKey = this.withinKey(cond.field, cond.operator ?? '', cond.value);
        out.push({
          rule_id: rule.id,
          operator: 'within',
          field: cond.field,
          window_ms: windowMs,
          count: this.stateManager.getCount(trackerKey, windowMs, false),
        });
      }
    }
  }

  /**
   * rate 计数 key：含 field + operator + value + rate，确保不同操作（不同 value）独立限流。
   * 修复（2026-08-27）：原 key `rate:field:rate` 不含 value，导致 exec/write_file 共享计数。
   */
  private rateKey(field: string, operator: string, value: unknown, rate: string): string {
    return `rate:${field}:${operator}:${this.serializeValue(value)}:${rate}`;
  }

  /**
   * within 计数 key：含 field + operator + value，确保不同操作独立去重。
   */
  private withinKey(field: string, operator: string, value: unknown): string {
    return `within:${field}:${operator}:${this.serializeValue(value)}`;
  }

  /** value 稳定序列化（用于计数 key，不进 DO 哈希） */
  private serializeValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
    return JSON.stringify(value);
  }

  /** 构造树求值的 EvalContext（复用旧 resolveField 语义 + 注入 asOf） */
  private buildTreeContext(context: Record<string, unknown>): {
    resolveField: (f: string) => unknown;
    resolveVar: (v: string) => unknown;
    asOf?: Date;
  } {
    return {
      resolveField: (f: string) => this.resolveField(f, context),
      resolveVar: (v: string) => {
        if (v === '$') return context;
        const p = v.startsWith('$.') ? v.slice(2) : v;
        return this.resolveField(p, context);
      },
      asOf: this.asOf ?? undefined,
    };
  }

  private evaluateLeaf(cond: RuleCondition, context: Record<string, unknown>): boolean {
    // E7 + §12 Expression 投影面：结构化表达式树（S-expression）优先，直接走树内核求值
    if (cond.expr !== undefined && cond.expr !== null) {
      try {
        const tree = fromSExpr(cond.expr);
        const evalCtx = this.buildTreeContext(context);
        return this.treeEvaluator.evaluate(tree, evalCtx).value === true;
      } catch (e) {
        // S8 修复：按异常类型分流——资源超限（ExprLimitError）属攻击信号，必须可观测；
        // 解析失败等结构性错误静默 fail-close（E12）
        if (e instanceof ExprLimitError) {
          console.warn(`[Evaluator] 表达式资源超限（fail-close）: ${e.message}`);
        }
        // S-expression 解析失败 → 求值失败（fail-close）
        return false;
      }
    }

    const { field, operator } = cond;
    if (!field) return false;

    if (!operator) return false;

    const raw = this.resolveField(field, context);

    // §10 E11 空值传播：字段缺失时，除 ==null/!=null/exists 外，所有比较返回 false
    // 语义："字段不存在"统一视为"条件不满足"而非"求值异常"
    // 只有 exists/not_exists 和 ==null/!=null 能感知字段的存在性
    const isAbsent = raw === undefined || raw === null;
    if (isAbsent) {
      if (operator === 'exists') return false;
      if (operator === 'not_exists') return true;
      if (operator === 'eq' && (cond.value === null || cond.value === undefined)) return true;
      if (operator === 'ne' && (cond.value === null || cond.value === undefined)) return false;
      // All other comparisons with absent field → false
      return false;
    }

    // 归一（2026-08-15）：纯条件用表达式树内核求值（E7 单一求值核心）
    // 别名 matches→match / neq→ne 由 normalizeOperator 统一处理（rule-to-expr.ts）。
    const normalizedOp = normalizeOperator(operator);
    if (normalizedOp !== null && field) {
      // R2 修复：与 expr 分支（上方）对齐，树内核求值异常一律 fail-close（E12），
      // 绝不向 Guard 调用方外抛（如上下文含极端数值、超限攻击等）
      try {
        const tree = compileSimpleCondition({ field, operator: normalizedOp, value: cond.value });
        const evalCtx = this.buildTreeContext(context);
        const result = this.treeEvaluator.evaluate(tree, evalCtx);
        const matched = result.value === true;

        // SPEC v2.0 §11: rate 限流（后置：仅字段匹配才计数；含 value 隔离，不同操作独立限流）
        // 修复（2026-08-27）：原实现语义反了（额度内拦截、超限放行），record 依赖「命中后 commit」形成死锁，
        // 且 rate 前置导致字段不匹配也计数、rate key 不含 value 导致不同操作共享计数。
        // 正确语义：前 N 次放行（并计数），第 N+1 次起拦截。
        if (matched && cond.rate) {
          const rateKey = this.rateKey(field, operator, cond.value, cond.rate);
          const windowMs = this.parseWindow(cond.rate.split('/')[1] ?? '1m');
          const maxCount = parseInt(cond.rate.split('/')[0] ?? '10', 10);
          if (this.stateManager.checkRate(rateKey, maxCount, windowMs)) {
            // 未超限：记录本次操作（放行），条件不成立
            this.stateManager.recordRate(rateKey, windowMs);
            return false;
          }
          // 超限：条件成立（触发拦截）
        }

        // SPEC v2.0 §11: within 去重（后置：仅字段匹配才计数；含 value 隔离）
        // 修复（2026-08-27）：原实现死代码（首次无历史→不命中→不记录→永远无历史）。
        // 正确语义：首次触发（无历史）→ record + 放行；窗口内再次触发（有历史）→ 拦截。
        if (matched && cond.within) {
          const trackerKey = this.withinKey(field, operator, cond.value);
          const windowMs = this.parseWindow(cond.within);
          if (!this.stateManager.checkWithin(trackerKey, windowMs)) {
            // 窗口内无历史（首次触发）：记录本次，条件不成立（放行）
            this.stateManager.recordWithin(trackerKey);
            return false;
          }
          // 窗口内有历史：条件成立（触发拦截）
        }

        return matched;
      } catch {
        return false;
      }
    }

    // normalizeOperator 覆盖全部 28 个纯条件算子；走到这里说明是
    // 非纯算子（within/rate 已在主循环/前置处理，pattern/keywords 非纯）。
    // E7：唯一求值核心 = 表达式树内核，不再有并行的 switch 求值器。
    return false;
  }

  /** Parse window string like "5m", "1h" → milliseconds */
  private parseWindow(window: string): number {
    const match = window.trim().match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 60000; // default 1 minute
    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return num * (multipliers[unit] ?? 60000);
  }

  private resolveField(field: string, context: Record<string, unknown>): unknown {
    // P0-25 fix: use hasOwnProperty instead of `in` to prevent prototype chain access
    // `in` traverses prototype, allowing __proto__/constructor pollution attacks
    if (Object.prototype.hasOwnProperty.call(context, field)) return context[field];
    // Fall back to nested path resolution
    return field.split('.').reduce<unknown>((obj, key) => {
      if (obj === null || obj === undefined || typeof obj !== 'object') return undefined;
      if (Array.isArray(obj)) return undefined; // reject array prototype access
      // P0-25 fix: use hasOwnProperty for nested access
      if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
      return (obj as Record<string, unknown>)[key];
    }, context);
  }

  // ═══════════════════════════════════════════════
  // P4.3: Workflow step evaluation
  // ═══════════════════════════════════════════════

  private evaluateWorkflowStep(context: Record<string, unknown>): EvaluationResult {
    const active = context['workflow.active'] as {
      steps: Array<{
        id: string;
        description: string;
        verify: RuleCondition[];
        auto_pass_if?: string;
      }>;
      current_step: number;
      rule_name: string;
    };

    const currentStep = active.steps[active.current_step];
    if (!currentStep) {
      // v1.1: workflow exhausted all steps → PASS
      return { decision: 'PASS', matchedRules: [], totalEvaluated: 0, totalMatched: 0 };
    }

    // Check auto_pass condition
    if (currentStep.auto_pass_if) {
      const autoMatch = currentStep.auto_pass_if.match(/^tool\.name\s+eq\s+(\w+)$/);
      if (autoMatch) {
        if (context['tool.name'] !== autoMatch[1]) {
          return {
            decision: 'WORKFLOW_WAITING',
            matchedRules: [
              {
                ruleId: active.rule_name,
                ruleName: active.rule_name,
                decision: 'WORKFLOW_WAITING',
                reason: `Awaiting: ${currentStep.description}`,
                priority: 1,
              },
            ],
            totalEvaluated: 1,
            totalMatched: 0,
          };
        }
      }
    }

    // Verify current step conditions
    const matched =
      currentStep.verify.length === 0 ||
      currentStep.verify.every(cond => this.evaluateLeaf(cond, context));

    if (!matched) {
      return {
        decision: 'WORKFLOW_WAITING',
        matchedRules: [
          {
            ruleId: active.rule_name,
            ruleName: active.rule_name,
            decision: 'WORKFLOW_WAITING',
            reason: `Awaiting: ${currentStep.description}`,
            priority: 1,
          },
        ],
        totalEvaluated: 1,
        totalMatched: 0,
      };
    }

    // Step passed — advance
    active.current_step++;
    context['workflow.active'] = active;

    if (active.current_step >= active.steps.length) {
      return {
        decision: 'ALLOW',
        matchedRules: [
          {
            ruleId: active.rule_name,
            ruleName: active.rule_name,
            decision: 'ALLOW',
            reason: 'Workflow complete — all steps verified',
            priority: 1,
          },
        ],
        primaryReason: 'Workflow complete',
        totalEvaluated: 1,
        totalMatched: 1,
      };
    }

    const nextStep = active.steps[active.current_step];
    return {
      decision: 'WORKFLOW_PROGRESS',
      matchedRules: [
        {
          ruleId: active.rule_name,
          ruleName: active.rule_name,
          decision: 'WORKFLOW_PROGRESS',
          reason: `Step ${active.current_step}/${active.steps.length} complete. Next: ${nextStep.description}`,
          priority: 1,
        },
      ],
      totalEvaluated: 1,
      totalMatched: 1,
    };
  }
}
