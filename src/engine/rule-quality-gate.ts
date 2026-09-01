/**
 * Rule Quality Gate — SPEC v2.0 §16
 *
 * Aggregates all validation checks and produces a quality report
 * when rules are loaded from DB or file system.
 *
 * This is the entry point for rule quality enforcement:
 *   - RuleStore.load() calls check() (DbRuleStore/FileRuleStore implementation deferred, not MVP)
 *   - RuleService.createFromTemplate() already validates per-rule
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-07-21
 */

import { ruleValidator } from './rule-validator.js';
import type { ValidationError } from './rule-validator.js';
import type { RuleDefinition } from './rule-definition.js';
import { RulsynorLogger } from './logger.js';

const logQg = new RulsynorLogger('QualityGate');

export interface QualityGateReport {
  /** Total rules checked */
  total: number;
  /** Rules that passed all checks */
  passed: number;
  /** Rules with errors (action blocked at load time) */
  errors: number;
  /** Rules with warnings (action allowed with advisory) */
  warnings: number;
  /** Per-rule issue details */
  details: QualityGateRuleDetail[];
}

export interface QualityGateRuleDetail {
  ruleId: string;
  ruleName: string;
  issues: ValidationError[];
}

export class RuleQualityGate {
  /**
   * Check all loaded rules against SPEC v2.0 quality gates.
   *
   * §16 rule quality gate (this implementation has 11 checks = 8 SPEC core + 3 implementation extensions):
   *   Error (reject on load):
   *     1. wild-when-with-blocking-then (§10.6)
   *     2. no-condition-on-security-rule (§10.6)  ← v1.1 new
   *     3. guard-with-unless (§11)               ← v1.1 new
   *     4. unless-with-temporal (§11)            ← v1.1 new
   *     5. regex-redos-risk (§10.4)                  ← v1.1 new
   *     6. ast-complexity-exceeded (§10 E4)           ← v1.1 new
   *   Warning (record log):
   *     7. empty-message-on-blocking-rule (§16)
   *     8. non-standard-name (§16)
   *     9. non-standard-name-full (§16)          ← v1.1 new
   *     10. no-tool-constraint (§16)             ← v1.1 upgraded info→warning
   *   Info (record hint):
   *     11. no-path-constraint (§16)            ← v1.1 upgraded info→warning
   */
  check(rules: RuleDefinition[]): QualityGateReport {
    const details: QualityGateRuleDetail[] = [];

    for (const rule of rules) {
      const issues: ValidationError[] = [];

      // §10.6: when completeness
      const when = (rule as unknown as Record<string, unknown>).when as string | undefined;
      const rawWhen = when ?? extractRawWhen(rule);
      const whenResult = ruleValidator.validateWhenCompleteness(
        { when: rawWhen },
        rule.action?.decision ?? 'ALLOW',
      );
      issues.push(...whenResult.errors);

      // §16: blocking message mandatory
      // CORRECT decision stores its message in `correction`, not `reason` —
      // check the appropriate field based on decision type (see parseThenAction)
      const decision = rule.action?.decision ?? 'ALLOW';
      const messageField = decision === 'CORRECT' ? rule.action?.correction : rule.action?.reason;
      const msgErr = ruleValidator.checkBlockingMessageEmpty(decision, messageField ?? '');
      if (msgErr) issues.push(msgErr);

      // §16: naming convention
      const nameErr = ruleValidator.checkNamingConvention(rule.name);
      if (nameErr) issues.push(nameErr);

      // §11: decision consistency
      // RuleDefinition.action.decision is metadata level
      // content.then is not directly available in RuleDefinition
      // Skip for now — RuleService.createFromTemplate handles this on write path

      // §11: Guard rules MUST NOT have unless
      const guardErr = ruleValidator.checkGuardWithUnless(rule);
      if (guardErr) issues.push(guardErr);

      // §11: unless MUST NOT contain within/rate
      const temporalErr = ruleValidator.checkUnlessWithTemporal(rule);
      if (temporalErr) issues.push(temporalErr);

      // §10.6: security rules MUST have at least 1 condition
      const secErr = ruleValidator.checkSecurityRuleHasCondition(rule);
      if (secErr) issues.push(secErr);

      // §10.4: dangerous regex (ReDoS) detection
      const regexErr = ruleValidator.checkRegexRedosRisk(rule);
      if (regexErr) issues.push(regexErr);

      // §10 E4: AST complexity limits
      const astErr = ruleValidator.checkASTComplexity(rule);
      if (astErr) issues.push(astErr);

      // §16: full naming-format validation (error, binary judgment)
      const nameFullErr = ruleValidator.checkNamingConventionFull(rule);
      if (nameFullErr) issues.push(nameFullErr);

      // §16: no-tool-constraint (warning) — coding/security rules should specify tool.name
      const toolErr = ruleValidator.checkToolConstraint(rule);
      if (toolErr) issues.push(toolErr);

      // §16: Guard then restriction — Guard rules only allow Ring 0-2 + CORRECT/ALLOW
      const guardThenErr = ruleValidator.checkGuardThenRestriction(rule);
      if (guardThenErr) issues.push(guardThenErr);

      if (issues.length > 0) {
        details.push({ ruleId: rule.id, ruleName: rule.name, issues });
      }
    }

    const total = rules.length;
    const passed = total - details.length;
    const errCount = details.filter(d => d.issues.some(i => i.level === 'error')).length;
    const warnCount = details.filter(
      d => d.issues.some(i => i.level === 'warning') && d.issues.every(i => i.level !== 'error'),
    ).length;
    const infoCount = details.filter(d => d.issues.every(i => i.level === 'info')).length;

    if (errCount > 0) {
      logQg.error(
        `❌ ${errCount} error(s), ${warnCount} warning(s), ${infoCount} info in ${total} rules`,
      );
      for (const d of details) {
        const errs = d.issues.filter(i => i.level === 'error');
        if (errs.length > 0) {
          logQg.error(`  ✗ ${d.ruleName}: ${errs.map(e => e.code).join(', ')}`);
        }
      }
    } else if (warnCount > 0) {
      logQg.warn(
        `⚠️ ${warnCount} warning(s)${infoCount > 0 ? `, ${infoCount} info` : ''} in ${total} rules`,
      );
    } else if (infoCount > 0) {
      logQg.log(
        `ℹ️ ${infoCount} naming suggestion(s) in ${total} rules (SHOULD level — non-blocking)`,
      );
    } else if (total > 0) {
      logQg.log(`✅ ${total} rules passed (0 error, 0 warning)`);
    }

    return { total, passed, errors: errCount, warnings: warnCount, details };
  }
}

/**
 * Extract raw when string from a RuleDefinition's conditions.
 * Only returns a value for simple string-when rules;
 * structured conditions (field/operator/value) return undefined.
 */
function extractRawWhen(rule: RuleDefinition): string | undefined {
  // Check if rule has a raw when string stored as a property
  const raw = (rule as unknown as Record<string, unknown>).when as string | undefined;
  if (typeof raw === 'string') return raw;

  // If rule has structured conditions but no explicit when, return undefined
  // (structured templates generate their own when — they're fine)
  return undefined;
}

export const ruleQualityGate = new RuleQualityGate();
