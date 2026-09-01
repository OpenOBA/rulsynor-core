/**
 * exprTreeEvaluator — 表达式树求值器（SPEC v2.0 §10）
 *
 * 树遍历求值，纯函数（E1），无副作用、无墙钟读取。
 * 语义约束：
 * - E1  纯函数
 * - E8  量词空数组安全折叠：all(空)=false（刻意偏离），any/none(空)=false
 * - E9  禁读墙钟；时间由 context.as_of 注入（外部传入，本求值器不读 Date.now）
 * - E11 undefined 哨兵语义：字段缺失 → 除 exists 外一律 false（空值传播）
 * - E12 求值错误折叠：由调用方按 tier 决定 fail-close 或 fold-false
 * - §11.2 严格类型匹配：无隐式类型转换
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
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

/** 求值上下文：字段/变量解析函数 + 引擎注入的 as_of 时间 */
export interface EvalContext {
  /** 解析字段值（支持点路径）；返回 undefined 表示缺失 */
  resolveField(field: string): unknown;
  /** 解析变量（var 节点，仅 '$'/'$.path'） */
  resolveVar(path: string): unknown;
  /** 引擎注入的时间基准（as_of，ISO 字符串或 Date），禁读墙钟 */
  asOf?: Date;
}

/** 默认上下文：从普通对象解析字段 */
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
   * 求值一棵表达式树。
   * 返回 EvalResult（value + warnings + errored），不抛异常（结构性错误除外）。
   */
  evaluate(node: ExprNode, context: EvalContext): EvalResult {
    enforceLimits(node);
    return this.evalNode(node, context);
  }

  /** 求值并收集 eval_trace（SPEC §17，E6 树即证据） */
  evaluateWithTrace(
    node: ExprNode,
    context: EvalContext,
  ): { result: EvalResult; trace: EvalTrace } {
    enforceLimits(node);
    this.traceCollector = new TraceCollector();
    // 上下文快照哈希：用 asOf 时间戳（若注入）；完整 context 由各 field 节点 inputValues 组成
    this.traceCollector.setContextHash(context.asOf ? String(context.asOf.getTime()) : '');
    try {
      const result = this.evalNode(node, context, 'root');
      const trace = this.traceCollector.toTrace(node, result.value);
      return { result, trace };
    } finally {
      this.traceCollector = null;
    }
  }

  /** trace 收集器（仅在 evaluateWithTrace 期间非 null） */
  private traceCollector: TraceCollector | null = null;

  private evalNode(node: ExprNode, context: EvalContext, path = 'root'): EvalResult {
    return this.evalNodeInner(node, context, path);
  }

  private evalNodeInner(node: ExprNode, context: EvalContext, path: string): EvalResult {
    switch (node.type) {
      case 'literal': {
        // E10：字符串字面量 NFC 规范化（§10.2/§10.3）
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
          return err('and: 子节点求值错误', warnings);
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
          return err('or: 子节点求值错误', warnings);
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
        if (l.errored || r.errored) return err('compare: 操作数求值错误', warnings);
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
        if (l.errored || r.errored) return err('in: 操作数求值错误', warnings);
        if (!Array.isArray(r.value)) {
          warnings.push({ kind: 'type_mismatch', message: 'in 右侧必须为数组', nodeType: 'in' });
          return ok(false, warnings);
        }
        // SPEC §11.2 列表上限：in/not_in 操作数 ≤256 项
        if (r.value.length > 256) {
          warnings.push({
            kind: 'array_over_limit',
            message: 'in 列表超过 256 项上限',
            nodeType: 'in',
          });
          return ok(false, warnings);
        }
        const out = (r.value as unknown[]).includes(l.value);
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
        if (l.errored || r.errored) return err('string: 操作数求值错误', warnings);
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
        let out: number;
        if (typeof v === 'string') {
          // SPEC §10.1：length = Unicode 码点数（非 UTF-16 code unit）。
          // JS 的 str.length 对代理对（emoji 等）返回 2，破坏跨实现逐字节一致性。
          out = Array.from(v).length;
        } else if (Array.isArray(v)) {
          out = v.length;
        } else {
          r.warnings.push({
            kind: 'type_mismatch',
            message: 'length 仅支持字符串/数组',
            nodeType: 'length',
          });
          out = 0;
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
        if (v.errored || mn.errored || mx.errored) return err('between: 操作数求值错误', warnings);
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
          const w: EvalWarning = {
            kind: 'type_mismatch',
            message: '量词 over 必须为数组',
            nodeType: 'quantifier',
          };
          return ok(false, [...over.warnings, w]);
        }
        const arr = over.value as unknown[];
        if (arr.length === 0) {
          const w: EvalWarning = {
            kind: 'quantifier_empty',
            message: `量词 ${node.kind} 空数组折叠为 false`,
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
        if (results.some(r => r.errored)) return err('arith: 操作数求值错误', warnings);
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
        if (from.errored || to.errored) return err('days_between: 操作数求值错误', warnings);
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
        if (base.errored || amount.errored) return err('date_add: 操作数求值错误', warnings);
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
            message: 'aggregate over 必须为数组',
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

  // ── 布尔转换（严格类型 §11.2：仅 boolean true 为真；E11 空值传播：undefined/null → false）──
  private toBoolean(v: unknown): boolean {
    return v === true;
  }

  // ── 比较（严格类型匹配 §11.2）──
  private compare(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    switch (op) {
      case 'eq':
      case 'ne': {
        // E11 空值传播：字段缺失（undefined）或空值（null，SPEC exists(null)=false 视为不存在）时，
        // eq/ne 一律返回 false，唯一例外是 == null / != null 检查（right 为 null/undefined，唯一可感知字段存在性的操作符）。
        // 否则 missing != 'admin' 会因 !(undefined === 'admin') 误判为 true，破坏 fail-closed（安全漏洞）。
        // 修复（2026-08-27）：null 与 undefined 统一走空值传播，对齐 Simple 路径 isAbsent 拦截，消除 E7 语义分歧。
        if (left === undefined || left === null) {
          const isNullCheck = right === undefined || right === null;
          if (isNullCheck) return op === 'eq'; // eq null → true；ne null → false
          return false; // 缺失/空值字段 vs 非 null 值：eq 和 ne 都 false（fail-closed）
        }
        // 数值类（number/Rational）用有理数比较；对象用深比较（对齐旧 evaluator）；其余用严格 ===
        const lr = this.toRational(left);
        const rr = this.toRational(right);
        if (lr !== null && rr !== null) {
          const eq = rationalCompare(lr, rr) === 0;
          return op === 'eq' ? eq : !eq;
        }
        // 对象深比较（对齐旧 evaluator 的 JSON.stringify 相等语义）
        // 确定性风险标注：JSON.stringify 依赖对象字段插入顺序，跨实现须保证字段顺序一致
        if (
          typeof left === 'object' &&
          left !== null &&
          typeof right === 'object' &&
          right !== null
        ) {
          const eq = JSON.stringify(left) === JSON.stringify(right);
          return op === 'eq' ? eq : !eq;
        }
        // E10：字符串比较前 NFC 规范化（预组合 é 与分解 e+´ 相等）
        const ls = typeof left === 'string' ? normalizeNfc(left) : left;
        const rs = typeof right === 'string' ? normalizeNfc(right) : right;
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

  private numCompare(left: unknown, right: unknown, op: string, warnings: EvalWarning[]): boolean {
    // 对齐旧 evaluator：string vs string 做字典序比较；number/Rational 做有理数比较；异类型返回 false
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
      warnings.push({
        kind: 'type_mismatch',
        message: `不支持 ${typeof left} 与 ${typeof right} 的大小比较`,
        nodeType: 'compare',
      });
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

  /** 将数值类值（number / Rational）转换为有理数；其余（含 string / 裸 bigint）返回 null */
  private toRational(v: unknown): Rational | null {
    if (typeof v === 'number') {
      // R2 修复：fromNumber 展开科学计数法（String(1e-7)="1e-7" → "0.0000001"）；
      // 任何转换失败（非有限值等）一律返回 null → type_mismatch warning + fail-close（E12），绝不外抛
      try {
        return fromNumber(v);
      } catch {
        return null;
      }
    }
    if (this.isRational(v)) return v as Rational;
    // 严格类型匹配 §11.2：string / 裸 bigint 不隐式转数值 → null
    return null;
  }

  /** 判断是否为 Rational 对象（结构化标记） */
  private isRational(v: unknown): boolean {
    return (
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Rational).num === 'bigint' &&
      typeof (v as Rational).den === 'bigint'
    );
  }

  // ── 字符串匹配（对齐旧 evaluator：对象深度搜索 + match 大小写不敏感；E10 字符串 NFC）──
  private stringMatch(op: string, left: unknown, right: unknown, warnings: EvalWarning[]): boolean {
    if (typeof right !== 'string') {
      warnings.push({
        kind: 'type_mismatch',
        message: '字符串运算右操作数必须为字符串',
        nodeType: 'string',
      });
      return false;
    }
    const rn = normalizeNfc(right);
    switch (op) {
      case 'contains': {
        // 对齐旧 evaluator：对象值递归搜所有字符串
        if (typeof left === 'object' && left !== null) {
          return this.deepContains(left as Record<string, unknown>, rn);
        }
        // §11.2 严格类型匹配：非字符串、非对象（number/boolean 等）不隐式 String() 转换
        if (typeof left !== 'string') {
          warnings.push({
            kind: 'type_mismatch',
            message: 'contains 左操作数必须为字符串',
            nodeType: 'string',
          });
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
          // 正则默认大小写敏感（业界主流：JS/Python/Rust/OPA 正则默认均敏感）；
          // 需不敏感时规则显式写 (?i)。S2 加固：经 safeTest 施加输入长度上限（E4 成本有界）
          const re = safeRegExp(rn);
          if (typeof left === 'object' && left !== null) {
            return this.deepMatch(left as Record<string, unknown>, re);
          }
          if (typeof left !== 'string') return false;
          const ln = normalizeNfc(left);
          if (ln.length > REGEX_MAX_INPUT_LENGTH) {
            warnings.push({
              kind: 'regex_re_dos',
              message: `正则匹配输入超长（${ln.length} > ${REGEX_MAX_INPUT_LENGTH}），已截断匹配`,
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

  /** 递归搜对象中所有字符串值（对齐旧 evaluator deepContains） */
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

  /** 递归搜对象中所有字符串值做正则匹配（对齐旧 evaluator deepMatch） */
  private deepMatch(obj: Record<string, unknown>, re: RegExp, depth = 0): boolean {
    if (depth > 10) return false;
    // 递归一致传递同一 re（大小写敏感性由调用方决定），避免首层/深层语义漂移
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        if (safeTest(re, normalizeNfc(v))) return true;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        if (this.deepMatch(v as Record<string, unknown>, re, depth + 1)) return true;
      }
    }
    return false;
  }

  // ── between（闭区间 [min,max]，支持数值/Rational）──
  private between(value: unknown, min: unknown, max: unknown): boolean {
    const v = this.toRational(value);
    const mn = this.toRational(min);
    const mx = this.toRational(max);
    if (v === null || mn === null || mx === null) return false;
    return rationalCompare(v, mn) >= 0 && rationalCompare(v, mx) <= 0;
  }

  // ── 算术（E2 严格定点小数：中间有理数，不自发舍入）──
  private arith(op: string, values: unknown[], warnings: EvalWarning[]): EvalResult {
    // 将每个操作数转为有理数；非数值 → 类型不匹配
    const rats: Rational[] = [];
    for (const v of values) {
      const r = this.toRational(v);
      if (r === null) {
        warnings.push({
          kind: 'type_mismatch',
          message: `算术操作数非数值：${typeof v}`,
          nodeType: 'arith',
        });
        return ok(null, warnings);
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
        // 减法不可结合 → 必须二元
        if (rats.length !== 2) {
          warnings.push({
            kind: 'type_mismatch',
            message: `sub 必须两个操作数，实际 ${rats.length}`,
            nodeType: 'arith',
          });
          return ok(null, warnings);
        }
        return ok(sub(rats[0], rats[1]), warnings);
      }
      case 'div': {
        // 除法不可结合 → 必须二元
        if (rats.length !== 2) {
          warnings.push({
            kind: 'type_mismatch',
            message: `div 必须两个操作数，实际 ${rats.length}`,
            nodeType: 'arith',
          });
          return ok(null, warnings);
        }
        if (rats[1].num === 0n) {
          warnings.push({ kind: 'division_by_zero', message: '除零', nodeType: 'arith' });
          return ok(null, warnings);
        }
        return ok(div(rats[0], rats[1]), warnings);
      }
      case 'round': {
        if (rats.length !== 1) {
          warnings.push({
            kind: 'type_mismatch',
            message: `round 必须一个操作数，实际 ${rats.length}`,
            nodeType: 'arith',
          });
          return ok(null, warnings);
        }
        // round → half-even 四舍五入到整数（复用 toDecimalString(scale=0) 的正确舍入语义）
        const s = toDecimalString(rats[0], 0);
        return ok(fromInt(s), warnings);
      }
      default:
        return err(`未知算术操作 ${op}`, warnings);
    }
  }

  // ── 时间（禁读墙钟，as_of 由 context 注入）──
  private daysBetween(from: unknown, to: unknown, warnings: EvalWarning[]): EvalResult {
    const d1 = from instanceof Date ? from.getTime() : new Date(String(from)).getTime();
    const d2 = to instanceof Date ? to.getTime() : new Date(String(to)).getTime();
    if (Number.isNaN(d1) || Number.isNaN(d2)) {
      warnings.push({ kind: 'invalid_date', message: '日期解析失败', nodeType: 'days_between' });
      return ok(null, warnings);
    }
    return ok(Math.floor((d2 - d1) / 86400000), warnings);
  }

  private epochMs(value: unknown, warnings: EvalWarning[]): EvalResult {
    const t = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
    if (Number.isNaN(t)) {
      warnings.push({ kind: 'invalid_date', message: '日期解析失败', nodeType: 'epoch_ms' });
      return ok(null, warnings);
    }
    return ok(t, warnings);
  }

  /** 解析任意值为 Date；非法返回 null */
  private toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const d = new Date(String(value ?? ''));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** 时间加减：date_add{unit}，负 amount=逆推。对年对月由 UTC 日历运算承载（月末回退，SPEC §10.5 UTC 语义） */
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
        message: `date_add 基准日期非法：${String(base)}`,
        nodeType: 'date_add',
      });
      return ok(null, warnings);
    }
    const n = this.toRational(amount);
    if (n === null) {
      warnings.push({
        kind: 'type_mismatch',
        message: `date_add 步长必须为数值：${typeof amount}`,
        nodeType: 'date_add',
      });
      return ok(null, warnings);
    }
    const int = Number(toDecimalString(n, 0));
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
          message: `未知 date_add 单位：${unit}`,
          nodeType: 'date_add',
        });
        return ok(null, warnings);
    }
  }

  /** 取时间分量：date_part{unit}。day_of_week：UTC getDay 返回 0=周日，统一为 1=周一…7=周日 */
  private datePart(unit: string, value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value);
    if (d === null) {
      warnings.push({
        kind: 'invalid_date',
        message: `date_part 日期非法：${String(value)}`,
        nodeType: 'date_part',
      });
      return ok(null, warnings);
    }
    switch (unit) {
      case 'year':
        return ok(getYear(d), warnings);
      case 'month':
        return ok(getMonth(d) + 1, warnings); // 对齐人类习惯：1=一月
      case 'day':
        return ok(getDate(d), warnings);
      case 'hour':
        return ok(d.getUTCHours(), warnings);
      case 'minute':
        return ok(d.getUTCMinutes(), warnings);
      case 'second':
        return ok(d.getUTCSeconds(), warnings);
      case 'day_of_week': {
        const d0 = getDay(d); // 0=周日
        return ok(d0 === 0 ? 7 : d0, warnings); // 1=周一 … 7=周日
      }
      default:
        warnings.push({
          kind: 'type_mismatch',
          message: `未知 date_part 分量：${unit}`,
          nodeType: 'date_part',
        });
        return ok(null, warnings);
    }
  }

  /** 某日所在月的最后一天（§202 月末回退原语） */
  private monthLastDay(value: unknown, warnings: EvalWarning[]): EvalResult {
    const d = this.toDate(value);
    if (d === null) {
      warnings.push({
        kind: 'invalid_date',
        message: `month_last_day 日期非法：${String(value)}`,
        nodeType: 'month_last_day',
      });
      return ok(null, warnings);
    }
    return ok(endOfMonth(d), warnings);
  }

  // ── 聚合（E2 严格定点小数：sum/avg/min/max 走有理数，与 arith 一致；count 保持整数）──
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
            message: 'avg 数组为空，安全折叠为 false',
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
            message: 'min 数组为空，安全折叠为 false',
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
            message: 'max 数组为空，安全折叠为 false',
            nodeType: 'aggregate',
          });
          return ok(false, warnings);
        }
        let m = rats[0];
        for (let i = 1; i < rats.length; i++) if (rationalCompare(rats[i], m) > 0) m = rats[i];
        return ok(m, warnings);
      }
      default:
        return err(`未知聚合函数 ${fn}`, warnings);
    }
  }

  /** 将数组元素统一转为有理数；遇非数值（含 string，§11.2 严格类型）返回 null 并记警告 */
  private toRationalArray(arr: unknown[], fn: string, warnings: EvalWarning[]): Rational[] | null {
    const rats: Rational[] = [];
    for (const v of arr) {
      const r = this.toRational(v);
      if (r === null) {
        warnings.push({
          kind: 'type_mismatch',
          message: `${fn} 数组含非数值元素：${typeof v}`,
          nodeType: 'aggregate',
        });
        return null;
      }
      rats.push(r);
    }
    return rats;
  }
}

/** 单例 */
export const exprTreeEvaluator = new ExprTreeEvaluator();
