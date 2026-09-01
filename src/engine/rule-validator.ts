/**
 * Rule Validator — validates rule input before template generation.
 *
 * Catches invalid data at the API boundary, before it enters the template engine.
 * Each template has specific parameter constraints enforced here.
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-17
 */

import type { TemplateId, TemplateInput } from './template-engine.js'
import type { RuleDefinition, RuleCondition } from './rule-definition.js'

export interface ValidationError {
  field: string
  code: string
  message: string
  level?: 'error' | 'warning' | 'info'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

import {
  RULE_NAME_PREFIXES, RULE_CATEGORIES, ALL_DECISIONS, CONDITION_OPERATORS,
  OP_COMPARE, BLOCKING_DECISIONS as SCHEMA_BLOCKING_DECISIONS, GUARD_ALLOWED_DECISIONS,
} from './erdl-schema.js'

// 2026-08-28 收口：以下四个枚举原为本地硬编码（分类 11 / 决策 21 / 运算符 13 / 拦截性 4），
// 其中 VALID_ALL_OPS 只有 13 个，导致 UI 与校验器拒绍内核支持的 length_*/count_*/between 等
// 15 个运算符。现全部派生自单一事实源 erdl-schema，禁止在本文件再列举。
const BLOCKING_DECISIONS: readonly string[] = SCHEMA_BLOCKING_DECISIONS
const FORBIDDEN_NAME_PREFIXES = ['test-', 'old-', 'temp-', 'debug-', 'wip-', 'tmp-']

const VALID_CATEGORIES: readonly string[] = RULE_CATEGORIES

/**
 * 规则名三段式 `[CAT]-[NNN]-[描述]` 的合法 CAT 缩写集合（SPEC v2.0 §16）。
 *
 * 这是命名门禁的单一事实来源：规则 name 的前缀 MUST 在此集合内，
 * 否则拒绝加载（error）。新增分类必须先在此声明 + 在 spec §16 登记。
 */
// ADR-003（2026-08-28）：前缀表收归单一事实源 erdl-schema.RULE_NAME_PREFIXES，
// 此处仅做别名，禁止在本文件再写第二份前缀定义。新增前缀 → 改 erdl-schema 并同步 SPEC。
const CATEGORY_PREFIX_MAP: Record<string, string> = RULE_NAME_PREFIXES

/** 规则名合法格式：CAT-NNN-描述（描述段英文小写 kebab，编号 3-4 位） */
const RULE_NAME_PATTERN = /^[A-Z]{2,4}-(\d{3,4})-[a-z0-9][a-z0-9-]*$/

// 2026-08-28 收口：原为 21 项本地清单（Ring 注释口径还停在 ERDL v1.0 §3.4）。
// 现派生自单一事实源 ALL_DECISIONS = DO 可见 13 + 非 DO 8（2 子态 + 4 内部推理 + PASS + CENSOR）。
// 注意：本清单是「引擎内部可流转标识」的输入校验域，不等于 DO 取值域——
// 写入 DO 的 result.decision MUST ∈ 13，判定用 erdl-schema.isDODecision()。
const VALID_DECISIONS: readonly string[] = ALL_DECISIONS

const VALID_COMPARISON_OPS: readonly string[] = OP_COMPARE
const VALID_ALL_OPS: readonly string[] = CONDITION_OPERATORS

export class RuleValidator {
  validate(input: TemplateInput): ValidationResult {
    const errors: ValidationError[] = []

    this.checkRuleName(input.ruleName, errors)
    this.checkCategory(input.category, errors)
    this.checkDecision(input.decision, errors)
    this.checkMessage(input.message, errors)
    this.checkPriority(input.priority, errors)
    this.checkTemplateParams(input.templateId, input.params, errors)
    this.checkExplanation(input.explanation, errors)
    this.checkAlternative(input.alternative, errors)
    this.checkWhenCompleteness(input, errors)
    this.checkNamingConventionInternal(input.ruleName, errors)

    // Warnings alone do not make the result invalid
    return { valid: errors.filter(e => e.level !== 'warning').length === 0, errors }
  }

  /**
   * SPEC v2.0 §10.6: Validate when completeness.
   * Rejects explicit when:'true' combined with blocking decisions.
   * Used by external callers (e.g., RuleService) for raw-when rules.
   */
  validateWhenCompleteness(content: Record<string, unknown>, decision: string): ValidationResult {
    const errors: ValidationError[] = []
    const when = content.when
    if (when === 'true' && BLOCKING_DECISIONS.includes(decision)) {
      errors.push({
        field: 'when', code: 'WILD_WHEN_WITH_BLOCKING_THEN',
        message: `when:'true' 不能与 then:${decision} 搭配。无条件拦截所有操作会导致系统不可用。请添加至少一个精确的 when 条件。`,
        level: 'error',
      })
    }
    return { valid: errors.filter(e => e.level === 'error').length === 0, errors }
  }

  /**
   * SPEC v2.0 §11: Check metadata.decision vs content.then consistency.
   */
  checkDecisionConsistency(metadataDecision: string, contentThen: string | undefined): ValidationError | null {
    if (contentThen && metadataDecision !== contentThen?.toUpperCase()) {
      return {
        field: 'decision', code: 'DECISION_MISMATCH',
        message: `metadata.decision (${metadataDecision}) 与 content.then (${contentThen}) 不一致`,
        level: 'warning',
      }
    }
    return null
  }

  // ============================================
  // Field checks
  // ============================================

  private checkRuleName(name: string, errors: ValidationError[]): void {
    if (!name || typeof name !== 'string') {
      errors.push({ field: 'ruleName', code: 'REQUIRED', message: '规则名称不能为空' })
      return
    }
    if (name.length > 255) {
      errors.push({ field: 'ruleName', code: 'TOO_LONG', message: '规则名称不能超过 255 字符' })
    }
    if (/[<>:"/\\|?*]/.test(name)) {
      errors.push({ field: 'ruleName', code: 'INVALID_CHARS', message: '规则名称包含非法字符: < > : " / \\ | ? *' })
    }
    if (/^\d+$/.test(name)) {
      errors.push({ field: 'ruleName', code: 'NUMERIC_ONLY', message: '规则名称不能全为数字' })
    }
  }

  private checkCategory(cat: string, errors: ValidationError[]): void {
    if (!VALID_CATEGORIES.includes(cat)) {
      errors.push({ field: 'category', code: 'INVALID_CATEGORY', message: `无效分类: ${cat}` })
    }
  }

  private checkDecision(decision: string, errors: ValidationError[]): void {
    if (!VALID_DECISIONS.includes(decision)) {
      errors.push({ field: 'decision', code: 'INVALID_DECISION', message: `无效决策: ${decision}` })
    }
  }

  private checkMessage(msg: string, errors: ValidationError[]): void {
    if (!msg || typeof msg !== 'string' || !msg.trim()) {
      errors.push({ field: 'message', code: 'REQUIRED', message: '提示消息不能为空' })
      return
    }
    if (msg.length > 2000) {
      errors.push({ field: 'message', code: 'TOO_LONG', message: '提示消息不能超过 2000 字符' })
    }
  }

  /**
   * SPEC v2.0 §16: Blocking decisions SHOULD have non-empty message.
   * Per §16 this is a WARNING-level gate (record advisory, do not reject).
   */
  checkBlockingMessageEmpty(decision: string, message: string): ValidationError | null {
    if (BLOCKING_DECISIONS.includes(decision) && (!message || !message.trim())) {
      return {
        field: 'message', code: 'EMPTY_MESSAGE_ON_BLOCKING_RULE',
        message: `${decision} 决策的 message 为空。拦截规则建议说明原因以便运维排查。`,
        level: 'warning',
      }
    }
    return null
  }

  private checkPriority(p: number, errors: ValidationError[]): void {
    if (typeof p !== 'number' || p < 1 || p > 1000 || !Number.isInteger(p)) {
      errors.push({ field: 'priority', code: 'INVALID_PRIORITY', message: '优先级必须是 1-1000 的整数' })
    }
  }

  /**
   * SPEC v2.0 §10.6: when:'true' combined with blocking then — error.
   * Only checks explicit when:'true' in params — structured templates
   * (fieldCompare, toolEq, etc.) generate their own when from params
   * and are validated through their own param checks.
   */
  private checkWhenCompleteness(input: TemplateInput, errors: ValidationError[]): void {
    const when = input.params?.when
    const decision = input.decision
    // Only check explicit when:'true' — structured templates generate their own conditions
    if (when === 'true' && BLOCKING_DECISIONS.includes(decision)) {
      errors.push({
        field: 'when', code: 'WILD_WHEN_WITH_BLOCKING_THEN',
        message: `when:'true' 不能与 ${decision} 决策搭配。无条件拦截所有操作会导致系统不可用。请添加至少一个精确条件。`,
        level: 'error',
      })
    }
  }

  /**
   * SPEC v2.0 §16 命名规范门禁——二元判定：合法则通过，非法则 error 拒绝，无中间地带。
   *
   *   非法 = 以禁止前缀开头，或格式不是 `CAT-NNN-描述`，或前缀不在合法 CAT 集合。
   *   以上任一不满足 → error（阻止加载/写入）。不存在 warning/info 建议级。
   *
   * 这是防止命名污染再生的机制性门禁。
   */
  checkNamingConvention(name: string): ValidationError | null {
    const lower = name.toLowerCase()
    for (const prefix of FORBIDDEN_NAME_PREFIXES) {
      if (lower === prefix.replace(/-$/, '') || lower.startsWith(prefix)) {
        return {
          field: 'name', code: 'NON_STANDARD_NAME',
          message: `规则名禁止以 "${prefix}" 开头。必须使用 CAT-NNN-描述 格式（如 SEC-001-code-safety）。`,
          level: 'error',
        }
      }
    }

    // 严格三段式格式校验（非空/非纯数字已由 checkRuleName 处理，这里验格式）
    if (!RULE_NAME_PATTERN.test(name)) {
      const prefix = name.split('-')[0] ?? ''
      const cat = CATEGORY_PREFIX_MAP[prefix]
      if (!cat) {
        return {
          field: 'name', code: 'NON_STANDARD_NAME_FULL',
          message: `规则名前缀 "${prefix}" 非法。合法前缀仅限 ${Object.keys(CATEGORY_PREFIX_MAP).join('/')}。必须遵循 CAT-NNN-描述 格式。`,
          level: 'error',
        }
      }
      return {
        field: 'name', code: 'NON_STANDARD_NAME_FULL',
        message: `规则名 "${name}" 不符合 CAT-NNN-描述 格式（描述段英文小写 kebab，编号 3-4 位）。`,
        level: 'error',
      }
    }

    return null
  }

  /** SPEC v2.0 §16: forbid test-/old-/temp- naming prefixes (internal) */
  private checkNamingConventionInternal(name: string, errors: ValidationError[]): void {
    const result = this.checkNamingConvention(name)
    if (result) errors.push(result)
  }

  private checkExplanation(expl: unknown, errors: ValidationError[]): void {
    if (expl === undefined || expl === null || expl === '') return
    const s = String(expl)
    if (s.length > 5000) {
      errors.push({ field: 'explanation', code: 'TOO_LONG', message: '解释不能超过 5000 字符' })
    }
  }

  private checkAlternative(alt: unknown, errors: ValidationError[]): void {
    if (alt === undefined || alt === null || alt === '') return
    const s = String(alt)
    if (s.length > 5000) {
      errors.push({ field: 'alternative', code: 'TOO_LONG', message: '替代方案不能超过 5000 字符' })
    }
  }

  // ============================================
  // Template-specific param checks
  // ============================================

  private checkTemplateParams(
    templateId: TemplateId,
    params: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    switch (templateId) {
      case 'toolInList':
        this.checkToolNames(params.toolNames, errors)
        break
      case 'toolInAndMatch':
        this.checkToolNames(params.toolNames, errors)
        this.checkPattern(params.matchPattern, errors)
        break
      case 'toolEqAndCmd':
        this.checkField(params.toolName, 'toolName', errors)
        this.checkPattern(params.matchPattern, errors)
        break
      case 'toolEq':
        this.checkField(params.toolName, 'toolName', errors)
        break
      case 'fieldCompare':
        this.checkField(params.field, 'field', errors)
        this.checkComparisonOp(params.operator, 'operator', errors)
        this.checkValue(params.value, 'value', errors)
        break
      case 'fieldInList':
        this.checkField(params.field, 'field', errors)
        this.checkList(params.values, 'values', errors)
        break
      case 'twoFieldAnd':
      case 'twoFieldOr':
        this.checkField(params.field1, 'field1', errors)
        this.checkAllOp(params.operator1, 'operator1', errors)
        this.checkValue(params.value1, 'value1', errors)
        this.checkField(params.field2, 'field2', errors)
        this.checkAllOp(params.operator2, 'operator2', errors)
        this.checkValue(params.value2, 'value2', errors)
        break
      case 'fieldInAndCompare':
        this.checkField(params.field1, 'field1', errors)
        this.checkList(params.values, 'values', errors)
        this.checkField(params.field2, 'field2', errors)
        this.checkComparisonOp(params.operator, 'operator', errors)
        this.checkValue(params.value, 'value', errors)
        break
      case 'fieldExists':
        this.checkField(params.field, 'field', errors)
        if (typeof params.exists !== 'boolean') {
          errors.push({ field: 'exists', code: 'INVALID', message: '请选择存在或不存在' })
        }
        break
      case 'fieldMatch':
        this.checkField(params.field, 'field', errors)
        this.checkPattern(params.pattern, errors)
        break
      case 'fieldContains':
        this.checkField(params.field, 'field', errors)
        this.checkValue(params.value, 'value', errors)
        break
    }
  }

  // ============================================
  // Low-level checks
  // ============================================

  private checkToolNames(val: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(val) || val.length === 0) {
      errors.push({ field: 'toolNames', code: 'REQUIRED', message: '请至少选择一个工具' })
    }
  }

  private checkField(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!val || typeof val !== 'string' || !val.trim()) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: '字段名不能为空' })
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(val as string)) {
      errors.push({ field: fieldKey, code: 'INVALID_CHARS', message: '字段名只能包含字母、数字、下划线、点' })
    }
  }

  private checkPattern(val: unknown, errors: ValidationError[]): void {
    if (!val || typeof val !== 'string' || !(val as string).trim()) {
      errors.push({ field: 'pattern', code: 'REQUIRED', message: '匹配正则不能为空' })
      return
    }
    // ReDoS prevention: reject catastrophic backtracking patterns
    if (this.isReDosVulnerable(val as string)) {
      errors.push({ field: 'pattern', code: 'REDOS_RISK', message: '正则表达式存在 ReDoS 风险，请简化' })
    }
  }

  private checkValue(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: '值不能为空' })
    }
  }

  private checkList(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!Array.isArray(val) || val.length === 0) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: '值列表不能为空' })
    }
  }

  private checkComparisonOp(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!VALID_COMPARISON_OPS.includes(val as string)) {
      errors.push({ field: fieldKey, code: 'INVALID_OP', message: '无效的比较操作符' })
    }
  }

  private checkAllOp(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!VALID_ALL_OPS.includes(val as string)) {
      errors.push({ field: fieldKey, code: 'INVALID_OP', message: '无效的操作符' })
    }
  }

  /**
   * ReDoS detection — rejects patterns with nested repetition that
   * can cause catastrophic backtracking.
   */
  private isReDosVulnerable(pattern: string): boolean {
    // Detect nested quantifiers: (a+)+  (a*)*  (a+)*  (a*)+
    if (/\([^)]*[+*]\)[+*]/.test(pattern)) return true
    // Detect alternation inside repetition that can backtrack
    // (a|b|c)+ with overlapping prefixes
    // Conservative: flag any pattern with >3 alternation groups inside repetition
    if (/\([^)]*\|[^)]*\)[+*]\s*[+*]/.test(pattern)) return true
    return false
  }

  // === §16 新增门禁 ===

  /** Guard 规则（guard: true）MUST NOT 包含 unless */
  checkGuardWithUnless(rule: RuleDefinition): ValidationError | null {
    const guard = (rule as unknown as Record<string, unknown>).guard as boolean | undefined
    if (guard === true && rule.unless) {
      return {
        field: 'unless',
        code: 'GUARD_WITH_UNLESS',
        message: `Guard rule "${rule.name}" must not contain unless field (§11)`,
        level: 'error',
      }
    }
    return null
  }

  /** unless 条件 MUST NOT 包含 within 或 rate */
  checkUnlessWithTemporal(rule: RuleDefinition): ValidationError | null {
    if (!rule.unless?.conditions) return null
    for (const cond of rule.unless.conditions) {
      if ((cond as unknown as Record<string, unknown>).within || (cond as unknown as Record<string, unknown>).rate) {
        return {
        field: 'unless',
          code: 'UNLESS_WITH_TEMPORAL',
          message: `Rule "${rule.name}" unless condition must not contain within or rate (§11)`,
          level: 'error',
        }
      }
    }
    return null
  }

  /** 安全规则（category=security）MUST 至少 1 个 condition */
  checkSecurityRuleHasCondition(rule: RuleDefinition): ValidationError | null {
    if (rule.category === 'security' && (!rule.conditions || rule.conditions.length === 0)) {
      return {
        field: 'conditions',
        code: 'NO_CONDITION_ON_SECURITY_RULE',
        message: `Security rule "${rule.name}" must have at least one condition (§10.6)`,
        level: 'error',
      }
    }
    return null
  }

  /** 危险正则模式检测 */
  checkRegexRedosRisk(rule: RuleDefinition): ValidationError | null {
    const allConditions = [
      ...(rule.conditions || []),
      ...(rule.unless?.conditions || []),
    ]
    for (const cond of allConditions) {
      const op = (cond as unknown as Record<string, unknown>).operator as string | undefined
      const val = (cond as unknown as Record<string, unknown>).value as string | undefined
      if (op === 'match' && typeof val === 'string' && this.isReDosVulnerable(val)) {
        return {
          field: 'when',
          code: 'REGEX_REDOS_RISK',
          message: `Rule "${rule.name}" has a dangerous regex pattern that may cause ReDoS`,
          level: 'error',
        }
      }
    }
    return null
  }

  /** §10.2 E5：RuleCondition 的 expr（Expression 投影面）与 field/operator/value（Simple 投影面）互斥（加载时校验） */
  checkExprExclusive(cond: RuleCondition): ValidationError | null {
    const hasExpr = cond.expr !== undefined && cond.expr !== null
    const hasSimple = cond.field !== undefined || cond.operator !== undefined || cond.value !== undefined
    if (hasExpr && hasSimple) {
      return {
        field: 'conditions',
        code: 'WHEN_EXPR_EXCLUSIVE',
        message: 'expr 与 field/operator/value 互斥，不得共存（§10.2 E5）',
        level: 'error',
      }
    }
    return null
  }

  /** AST 复杂度超限检测（深度>64 或 节点>256 或 输入>4096）*/
  checkASTComplexity(rule: RuleDefinition): ValidationError | null {    // Check condition expressions for complexity
    const allConditions = [
      ...(rule.conditions || []),
      ...(rule.unless?.conditions || []),
    ]
    for (const cond of allConditions) {
      const field = (cond as unknown as Record<string, unknown>).field as string | undefined
      const val = (cond as unknown as Record<string, unknown>).value as string | undefined
      if (field && field.length > 4096) return { field: 'conditions.field', code: 'AST_COMPLEXITY_EXCEEDED', message: `Rule "${rule.name}" has a field path exceeding 4096 chars`, level: 'error' }
      if (val && val.length > 4096) return { field: 'conditions.value', code: 'AST_COMPLEXITY_EXCEEDED', message: `Rule "${rule.name}" has a value exceeding 4096 chars`, level: 'error' }
    }
    return null
  }

  /** 完整命名格式检测 [CAT]-[NNN]-描述 */
  checkNamingConventionFull(rule: RuleDefinition): ValidationError | null {
    // SPEC v2.0 §16 命名门禁（与 checkNamingConvention 同一二元标准）：
    //   合法 = CAT-NNN-描述（描述段英文小写 kebab），前缀 MUST 在 CATEGORY_PREFIX_MAP 中。
    //   非法 → error（阻止加载），无 warning/info 中间态。
    // ADR-003：前缀白名单无条件校验。历史实现只在正则失配时才查前缀表，
    // 导致白名单形同虚设（XYZ-999-foo 也能通过），与本文件注释的 MUST 承诺不符。
    const unregistered = rule.name.split('-')[0] ?? ''
    if (!CATEGORY_PREFIX_MAP[unregistered]) {
      return {
        field: 'name',
        code: 'NON_STANDARD_NAME_FULL',
        message: `规则名前缀 "${unregistered}" 未登记。合法前缀仅限 ${Object.keys(CATEGORY_PREFIX_MAP).join('/')}（注册制：新增前缀须先登记于 erdl-schema.RULE_NAME_PREFIXES）。`,
        level: 'error',
      }
    }
    if (!RULE_NAME_PATTERN.test(rule.name)) {
      const prefix = rule.name.split('-')[0] ?? ''
      if (!CATEGORY_PREFIX_MAP[prefix]) {
        return {
          field: 'name',
          code: 'NON_STANDARD_NAME_FULL',
          message: `规则名前缀 "${prefix}" 非法。合法前缀仅限 ${Object.keys(CATEGORY_PREFIX_MAP).join('/')}。必须遵循 CAT-NNN-描述 格式。`,
          level: 'error',
        }
      }
      return {
        field: 'name',
        code: 'NON_STANDARD_NAME_FULL',
        message: `规则名 "${rule.name}" 不符合 CAT-NNN-描述 格式（描述段英文小写 kebab，编号 3-4 位）。`,
        level: 'error',
      }
    }
    return null
  }

  // === §16 新增门禁（补全 3 个未实现项）===

  /**
   * §16 no-tool-constraint (warning):
   * coding/security 规则 SHOULD 指定 tool.name 条件，避免无差别匹配。
   */
  checkToolConstraint(rule: RuleDefinition): ValidationError | null {
    if (rule.category !== 'coding' && rule.category !== 'security') return null
    // Rules with empty conditions are advisory (already flagged by other gates) — skip here
    if (rule.conditions.length === 0) return null
    const hasToolConstraint = rule.conditions.some(
      (c) => c.field === 'tool.name' || c.field === 'tool_name',
    )
    if (!hasToolConstraint) {
      return {
        field: 'conditions',
        code: 'NO_TOOL_CONSTRAINT',
        message: `${rule.category} rule "${rule.name}" should specify a tool.name condition to avoid matching every tool call (§16)`,
        level: 'warning',
      }
    }
    return null
  }

  /**
   * §3.6 Guard then 限制：Guard 规则（guard: true）的 then 仅支持 Ring 0-2 动作 + CORRECT。
   * Ring 3 内部动作（STRATEGIZE/AUDIT/CALCULATE/VALIDATE）不允许出现在 Guard 规则中。
   */
  checkGuardThenRestriction(rule: RuleDefinition): ValidationError | null {
    const guard = (rule as unknown as Record<string, unknown>).guard as boolean | undefined
    if (!guard) return null
    const decision = rule.action?.decision ?? 'ALLOW'
    // Allowed for Guard: Ring 0-2 actions + CORRECT (Ring 3 exception per §3.6)
    // 2026-08-28 review 收口：改用单一事实源 GUARD_ALLOWED_DECISIONS
    const ALLOWED_GUARD_DECISIONS: readonly string[] = GUARD_ALLOWED_DECISIONS
        if (!ALLOWED_GUARD_DECISIONS.includes(decision)) {
      return {
        field: 'then',
        code: 'GUARD_THEN_NOT_ALLOWED',
        message: `Guard rule "${rule.name}" uses then:${decision} which is not allowed. Guard then only supports Ring 0-2 actions + CORRECT/ALLOW (§3.6)`,
        level: 'error',
      }
    }
    return null
  }
}


export const ruleValidator = new RuleValidator();
