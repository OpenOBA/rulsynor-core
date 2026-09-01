/**
 * Rule Validator — validates rule input before template generation.
 *
 * Catches invalid data at the API boundary, before it enters the template engine.
 * Each template has specific parameter constraints enforced here.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-07-17
 */

import type { TemplateId, TemplateInput } from './template-engine.js';
import type { RuleDefinition, RuleCondition } from './rule-definition.js';

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  level?: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

import {
  RULE_NAME_PREFIXES,
  RULE_CATEGORIES,
  ALL_DECISIONS,
  CONDITION_OPERATORS,
  OP_COMPARE,
  BLOCKING_DECISIONS as SCHEMA_BLOCKING_DECISIONS,
  GUARD_ALLOWED_DECISIONS,
} from './erdl-schema.js';

// 2026-08-28 review: the four enums below were originally local hard-coded (11 categories / 21 decisions / 13 operators / 4 blocking),
// where VALID_ALL_OPS had only 13, causing the UI and validator to reject the 15 kernel-supported operators
// like length_*/count_*/between. Now all derived from the single source of truth erdl-schema; listing them again in this file is forbidden.
const BLOCKING_DECISIONS: readonly string[] = SCHEMA_BLOCKING_DECISIONS;
const FORBIDDEN_NAME_PREFIXES = ['test-', 'old-', 'temp-', 'debug-', 'wip-', 'tmp-'];

const VALID_CATEGORIES: readonly string[] = RULE_CATEGORIES;

/**
 * The set of legal CAT abbreviations for the three-part rule name `[CAT]-[NNN]-[desc]` (SPEC v2.0 §16).
 *
 * This is the single source of truth for the naming gate: a rule name's prefix MUST be in this set,
 * otherwise load is rejected (error). New categories must first be declared here + registered in spec §16.
 */
// ADR-003 (2026-08-28): the prefix table is consolidated into the single source of truth erdl-schema.RULE_NAME_PREFIXES,
// here only an alias is kept; writing a second prefix definition in this file is forbidden. New prefix → edit erdl-schema and sync SPEC.
const CATEGORY_PREFIX_MAP: Record<string, string> = RULE_NAME_PREFIXES;

/** Legal rule name format: CAT-NNN-desc (desc segment lowercase English kebab, number 3-4 digits) */
const RULE_NAME_PATTERN = /^[A-Z]{2,4}-(\d{3,4})-[a-z0-9][a-z0-9-]*$/;

// 2026-08-28 review: was a 21-item local list (the Ring annotation was still at ERDL v1.0 §3.4).
// Now derived from the single source of truth ALL_DECISIONS = DO-visible 13 + non-DO 8 (2 sub-states + 4 internal reasoning + PASS + CENSOR).
// Note: this list is the input-validation domain of "engine-internal flowable identifiers", not the DO value domain —
// result.decision written to DO MUST ∈ 13, judged via erdl-schema.isDODecision().
const VALID_DECISIONS: readonly string[] = ALL_DECISIONS;

const VALID_COMPARISON_OPS: readonly string[] = OP_COMPARE;
const VALID_ALL_OPS: readonly string[] = CONDITION_OPERATORS;

export class RuleValidator {
  validate(input: TemplateInput): ValidationResult {
    const errors: ValidationError[] = [];

    this.checkRuleName(input.ruleName, errors);
    this.checkCategory(input.category, errors);
    this.checkDecision(input.decision, errors);
    this.checkMessage(input.message, errors);
    this.checkPriority(input.priority, errors);
    this.checkTemplateParams(input.templateId, input.params, errors);
    this.checkExplanation(input.explanation, errors);
    this.checkAlternative(input.alternative, errors);
    this.checkWhenCompleteness(input, errors);
    this.checkNamingConventionInternal(input.ruleName, errors);

    // Warnings alone do not make the result invalid
    return { valid: errors.filter(e => e.level !== 'warning').length === 0, errors };
  }

  /**
   * SPEC v2.0 §10.6: Validate when completeness.
   * Rejects explicit when:'true' combined with blocking decisions.
   * Used by external callers (e.g., RuleService) for raw-when rules.
   */
  validateWhenCompleteness(content: Record<string, unknown>, decision: string): ValidationResult {
    const errors: ValidationError[] = [];
    const when = content.when;
    if (when === 'true' && BLOCKING_DECISIONS.includes(decision)) {
      errors.push({
        field: 'when',
        code: 'WILD_WHEN_WITH_BLOCKING_THEN',
        message: `when:'true' cannot be combined with then:${decision}. Blocking all operations unconditionally makes the system unusable. Add at least one precise when condition.`,
        level: 'error',
      });
    }
    return { valid: errors.filter(e => e.level === 'error').length === 0, errors };
  }

  /**
   * SPEC v2.0 §11: Check metadata.decision vs content.then consistency.
   */
  checkDecisionConsistency(
    metadataDecision: string,
    contentThen: string | undefined,
  ): ValidationError | null {
    if (contentThen && metadataDecision !== contentThen?.toUpperCase()) {
      return {
        field: 'decision',
        code: 'DECISION_MISMATCH',
        message: `metadata.decision (${metadataDecision}) does not match content.then (${contentThen})`,
        level: 'warning',
      };
    }
    return null;
  }

  // ============================================
  // Field checks
  // ============================================

  private checkRuleName(name: string, errors: ValidationError[]): void {
    if (!name || typeof name !== 'string') {
      errors.push({ field: 'ruleName', code: 'REQUIRED', message: 'Rule name cannot be empty' });
      return;
    }
    if (name.length > 255) {
      errors.push({ field: 'ruleName', code: 'TOO_LONG', message: 'Rule name cannot exceed 255 characters' });
    }
    if (/[<>:"/\\|?*]/.test(name)) {
      errors.push({
        field: 'ruleName',
        code: 'INVALID_CHARS',
        message: 'Rule name contains illegal characters: < > : " / \\ | ? *',
      });
    }
    if (/^\d+$/.test(name)) {
      errors.push({ field: 'ruleName', code: 'NUMERIC_ONLY', message: 'Rule name cannot be all digits' });
    }
  }

  private checkCategory(cat: string, errors: ValidationError[]): void {
    if (!VALID_CATEGORIES.includes(cat)) {
      errors.push({ field: 'category', code: 'INVALID_CATEGORY', message: `Invalid category: ${cat}` });
    }
  }

  private checkDecision(decision: string, errors: ValidationError[]): void {
    if (!VALID_DECISIONS.includes(decision)) {
      errors.push({
        field: 'decision',
        code: 'INVALID_DECISION',
        message: `Invalid decision: ${decision}`,
      });
    }
  }

  private checkMessage(msg: string, errors: ValidationError[]): void {
    if (!msg || typeof msg !== 'string' || !msg.trim()) {
      errors.push({ field: 'message', code: 'REQUIRED', message: 'Message cannot be empty' });
      return;
    }
    if (msg.length > 2000) {
      errors.push({ field: 'message', code: 'TOO_LONG', message: 'Message cannot exceed 2000 characters' });
    }
  }

  /**
   * SPEC v2.0 §16: Blocking decisions SHOULD have non-empty message.
   * Per §16 this is a WARNING-level gate (record advisory, do not reject).
   */
  checkBlockingMessageEmpty(decision: string, message: string): ValidationError | null {
    if (BLOCKING_DECISIONS.includes(decision) && (!message || !message.trim())) {
      return {
        field: 'message',
        code: 'EMPTY_MESSAGE_ON_BLOCKING_RULE',
        message: `The message for the ${decision} decision is empty. Blocking rules should state the reason for ops troubleshooting.`,
        level: 'warning',
      };
    }
    return null;
  }

  private checkPriority(p: number, errors: ValidationError[]): void {
    if (typeof p !== 'number' || p < 1 || p > 1000 || !Number.isInteger(p)) {
      errors.push({
        field: 'priority',
        code: 'INVALID_PRIORITY',
        message: 'Priority must be an integer between 1-1000',
      });
    }
  }

  /**
   * SPEC v2.0 §10.6: when:'true' combined with blocking then — error.
   * Only checks explicit when:'true' in params — structured templates
   * (fieldCompare, toolEq, etc.) generate their own when from params
   * and are validated through their own param checks.
   */
  private checkWhenCompleteness(input: TemplateInput, errors: ValidationError[]): void {
    const when = input.params?.when;
    const decision = input.decision;
    // Only check explicit when:'true' — structured templates generate their own conditions
    if (when === 'true' && BLOCKING_DECISIONS.includes(decision)) {
      errors.push({
        field: 'when',
        code: 'WILD_WHEN_WITH_BLOCKING_THEN',
        message: `when:'true' cannot be combined with the ${decision} decision. Blocking all operations unconditionally makes the system unusable. Add at least one precise condition.`,
        level: 'error',
      });
    }
  }

  /**
   * SPEC v2.0 §16 naming-convention gate — binary judgment: legal passes, illegal is rejected with error, no middle ground.
   *
   *   Illegal = starts with a forbidden prefix, or format is not `CAT-NNN-desc`, or prefix not in the legal CAT set.
   *   Any of the above unmet → error (block load/write). No warning/info advisory level.
   *
   * This is the mechanical gate preventing naming pollution from regenerating.
   */
  checkNamingConvention(name: string): ValidationError | null {
    const lower = name.toLowerCase();
    for (const prefix of FORBIDDEN_NAME_PREFIXES) {
      if (lower === prefix.replace(/-$/, '') || lower.startsWith(prefix)) {
        return {
          field: 'name',
          code: 'NON_STANDARD_NAME',
          message: `Rule names must not start with "${prefix}". Must use CAT-NNN-desc format (e.g. SEC-001-code-safety).`,
          level: 'error',
        };
      }
    }

    // Strict three-part format validation (non-empty/non-numeric already handled by checkRuleName, here only the format)
    if (!RULE_NAME_PATTERN.test(name)) {
      const prefix = name.split('-')[0] ?? '';
      const cat = CATEGORY_PREFIX_MAP[prefix];
      if (!cat) {
        return {
          field: 'name',
          code: 'NON_STANDARD_NAME_FULL',
          message: `Rule name prefix "${prefix}" is illegal. Legal prefixes are limited to ${Object.keys(CATEGORY_PREFIX_MAP).join('/')}. Must follow CAT-NNN-desc format.`,
          level: 'error',
        };
      }
      return {
        field: 'name',
        code: 'NON_STANDARD_NAME_FULL',
        message: `Rule name "${name}" does not match the CAT-NNN-desc format (desc segment lowercase English kebab, number 3-4 digits).`,
        level: 'error',
      };
    }

    return null;
  }

  /** SPEC v2.0 §16: forbid test-/old-/temp- naming prefixes (internal) */
  private checkNamingConventionInternal(name: string, errors: ValidationError[]): void {
    const result = this.checkNamingConvention(name);
    if (result) errors.push(result);
  }

  private checkExplanation(expl: unknown, errors: ValidationError[]): void {
    if (expl === undefined || expl === null || expl === '') return;
    const s = String(expl);
    if (s.length > 5000) {
      errors.push({ field: 'explanation', code: 'TOO_LONG', message: 'Explanation cannot exceed 5000 characters' });
    }
  }

  private checkAlternative(alt: unknown, errors: ValidationError[]): void {
    if (alt === undefined || alt === null || alt === '') return;
    const s = String(alt);
    if (s.length > 5000) {
      errors.push({
        field: 'alternative',
        code: 'TOO_LONG',
        message: 'Alternative cannot exceed 5000 characters',
      });
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
        this.checkToolNames(params.toolNames, errors);
        break;
      case 'toolInAndMatch':
        this.checkToolNames(params.toolNames, errors);
        this.checkPattern(params.matchPattern, errors);
        break;
      case 'toolEqAndCmd':
        this.checkField(params.toolName, 'toolName', errors);
        this.checkPattern(params.matchPattern, errors);
        break;
      case 'toolEq':
        this.checkField(params.toolName, 'toolName', errors);
        break;
      case 'fieldCompare':
        this.checkField(params.field, 'field', errors);
        this.checkComparisonOp(params.operator, 'operator', errors);
        this.checkValue(params.value, 'value', errors);
        break;
      case 'fieldInList':
        this.checkField(params.field, 'field', errors);
        this.checkList(params.values, 'values', errors);
        break;
      case 'twoFieldAnd':
      case 'twoFieldOr':
        this.checkField(params.field1, 'field1', errors);
        this.checkAllOp(params.operator1, 'operator1', errors);
        this.checkValue(params.value1, 'value1', errors);
        this.checkField(params.field2, 'field2', errors);
        this.checkAllOp(params.operator2, 'operator2', errors);
        this.checkValue(params.value2, 'value2', errors);
        break;
      case 'fieldInAndCompare':
        this.checkField(params.field1, 'field1', errors);
        this.checkList(params.values, 'values', errors);
        this.checkField(params.field2, 'field2', errors);
        this.checkComparisonOp(params.operator, 'operator', errors);
        this.checkValue(params.value, 'value', errors);
        break;
      case 'fieldExists':
        this.checkField(params.field, 'field', errors);
        if (typeof params.exists !== 'boolean') {
          errors.push({ field: 'exists', code: 'INVALID', message: 'Please choose exists or not exists' });
        }
        break;
      case 'fieldMatch':
        this.checkField(params.field, 'field', errors);
        this.checkPattern(params.pattern, errors);
        break;
      case 'fieldContains':
        this.checkField(params.field, 'field', errors);
        this.checkValue(params.value, 'value', errors);
        break;
    }
  }

  // ============================================
  // Low-level checks
  // ============================================

  private checkToolNames(val: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(val) || val.length === 0) {
      errors.push({ field: 'toolNames', code: 'REQUIRED', message: 'Please select at least one tool' });
    }
  }

  private checkField(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!val || typeof val !== 'string' || !val.trim()) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: 'Field name cannot be empty' });
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(val as string)) {
      errors.push({
        field: fieldKey,
        code: 'INVALID_CHARS',
        message: 'Field name can only contain letters, digits, underscores, dots',
      });
    }
  }

  private checkPattern(val: unknown, errors: ValidationError[]): void {
    if (!val || typeof val !== 'string' || !(val as string).trim()) {
      errors.push({ field: 'pattern', code: 'REQUIRED', message: 'Match regex cannot be empty' });
      return;
    }
    // ReDoS prevention: reject catastrophic backtracking patterns
    if (this.isReDosVulnerable(val as string)) {
      errors.push({
        field: 'pattern',
        code: 'REDOS_RISK',
        message: 'Regex has ReDoS risk, please simplify',
      });
    }
  }

  private checkValue(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: 'Value cannot be empty' });
    }
  }

  private checkList(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!Array.isArray(val) || val.length === 0) {
      errors.push({ field: fieldKey, code: 'REQUIRED', message: 'Value list cannot be empty' });
    }
  }

  private checkComparisonOp(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!VALID_COMPARISON_OPS.includes(val as string)) {
      errors.push({ field: fieldKey, code: 'INVALID_OP', message: 'Invalid comparison operator' });
    }
  }

  private checkAllOp(val: unknown, fieldKey: string, errors: ValidationError[]): void {
    if (!VALID_ALL_OPS.includes(val as string)) {
      errors.push({ field: fieldKey, code: 'INVALID_OP', message: 'Invalid operator' });
    }
  }

  /**
   * ReDoS detection — rejects patterns with nested repetition that
   * can cause catastrophic backtracking.
   */
  private isReDosVulnerable(pattern: string): boolean {
    // Detect nested quantifiers: (a+)+  (a*)*  (a+)*  (a*)+
    if (/\([^)]*[+*]\)[+*]/.test(pattern)) return true;
    // Detect alternation inside repetition that can backtrack
    // (a|b|c)+ with overlapping prefixes
    // Conservative: flag any pattern with >3 alternation groups inside repetition
    if (/\([^)]*\|[^)]*\)[+*]\s*[+*]/.test(pattern)) return true;
    return false;
  }

  // === §16 new gates ===

  /** Guard rules (guard: true) MUST NOT contain unless */
  checkGuardWithUnless(rule: RuleDefinition): ValidationError | null {
    const guard = (rule as unknown as Record<string, unknown>).guard as boolean | undefined;
    if (guard === true && rule.unless) {
      return {
        field: 'unless',
        code: 'GUARD_WITH_UNLESS',
        message: `Guard rule "${rule.name}" must not contain unless field (§11)`,
        level: 'error',
      };
    }
    return null;
  }

  /** unless conditions MUST NOT contain within or rate */
  checkUnlessWithTemporal(rule: RuleDefinition): ValidationError | null {
    if (!rule.unless?.conditions) return null;
    for (const cond of rule.unless.conditions) {
      if (
        (cond as unknown as Record<string, unknown>).within ||
        (cond as unknown as Record<string, unknown>).rate
      ) {
        return {
          field: 'unless',
          code: 'UNLESS_WITH_TEMPORAL',
          message: `Rule "${rule.name}" unless condition must not contain within or rate (§11)`,
          level: 'error',
        };
      }
    }
    return null;
  }

  /** Security rules (category=security) MUST have at least 1 condition */
  checkSecurityRuleHasCondition(rule: RuleDefinition): ValidationError | null {
    if (rule.category === 'security' && (!rule.conditions || rule.conditions.length === 0)) {
      return {
        field: 'conditions',
        code: 'NO_CONDITION_ON_SECURITY_RULE',
        message: `Security rule "${rule.name}" must have at least one condition (§10.6)`,
        level: 'error',
      };
    }
    return null;
  }

  /** Dangerous regex pattern detection */
  checkRegexRedosRisk(rule: RuleDefinition): ValidationError | null {
    const allConditions = [...(rule.conditions || []), ...(rule.unless?.conditions || [])];
    for (const cond of allConditions) {
      const op = (cond as unknown as Record<string, unknown>).operator as string | undefined;
      const val = (cond as unknown as Record<string, unknown>).value as string | undefined;
      if (op === 'match' && typeof val === 'string' && this.isReDosVulnerable(val)) {
        return {
          field: 'when',
          code: 'REGEX_REDOS_RISK',
          message: `Rule "${rule.name}" has a dangerous regex pattern that may cause ReDoS`,
          level: 'error',
        };
      }
    }
    return null;
  }

  /** §10.2 E5: RuleCondition's expr (Expression projection) and field/operator/value (Simple projection) are mutually exclusive (validated at load) */
  checkExprExclusive(cond: RuleCondition): ValidationError | null {
    const hasExpr = cond.expr !== undefined && cond.expr !== null;
    const hasSimple =
      cond.field !== undefined || cond.operator !== undefined || cond.value !== undefined;
    if (hasExpr && hasSimple) {
      return {
        field: 'conditions',
        code: 'WHEN_EXPR_EXCLUSIVE',
        message: 'expr and field/operator/value are mutually exclusive, must not coexist (§10.2 E5)',
        level: 'error',
      };
    }
    return null;
  }

  /** AST complexity over-limit detection (depth>64 or nodes>256 or input>4096) */
  checkASTComplexity(rule: RuleDefinition): ValidationError | null {
    // Check condition expressions for complexity
    const allConditions = [...(rule.conditions || []), ...(rule.unless?.conditions || [])];
    for (const cond of allConditions) {
      const field = (cond as unknown as Record<string, unknown>).field as string | undefined;
      const val = (cond as unknown as Record<string, unknown>).value as string | undefined;
      if (field && field.length > 4096)
        return {
          field: 'conditions.field',
          code: 'AST_COMPLEXITY_EXCEEDED',
          message: `Rule "${rule.name}" has a field path exceeding 4096 chars`,
          level: 'error',
        };
      if (val && val.length > 4096)
        return {
          field: 'conditions.value',
          code: 'AST_COMPLEXITY_EXCEEDED',
          message: `Rule "${rule.name}" has a value exceeding 4096 chars`,
          level: 'error',
        };
    }
    return null;
  }

  /** Full naming format detection [CAT]-[NNN]-desc */
  checkNamingConventionFull(rule: RuleDefinition): ValidationError | null {
    // SPEC v2.0 §16 naming gate (same binary standard as checkNamingConvention):
    //   Legal = CAT-NNN-desc (desc segment lowercase English kebab), prefix MUST be in CATEGORY_PREFIX_MAP.
    //   Illegal → error (block load), no warning/info middle state.
    // ADR-003: prefix whitelist validated unconditionally. The historical implementation only looked up the prefix table when the regex failed,
    // making the whitelist ineffective (XYZ-999-foo also passed), inconsistent with the MUST promise in this file's comments.
    const unregistered = rule.name.split('-')[0] ?? '';
    if (!CATEGORY_PREFIX_MAP[unregistered]) {
      return {
        field: 'name',
        code: 'NON_STANDARD_NAME_FULL',
        message: `Rule name prefix "${unregistered}" is unregistered. Legal prefixes are limited to ${Object.keys(CATEGORY_PREFIX_MAP).join('/')} (registration-based: new prefixes must first be registered in erdl-schema.RULE_NAME_PREFIXES).`,
        level: 'error',
      };
    }
    if (!RULE_NAME_PATTERN.test(rule.name)) {
      const prefix = rule.name.split('-')[0] ?? '';
      if (!CATEGORY_PREFIX_MAP[prefix]) {
        return {
          field: 'name',
          code: 'NON_STANDARD_NAME_FULL',
          message: `Rule name prefix "${prefix}" is illegal. Legal prefixes are limited to ${Object.keys(CATEGORY_PREFIX_MAP).join('/')}. Must follow CAT-NNN-desc format.`,
          level: 'error',
        };
      }
      return {
        field: 'name',
        code: 'NON_STANDARD_NAME_FULL',
        message: `Rule name "${rule.name}" does not match the CAT-NNN-desc format (desc segment lowercase English kebab, number 3-4 digits).`,
        level: 'error',
      };
    }
    return null;
  }

  // === §16 new gates (completing 3 unimplemented items) ===

  /**
   * §16 no-tool-constraint (warning):
   * coding/security rules SHOULD specify a tool.name condition to avoid indiscriminate matching.
   */
  checkToolConstraint(rule: RuleDefinition): ValidationError | null {
    if (rule.category !== 'coding' && rule.category !== 'security') return null;
    // Rules with empty conditions are advisory (already flagged by other gates) — skip here
    if (rule.conditions.length === 0) return null;
    const hasToolConstraint = rule.conditions.some(
      c => c.field === 'tool.name' || c.field === 'tool_name',
    );
    if (!hasToolConstraint) {
      return {
        field: 'conditions',
        code: 'NO_TOOL_CONSTRAINT',
        message: `${rule.category} rule "${rule.name}" should specify a tool.name condition to avoid matching every tool call (§16)`,
        level: 'warning',
      };
    }
    return null;
  }

  /**
   * §3.6 Guard then restriction: Guard rules (guard: true) support only Ring 0-2 actions + CORRECT.
   * Ring 3 internal actions (STRATEGIZE/AUDIT/CALCULATE/VALIDATE) are not allowed in Guard rules.
   */
  checkGuardThenRestriction(rule: RuleDefinition): ValidationError | null {
    const guard = (rule as unknown as Record<string, unknown>).guard as boolean | undefined;
    if (!guard) return null;
    const decision = rule.action?.decision ?? 'ALLOW';
    // Allowed for Guard: Ring 0-2 actions + CORRECT (Ring 3 exception per §3.6)
    // 2026-08-28 review: switch to the single source of truth GUARD_ALLOWED_DECISIONS
    const ALLOWED_GUARD_DECISIONS: readonly string[] = GUARD_ALLOWED_DECISIONS;
    if (!ALLOWED_GUARD_DECISIONS.includes(decision)) {
      return {
        field: 'then',
        code: 'GUARD_THEN_NOT_ALLOWED',
        message: `Guard rule "${rule.name}" uses then:${decision} which is not allowed. Guard then only supports Ring 0-2 actions + CORRECT/ALLOW (§3.6)`,
        level: 'error',
      };
    }
    return null;
  }
}

export const ruleValidator = new RuleValidator();
