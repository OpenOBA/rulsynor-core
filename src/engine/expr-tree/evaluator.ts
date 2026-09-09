/**
 * ExprTreeEvaluator — expression-tree evaluator (SPEC §10)
 *
 * Tree-walking evaluation, pure function (E1), no side effects, no wall-clock reads.
 * Semantic constraints:
 * - E1  pure function
 * - E8  quantifier empty-array safe fold: all(empty)=false (deliberate deviation), any/none(empty)=false
 * - E9  wall-clock read forbidden; time is injected via context.as_of (external input — this evaluator never reads Date.now)
 * - E11 undefined sentinel semantics: field missing → false for everything except exists (null propagation)
 * - E12 evaluation-error fold: the caller decides fail-close or fold-false by tier
 * - §5.2 strict type matching: no implicit type conversion
 *
 * @since 2026-08-15
 * @license BSL 1.1
 */

import type { ExprNode } from './node-types.js';
import {
  addYears,
  addMonths,
  addDays,
  addHours,
  getYear,
  getMonth,
  getDate,
  getDay,
  endOfMonth,
  parseIsoDateStrict,
} from '../date-utils.js';
import { enforceLimits } from './limits.js';
import { ok, err, mergeWarnings, type EvalResult, type EvalWarning } from './eval-warning.js';
import { TraceCollector, type EvalTrace } from './eval-trace.js';
import {
  fromInt,
  fromNumber,
  add,
  sub,
  mul,
  div,
  compare as rationalCompare,
  toDecimalString,
  type Rational,
} from './fixed-point.js';
import { safeRegExp, safeTest, REGEX_MAX_INPUT_LENGTH } from '../safe-regex.js';
import { normalizeNfc } from './normalize.js';

/** Evaluation context: field/variable resolution functions + the engine-injected asOf time */
export interface EvalContext {
  /** Resolve a field value (dot path); returns undefined when missing */
  resolveField(field: string): unknown;
  /** Resolve a variable (var node, only '$'/'$.path') */
  resolveVar(path: string): unknown;
  /** Engine-injected time base (as_of, ISO string or Date); wall-clock read forbidden */
  asOf?: Date;
}

/** Default context: resolve fields from a plain object */
export function objectContext(obj: Record<string, unknown>, asOf?: Date): EvalContext {
  return {
    resolveField(field: string): unknown {
      if (Object.prototype.hasOwnProperty.call(obj, field)) return obj[field];
      return field.split('.').reduce<unknown>((cur, key) => {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
        return (cur as Record<string, unknown>)[key];
      }, obj);
    },
    resolveVar(path: string): unknown {
      if (path === '$') return obj;
      const p = path.startsWith('$.') ? path.slice(2) : path;
      return p.split('.').reduce<unknown>((cur, key) => {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
        return (cur as Record<string, unknown>)[key];
      }, obj);
    },
    asOf,
  };
}

export class ExprTreeEvaluator {
  /**
   * Evaluate an expression tree.
   * Returns EvalResult (value + warnings + errored); does not throw (except structural errors).
   */
  evaluate(node: ExprNode, context: EvalContext): EvalResult {
    enforceLimits(node);
    return this.evalNode(node, context);
  }

  /** Evaluate and collect eval_trace (SPEC §7.0.3, E6 tree-as-evidence) */
  evaluateWithTrace(
    node: ExprNode,
    context: EvalContext,
  ): { result: EvalResult; trace: EvalTrace } {
    enforceLimits(node);
    this.traceCollector = new TraceCollector();
    // Context snapshot hash: use the asOf timestamp (if injected); the full context is composed
    // from the per-field-node inputValues
    this.traceCollector.setContextHash(context.asOf ? String(context.asOf.getTime()) : '');
    try {
      const result = this.evalNode(node, context, 'root');
      const trace = this.traceCollector.toTrace(node, result.value);
      return { result, trace };
    } finally {
      this.traceCollector = null;
    }
  }

  /** Trace collector (non-null only during evaluateWithTrace) */
  private traceCollector: TraceCollector | null = null;

  private evalNode(node: ExprNode, context: EvalContext, path = 'root'): EvalResult {
    return this.evalNodeInner(node, context, path);
  }

  private evalNodeInner(node: ExprNode, context: EvalContext, path: string): EvalResult {
    switch (node.type) {
      case 'literal': {
        // E10: NFC-normalize string literals (§10.2/§10.3)
        const value = typeof node.value === 'string' ? normalizeNfc(node.value) : node.value;
        const result = ok(value);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [node.value],
          result.value,
          result.value,
        );
        return result;
      }
      case 'field': {
        const resolved = context.resolveField(node.field);
        const result = ok(resolved);
        this.traceCollector?.record(node.type, path, node, [resolved], result.value, result.value);
        return result;
      }
      case 'var': {
        const resolved = context.resolveVar(node.path);
        const result = ok(resolved);
        this.traceCollector?.record(node.type, path, node, [resolved], result.value, result.value);
        return result;
      }

      case 'and': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`));
        const warnings = mergeWarnings(...results);
        if (results.some(r => r.errored)) {
          return err('and: child-node evaluation error', warnings);
        }
        const out = results.every(r => this.toBoolean(r.value));
        this.traceCollector?.record(
          node.type,
          path,
          node,
          results.map(r => r.value),
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }
      case 'or': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`));
        const warnings = mergeWarnings(...results);
        if (results.some(r => r.errored)) {
          return err('or: child-node evaluation error', warnings);
        }
        const out = results.some(r => this.toBoolean(r.value));
        this.traceCollector?.record(
          node.type,
          path,
          node,
          results.map(r => r.value),
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }
      case 'not': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const out = !this.toBoolean(r.value);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [r.value],
          out,
          out,
          r.warnings.map(w => w.message),
        );
        return ok(out, r.warnings);
      }

      case 'compare': {
        const l = this.evalNode(node.left, context, `${path}/left`);
        const r = this.evalNode(node.right, context, `${path}/right`);
        const warnings = mergeWarnings(l, r);
        if (l.errored || r.errored) return err('compare: operand evaluation error', warnings);
        const out = this.compare(node.op, l.value, r.value, warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [l.value, r.value],
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }

      case 'in': {
        const l = this.evalNode(node.left, context, `${path}/left`);
        const r = this.evalNode(node.right, context, `${path}/right`);
        const warnings = mergeWarnings(l, r);
        if (l.errored || r.errored) return err('in: operand evaluation error', warnings);
        if (!Array.isArray(r.value)) {
          warnings.push({
            kind: 'type_mismatch',
            message: 'in right side must be an array',
            nodeType: 'in',
          });
          return ok(false, warnings);
        }
        // SPEC §5.2 list limit: in/not_in operands ≤ 256 items
        if (r.value.length > 256) {
          warnings.push({
            kind: 'array_over_limit',
            message: 'in list exceeds the 256-item limit',
            nodeType: 'in',
          });
          return ok(false, warnings);
        }
        // E10 NFC: membership comparison normalizes strings like eq/ne (decomposed == precomposed); strict === otherwise.
        const out = (r.value as unknown[]).some((el) =>
          typeof l.value === 'string' && typeof el === 'string'
            ? normalizeNfc(l.value) === normalizeNfc(el)
            : l.value === el,
        );
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [l.value, r.value],
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }

      case 'string': {
        const l = this.evalNode(node.left, context, `${path}/left`);
        const r = this.evalNode(node.right, context, `${path}/right`);
        const warnings = mergeWarnings(l, r);
        if (l.errored || r.errored) return err('string: operand evaluation error', warnings);
        const out = this.stringMatch(node.op, l.value, r.value, warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [l.value, r.value],
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }

      case 'exists': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const out = r.value !== undefined && r.value !== null;
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [r.value],
          out,
          out,
          r.warnings.map(w => w.message),
        );
        return ok(out, r.warnings);
      }
      case 'length': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const v = r.value;
        let out: number | boolean;
        if (typeof v === 'string') {
          // SPEC §10.1: length = Unicode code-point count (not UTF-16 code units).
          // JS str.length returns 2 for surrogate pairs (emoji etc.), breaking cross-implementation byte-for-byte consistency.
          out = Array.from(v).length;
        } else if (Array.isArray(v)) {
          out = v.length;
        } else if (v === undefined || v === null) {
          // missing field: length(missing) = 0 (SPEC §5.2 exists-guard rationale)
          out = 0;
        } else {
          // scalar (present, non-string/non-array): type mismatch folds to false (like aggregate non-array, SPEC §7.3(e))
          r.warnings.push({
            kind: 'type_mismatch',
            message: 'length only supports string/array',
            nodeType: 'length',
          });
          out = false;
        }
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [v],
          out,
          out,
          r.warnings.map(w => w.message),
        );
        return ok(out, r.warnings);
      }
      case 'between': {
        const v = this.evalNode(node.value, context, `${path}/value`);
        const mn = this.evalNode(node.min, context, `${path}/min`);
        const mx = this.evalNode(node.max, context, `${path}/max`);
        const warnings = mergeWarnings(v, mn, mx);
        if (v.errored || mn.errored || mx.errored)
          return err('between: operand evaluation error', warnings);
        const out = this.between(v.value, mn.value, mx.value);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [v.value, mn.value, mx.value],
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }

      case 'quantifier': {
        const over = this.evalNode(node.over, context, `${path}/over`);
        if (over.errored) return over;
        if (!Array.isArray(over.value)) {
          // E11 空值传播：over 字段缺失（undefined/null）→ silent false（非错误，无 warning）
          if (over.value === undefined || over.value === null) {
            return ok(false, over.warnings);
          }
          // present 但非数组（标量/对象）→ 类型不匹配，type_mismatch warning + 折叠 false（类似 aggregate §7.3(e)）
          const w: EvalWarning = {
            kind: 'type_mismatch',
            message: 'quantifier over must be an array',
            nodeType: 'quantifier',
          };
          return ok(false, [...over.warnings, w]);
        }
        const arr = over.value as unknown[];
        if (arr.length === 0) {
          const w: EvalWarning = {
            kind: 'quantifier_empty',
            message: `quantifier ${node.kind} empty array folds to false`,
            nodeType: 'quantifier',
          };
          return ok(false, [...over.warnings, w]);
        }
        const results = arr.map((item, i) => {
          const boundCtx: EvalContext = {
            ...context,
            resolveVar: p => (p === node.binding ? item : context.resolveVar(p)),
            resolveField: f => (f === node.binding ? item : context.resolveField(f)),
          };
          return this.evalNode(node.predicate, boundCtx, `${path}/pred${i}`);
        });
        const warnings = mergeWarnings(over, ...results);
        const bools = results.map(r => this.toBoolean(r.value));
        let out: boolean;
        switch (node.kind) {
          case 'all':
            out = bools.every(b => b);
            break;
          case 'any':
            out = bools.some(b => b);
            break;
          case 'none':
            out = !bools.some(b => b);
            break;
        }
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [over.value, ...results.map(r => r.value)],
          out,
          out,
          warnings.map(w => w.message),
        );
        return ok(out, warnings);
      }

      case 'arith': {
        const results = node.args.map((a, i) => this.evalNode(a, context, `${path}/arg${i}`));
        const warnings = mergeWarnings(...results);
        if (results.some(r => r.errored)) return err('arith: operand evaluation error', warnings);
        const result = this.arith(
          node.op,
          results.map(r => r.value),
          warnings,
        );
        this.traceCollector?.record(
          node.type,
          path,
          node,
          results.map(r => r.value),
          result.value,
          result.value,
          warnings.map(w => w.message),
        );
        return result;
      }

      case 'days_between': {
        const from = this.evalNode(node.from, context, `${path}/from`);
        const to = this.evalNode(node.to, context, `${path}/to`);
        const warnings = mergeWarnings(from, to);
        if (from.errored || to.errored)
          return err('days_between: operand evaluation error', warnings);
        const result = this.daysBetween(from.value, to.value, warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [from.value, to.value],
          result.value,
          result.value,
          warnings.map(w => w.message),
        );
        return result;
      }
      case 'epoch_ms': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const result = this.epochMs(r.value, r.warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [r.value],
          result.value,
          result.value,
          r.warnings.map(w => w.message),
        );
        return result;
      }
      case 'date_add': {
        const base = this.evalNode(node.base, context, `${path}/base`);
        const amount = this.evalNode(node.amount, context, `${path}/amount`);
        const warnings = mergeWarnings(base, amount);
        if (base.errored || amount.errored)
          return err('date_add: operand evaluation error', warnings);
        const result = this.dateAdd(node.unit, base.value, amount.value, warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [base.value, amount.value],
          result.value,
          result.value,
          warnings.map(w => w.message),
        );
        return result;
      }
      case 'date_part': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const result = this.datePart(node.unit, r.value, r.warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [r.value],
          result.value,
          result.value,
          r.warnings.map(w => w.message),
        );
        return result;
      }
      case 'month_last_day': {
        const r = this.evalNode(node.arg, context, `${path}/arg`);
        if (r.errored) return r;
        const result = this.monthLastDay(r.value, r.warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [r.value],
          result.value,
          result.value,
          r.warnings.map(w => w.message),
        );
        return result;
      }

      case 'aggregate': {
        const over = this.evalNode(node.over, context, `${path}/over`);
        if (over.errored) return over;
        if (!Array.isArray(over.value)) {
          const w: EvalWarning = {
            kind: 'type_mismatch',
            message: 'aggregate over must be an array',
            nodeType: 'aggregate',
          };
          return ok(null, [...over.warnings, w]);
        }
        const result = this.aggregate(node.fn, over.value as unknown[], over.warnings);
        this.traceCollector?.record(
          node.type,
          path,
          node,
          [over.value],
          result.value,
          result.value,
          over.warnings.map(w => w.message),
        );
        return result;
      }
    }
  }

  // ── Boolean conversion (strict type §5.2: only boolean true is truthy; E11 null propagation: undefined/null → false) ──
  private toBoolean(v: unknown): boolean {
    return v === true;
  }

  // ── Comparison (strict type matching §5.2) ──
  private compare(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    switch (op) {
      case 'eq':
      case 'ne': {
        // E11 null propagation: when a field is missing (undefined) or null (SPEC treats exists(null)=false as absent),
        // eq/ne return false — the sole exceptions are == null / != null checks (right is null/undefined, the only
        // operators that sense field presence). Otherwise `missing != 'admin'` would wrongly evaluate to true via
        // !(undefined === 'admin'), breaking fail-closed (a security hole).
        // Fix (2026-08-27): null and undefined both go through null propagation, aligning the Simple path isAbsent
        // interception and eliminating the E7 semantic divergence.
        if (left === undefined || left === null) {
          const isNullCheck = right === undefined || right === null;
          if (isNullCheck) return op === 'eq'; // eq null → true; ne null → false
          return false; // missing/null field vs non-null value: both eq and ne are false (fail-closed)
        }
        // left is present (non-null): a == null / != null check against a null right operand
        // senses presence — the value is present, so != null is true and == null is false.
        // (Must precede the type-mismatch guard below: typeof null === 'object' would
        // otherwise misclassify `field != null` as a type mismatch.)
        if (right === undefined || right === null) {
          return op === 'ne'; // ne null → true (present); eq null → false
        }
        // Numeric (number/Rational) use rational comparison; objects use deep comparison (aligned with the old evaluator); otherwise strict ===
        const lr = this.toRational(left);
        const rr = this.toRational(right);
        if (lr !== null && rr !== null) {
          const eq = rationalCompare(lr, rr) === 0;
          return op === 'eq' ? eq : !eq;
        }
        // Object deep comparison (aligned with the old evaluator's JSON.stringify equality semantics)
        // Determinism caveat: JSON.stringify depends on object key insertion order; cross-implementation field order must be guaranteed.
        if (
          typeof left === 'object' &&
          left !== null &&
          typeof right === 'object' &&
          right !== null
        ) {
          const eq = JSON.stringify(left) === JSON.stringify(right);
          return op === 'eq' ? eq : !eq;
        }
        // E10: NFC-normalize before string comparison (precomposed é equals decomposed e+´)
        const ls = typeof left === 'string' ? normalizeNfc(left) : left;
        const rs = typeof right === 'string' ? normalizeNfc(right) : right;
        // SPEC §7.3(a): a type-mismatched comparison returns false (no implicit conversion).
        // Without this guard `false != 100` would evaluate to true via JS `!==` (fail-open).
        if (typeof ls !== typeof rs) return false;
        const eq = ls === rs;
        return op === 'eq' ? eq : !eq;
      }
      case 'gt':
        return this.numCompare(left, right, 'gt', warnings);
      case 'gte':
        return this.numCompare(left, right, 'gte', warnings);
      case 'lt':
        return this.numCompare(left, right, 'lt', warnings);
      case 'lte':
        return this.numCompare(left, right, 'lte', warnings);
      default:
        return false;
    }
  }

  private numCompare(left: unknown, right: unknown, op: string, _warnings: EvalWarning[]): boolean {
    // Aligned with the old evaluator: string vs string uses lexicographic comparison; number/Rational uses rational
    // comparison; mismatched types return false.
    if (typeof left === 'string' && typeof right === 'string') {
      switch (op) {
        case 'gt':
          return left > right;
        case 'gte':
          return left >= right;
        case 'lt':
          return left < right;
        case 'lte':
          return left <= right;
      }
      return false;
    }
    const lr = this.toRational(left);
    const rr = this.toRational(right);
    if (lr === null || rr === null) {
      return false;
    }
    const cmp = rationalCompare(lr, rr);
    switch (op) {
      case 'gt':
        return cmp > 0;
      case 'gte':
        return cmp >= 0;
      case 'lt':
        return cmp < 0;
      case 'lte':
        return cmp <= 0;
    }
    return false;
  }

  /** Convert a numeric value (number / Rational) to a Rational; others (incl. string / bare bigint) return null */
  private toRational(v: unknown): Rational | null {
    if (typeof v === 'number') {
      // R2 fix: fromNumber expands scientific notation (String(1e-7)="1e-7" → "0.0000001");
      // any conversion failure (non-finite etc.) returns null → type_mismatch warning + fail-close (E12), never throws.
      try {
        return fromNumber(v);
      } catch {
        return null;
      }
    }
    if (this.isRational(v)) return v as Rational;
    // Strict type matching §5.2: string / bare bigint are not implicitly converted to numeric → null
    return null;
  }

  /** Check whether a value is a Rational object (structural marker) */
  private isRational(v: unknown): boolean {
    return (
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Rational).num === 'bigint' &&
      typeof (v as Rational).den === 'bigint'
    );
  }

  // ── String matching (aligned with the old evaluator: object deep search + case-sensitive match; E10 string NFC) ──
  private stringMatch(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    if (typeof right !== 'string') {
      warnings.push({
        kind: 'type_mismatch',
        message: 'string-op right operand must be a string',
        nodeType: 'string',
      });
      return false;
    }
    const rn = normalizeNfc(right);
    switch (op) {
      case 'contains': {
        // Aligned with the old evaluator: recursively search all strings in an object value
        if (typeof left === 'object' && left !== null) {
          return this.deepContains(left as Record<string, unknown>, rn);
        }
        // §5.2 strict type matching: non-string, non-object (number/boolean etc.) are not implicitly String()-converted
        if (typeof left !== 'string') {
          return false;
        }
        return normalizeNfc(left).includes(rn);
      }
      case 'starts_with':
        return typeof left === 'string' && normalizeNfc(left).startsWith(rn);
      case 'ends_with':
        return typeof left === 'string' && normalizeNfc(left).endsWith(rn);
      case 'match': {
        try {
          // Regex is always case-sensitive (spec: no inline case-insensitive option).
          // safeRegExp rejects non-regular constructs (backreferences / lookaround) and
          // ReDoS-unsafe patterns; safeTest enforces the input length cap (E4 bounded cost).
          const re = safeRegExp(rn);
          if (typeof left === 'object' && left !== null) {
            return this.deepMatch(left as Record<string, unknown>, re);
          }
          if (typeof left !== 'string') return false;
          const ln = normalizeNfc(left);
          if (ln.length > REGEX_MAX_INPUT_LENGTH) {
            warnings.push({
              kind: 'regex_re_dos',
              message: `regex match input too long (${ln.length} > ${REGEX_MAX_INPUT_LENGTH}), truncated match`,
              nodeType: 'string',
            });
          }
          return safeTest(re, ln);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push({ kind: 'regex_re_dos', message: msg, nodeType: 'string' });
          return false;
        }
      }
      default:
        return false;
    }
  }

  /** Recursively search all string values in an object (aligned with the old evaluator deepContains) */
  private deepContains(obj: Record<string, unknown>, search: string, depth = 0): boolean {
    if (depth > 10) return false;
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        if (normalizeNfc(v).includes(search)) return true;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if (this.deepContains(v as Record<string, unknown>, search, depth + 1)) return true;
      }
    }
    return false;
  }

  /** Recursively regex-match all string values in an object (aligned with the old evaluator deepMatch) */
  private deepMatch(obj: Record<string, unknown>, re: RegExp, depth = 0): boolean {
    if (depth > 10) return false;
    // Pass the same re recursively (case sensitivity decided by the caller) to avoid first-level/deep-level semantic drift
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        if (safeTest(re, normalizeNfc(v))) return true;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if (this.deepMatch(v as Record<string, unknown>, re, depth + 1)) return true;
      }
    }
    return false;
  }

  // ── between (closed interval [min,max], supports numeric/Rational) ──
  private between(value: unknown, min: unknown, max: unknown): boolean {
    const v = this.toRational(value);
    const mn = this.toRational(min);
    const mx = this.toRational(max);
    if (v === null || mn === null || mx === null) return false;
    return rationalCompare(v, mn) >= 0 && rationalCompare(v, mx) <= 0;
  }

  // ── Arithmetic (E2 strict fixed-point decimals: intermediate rationals, no automatic rounding) ──
  private arith(op: string, values: unknown[], warnings: EvalWarning[]): EvalResult {
    // Convert each operand to a Rational; non-numeric → type mismatch
    const rats: Rational[] = [];
    for (const v of values) {
      const r = this.toRational(v);
      if (r === null) {
        warnings.push({
          kind: 'type_mismatch',
          message: `arithmetic operand is non-numeric: ${typeof v}`,
          nodeType: 'arith',
        });
        return err('arithmetic operand is non-numeric', warnings);
      }
      rats.push(r);
    }

    switch (op) {
      case 'add': {
        if (rats.length === 0) return ok(fromInt(0), warnings);
        let acc = rats[0];
        for (let i = 1; i < rats.length; i++) acc = add(acc, rats[i]);
        return ok(acc, warnings);
      }
      case 'mul': {
        if (rats.length === 0) return ok(fromInt(1), warnings);
        let acc = rats[0];
        for (let i = 1; i < rats.length; i++) acc = mul(acc, rats[i]);
        return ok(acc, warnings);
      }
      case 'sub': {
        // Subtraction is non-associative → must be binary
        if (rats.length !== 2) {
          warnings.push({
            kind: 'type_mismatch',
            message: `sub requires two operands, got ${rats.length}`,
            nodeType: 'arith',
          });
          return err('sub requires two operands', warnings);
        }
        return ok(sub(rats[0], rats[1]), warnings);
      }
      case 'div': {
        // Division is non-associative → must be binary
        if (rats.length !== 2) {
          warnings.push({
            kind: 'type_mismatch',
            message: `div requires two operands, got ${rats.length}`,
            nodeType: 'arith',
          });
          return err('div requires two operands', warnings);
        }
        if (rats[1].num === 0n) {
          warnings.push({
            kind: 'division_by_zero',
            message: 'division by zero',
            nodeType: 'arith',
          });
          return err('division by zero', warnings);
        }
        return ok(div(rats[0], rats[1]), warnings);
      }
      case 'round': {
        if (rats.length !== 1) {
          warnings.push({
            kind: 'type_mismatch',
            message: `round requires one operand, got ${rats.length}`,
            nodeType: 'arith',
          });
          return err('round requires one operand', warnings);
        }
        // round → half-even rounding to integer (reuse toDecimalString(scale=0) correct rounding semantics)
        const s = toDecimalString(rats[0], 0);
        return ok(fromInt(s), warnings);
      }
      default:
        return err(`unknown arithmetic operation ${op}`, warnings);
    }
  }

  // ── Time (wall-clock read forbidden; as_of injected via context) ──
  private daysBetween(from: unknown, to: unknown, warnings: EvalWarning[]): EvalResult {
    const d1 = parseIsoDateStrict(from);
    const d2 = parseIsoDateStrict(to);
    if (d1 === null || d2 === null) {
      warnings.push({
        kind: 'invalid_date',
        message: 'date parsing failed',
        nodeType: 'days_between',
      });
      return err('invalid date', warnings);
    }
    return ok(Math.floor((d2.getTime() - d1.getTime()) / 86400000), warnings);
  }

  private epochMs(value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = parseIsoDateStrict(value);
    if (d === null) {
      warnings.push({ kind: 'invalid_date', message: 'date parsing failed', nodeType: 'epoch_ms' });
      return err('invalid date', warnings);
    }
    return ok(d.getTime(), warnings);
  }

  /** Parse an arbitrary value into a Date; returns null when invalid */
  private toDate(value: unknown): Date | null {
    return parseIsoDateStrict(value);
  }

  /** Time addition/subtraction: date_add{unit}, negative amount = backward. Year/month arithmetic is carried by UTC
   * calendar operations (month-end rollback, SPEC §10.5 UTC semantics) */
  private dateAdd(
    unit: string,
    base: unknown,
    amount: unknown,
    warnings: EvalWarning[],
  ): EvalResult {
    const d = this.toDate(base);
    if (d === null) {
      warnings.push({
        kind: 'invalid_date',
        message: `date_add base date invalid: ${String(base)}`,
        nodeType: 'date_add',
      });
      return err('invalid date', warnings);
    }
    const n = this.toRational(amount);
    if (n === null) {
      warnings.push({
        kind: 'type_mismatch',
        message: `date_add step must be numeric: ${typeof amount}`,
        nodeType: 'date_add',
      });
      return err('date_add step must be numeric', warnings);
    }
    // SPEC v2.1 §7.3(f): amount MUST be an integer (a duration is an integer unit;
    // half-even rounding of "add 1.5 months" has no business meaning).
    if (n.den !== 1n) {
      warnings.push({
        kind: 'type_mismatch',
        message: `date_add step must be an integer, got ${toDecimalString(n)}`,
        nodeType: 'date_add',
      });
      return err('date_add step must be an integer', warnings);
    }
    const int = Number(n.num);
    switch (unit) {
      case 'years':
        return ok(addYears(d, int), warnings);
      case 'months':
        return ok(addMonths(d, int), warnings);
      case 'days':
        return ok(addDays(d, int), warnings);
      case 'hours':
        return ok(addHours(d, int), warnings);
      default:
        warnings.push({
          kind: 'type_mismatch',
          message: `unknown date_add unit: ${unit}`,
          nodeType: 'date_add',
        });
        return err('unknown date_add unit', warnings);
    }
  }

  /** Extract a time component: date_part{unit}. day_of_week: UTC getDay returns 0=Sunday, normalized to 1=Monday…7=Sunday */
  private datePart(unit: string, value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value);
    if (d === null) {
      warnings.push({
        kind: 'invalid_date',
        message: `date_part date invalid: ${String(value)}`,
        nodeType: 'date_part',
      });
      return err('invalid date', warnings);
    }
    switch (unit) {
      case 'year':
        return ok(getYear(d), warnings);
      case 'month':
        return ok(getMonth(d) + 1, warnings); // aligned with human convention: 1=January
      case 'day':
        return ok(getDate(d), warnings);
      case 'hour':
        return ok(d.getUTCHours(), warnings);
      case 'minute':
        return ok(d.getUTCMinutes(), warnings);
      case 'second':
        return ok(d.getUTCSeconds(), warnings);
      case 'day_of_week': {
        const d0 = getDay(d); // 0=Sunday
        return ok(d0 === 0 ? 7 : d0, warnings); // 1=Monday … 7=Sunday
      }
      default:
        warnings.push({
          kind: 'type_mismatch',
          message: `unknown date_part component: ${unit}`,
          nodeType: 'date_part',
        });
        return err('unknown date_part component', warnings);
    }
  }

  /** Last day of the month containing the given date (§10.5 month-end rollback primitive) */
  private monthLastDay(value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value);
    if (d === null) {
      warnings.push({
        kind: 'invalid_date',
        message: `month_last_day date invalid: ${String(value)}`,
        nodeType: 'month_last_day',
      });
      return err('invalid date', warnings);
    }
    return ok(endOfMonth(d), warnings);
  }

  // ── Aggregate (E2 strict fixed-point decimals: sum/avg/min/max use rationals, consistent with arith; count stays integer) ──
  private aggregate(fn: string, arr: unknown[], warnings: EvalWarning[]): EvalResult {
    switch (fn) {
      case 'count':
        return ok(arr.length, warnings);
      case 'sum': {
        const rats = this.toRationalArray(arr, 'sum', warnings);
        if (rats === null) return ok(null, warnings);
        let acc = fromInt(0);
        for (const r of rats) acc = add(acc, r);
        return ok(acc, warnings);
      }
      case 'avg': {
        if (arr.length === 0) {
          warnings.push({
            kind: 'aggregate_empty',
            message: 'avg array is empty, safely folds to false',
            nodeType: 'aggregate',
          });
          return ok(false, warnings);
        }
        const rats = this.toRationalArray(arr, 'avg', warnings);
        if (rats === null) return ok(null, warnings);
        let acc = fromInt(0);
        for (const r of rats) acc = add(acc, r);
        return ok(div(acc, fromInt(rats.length)), warnings);
      }
      case 'min': {
        const rats = this.toRationalArray(arr, 'min', warnings);
        if (rats === null) return ok(null, warnings);
        if (rats.length === 0) {
          warnings.push({
            kind: 'aggregate_empty',
            message: 'min array is empty, safely folds to false',
            nodeType: 'aggregate',
          });
          return ok(false, warnings);
        }
        let m = rats[0];
        for (let i = 1; i < rats.length; i++) if (rationalCompare(rats[i], m) < 0) m = rats[i];
        return ok(m, warnings);
      }
      case 'max': {
        const rats = this.toRationalArray(arr, 'max', warnings);
        if (rats === null) return ok(null, warnings);
        if (rats.length === 0) {
          warnings.push({
            kind: 'aggregate_empty',
            message: 'max array is empty, safely folds to false',
            nodeType: 'aggregate',
          });
          return ok(false, warnings);
        }
        let m = rats[0];
        for (let i = 1; i < rats.length; i++) if (rationalCompare(rats[i], m) > 0) m = rats[i];
        return ok(m, warnings);
      }
      default:
        return err(`unknown aggregate function ${fn}`, warnings);
    }
  }

  /** Uniformly convert array elements to Rationals; on non-numeric (incl. string, §5.2 strict type) returns null and logs a warning */
  private toRationalArray(arr: unknown[], fn: string, warnings: EvalWarning[]): Rational[] | null {
    const rats: Rational[] = [];
    for (const v of arr) {
      const r = this.toRational(v);
      if (r === null) {
        warnings.push({
          kind: 'type_mismatch',
          message: `${fn} array contains a non-numeric element: ${typeof v}`,
          nodeType: 'aggregate',
        });
        return null;
      }
      rats.push(r);
    }
    return rats;
  }
}

/** Singleton */
export const exprTreeEvaluator = new ExprTreeEvaluator();
