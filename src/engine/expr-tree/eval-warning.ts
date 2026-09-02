/**
 * eval-warning — evaluation warning (SPEC v2.0 §10 E3)
 *
 * Non-fatal issues during evaluation are recorded in eval_warnings; the fold direction is by tier
 * per E12:
 * - tier ≤ 2 / Guard default: fail-close (safe failure)
 * - tier 3-5: fold to false
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

export type EvalWarningKind =
  | 'type_mismatch' // strict type matching failed (§11.2)
  | 'division_by_zero' // division by zero
  | 'field_absent' // field absent (null propagation)
  | 'quantifier_empty' // quantifier empty-array safe fold (E8)
  | 'aggregate_empty' // aggregate empty-array safe fold (§10.4(d))
  | 'regex_re_dos' // regex ReDoS risk
  | 'array_over_limit' // array over limit
  | 'invalid_date' // date parsing failed
  | 'not_ruleable'; // cannot evaluate deterministically

export interface EvalWarning {
  kind: EvalWarningKind;
  message: string;
  /** Node type that triggered the warning */
  nodeType?: string;
}

export interface EvalResult {
  /** Evaluation result value (number/string/boolean/array/null) */
  value: unknown;
  /** Warnings collected during evaluation */
  warnings: EvalWarning[];
  /** Whether an unrecoverable error occurred (structural error, handled externally) */
  errored: boolean;
  error?: string;
}

export function ok(value: unknown, warnings: EvalWarning[] = []): EvalResult {
  return { value, warnings, errored: false };
}

export function err(message: string, warnings: EvalWarning[] = []): EvalResult {
  return { value: null, warnings, errored: true, error: message };
}

/** Merge warnings from multiple child evaluations */
export function mergeWarnings(...results: EvalResult[]): EvalWarning[] {
  const out: EvalWarning[] = [];
  for (const r of results) {
    out.push(...r.warnings);
  }
  return out;
}
