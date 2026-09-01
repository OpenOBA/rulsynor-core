/**
 * Guidance Runtime — SPEC v2.0 §1 + §27
 *
 * Transforms Guard evaluation results into actionable guidance for LLM:
 * what was blocked, why, and what to do instead.
 *
 * This is the core of the "Navigation Layer" — ERDL moves from blunt
 * blocking to guiding the Agent toward compliant alternatives.
 *
 * Zero framework dependency. Pure function.
 * Extracted from rulsynor/packages/backend guard.service.ts (F3).
 *
 * @module @openoba/rulsynor-core/guidance
 */

/** Matched rule entry from Guard evaluation */
export interface GuidanceRuleMatch {
  ruleId: string;
  decision: string;
  reason: string | null;
}

/** Navigation guide — the output of extractNavigationGuide */
export interface NavigationGuide {
  ruleName: string;
  decision: string;
  reason: string;
  corrections: string[];
  alternatives: string[];
  blockedReasons: string[];
}

/** Options for extractNavigationGuide */
export interface GuidanceOptions {
  /** Matched rules from Guard evaluation (priority order) */
  matchedRules: GuidanceRuleMatch[];
  /** Final Guard decision */
  decision: string;
  /** Primary reason for the decision */
  reason: string | null;
  /** Optional rule store for extracting correction/alternative metadata */
  rules?: Array<{
    name: string;
    action?: { correction?: string; alternative?: string | { en: string } };
  }>;
}

/**
 * Extract navigation guidance from a Guard evaluation result.
 *
 * Walks matched rules in priority order and builds three guidance vectors:
 *   - corrections: CORRECT rules tell the LLM how to fix the tool call
 *   - blockedReasons: DENY/EMERGENCY_HALT rules tell the LLM why it was stopped
 *   - alternatives: suggested alternative tools/parameters
 *
 * Pure function — no side effects, no framework dependency.
 */
export function extractNavigationGuide(opts: GuidanceOptions): NavigationGuide {
  const primary = opts.matchedRules[0];

  const corrections: string[] = [];
  const alternatives: string[] = [];
  const blockedReasons: string[] = [];

  for (const match of opts.matchedRules) {
    if (match.reason) {
      if (match.decision === 'CORRECT') {
        corrections.push(match.reason);
      } else if (match.decision === 'DENY' || match.decision === 'EMERGENCY_HALT') {
        blockedReasons.push(`${match.ruleId}: ${match.reason}`);
      }
    }
  }

  // Extract correction/alternative from primary rule if available
  if (opts.rules && primary) {
    const primaryRule = opts.rules.find(r => r.name === primary.ruleId);
    if (primaryRule?.action?.alternative) {
      const alt = primaryRule.action.alternative;
      alternatives.push(typeof alt === 'string' ? alt : alt.en);
    }
    if (primaryRule?.action?.correction) {
      corrections.push(primaryRule.action.correction);
    }
  }

  return {
    ruleName: primary?.ruleId ?? 'unknown',
    decision: opts.decision,
    reason: opts.reason ?? primary?.reason ?? 'Rule matched',
    corrections: [...new Set(corrections)],
    alternatives: [...new Set(alternatives)],
    blockedReasons,
  };
}
