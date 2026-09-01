/**
 * eval-warning — 求值警告（SPEC v2.0 §10 E3）
 *
 * 求值过程中的非致命问题记入 eval_warnings，折叠方向按 E12 分 tier：
 * - tier ≤ 2 / Guard 缺省：fail-close（安全失败）
 * - tier 3-5：折叠为 false
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

export type EvalWarningKind =
  | 'type_mismatch' // 严格类型匹配失败（§11.2）
  | 'division_by_zero' // 除零
  | 'field_absent' // 字段缺失（空值传播）
  | 'quantifier_empty' // 量词空数组安全折叠（E8）
  | 'aggregate_empty' // 聚合空数组安全折叠（§10.4(d)）
  | 'regex_re_dos' // 正则 ReDoS 风险
  | 'array_over_limit' // 数组超上限
  | 'invalid_date' // 日期解析失败
  | 'not_ruleable'; // 无法确定性求值

export interface EvalWarning {
  kind: EvalWarningKind;
  message: string;
  /** 触发警告的节点类型 */
  nodeType?: string;
}

export interface EvalResult {
  /** 求值结果值（number/string/boolean/array/null） */
  value: unknown;
  /** 求值过程中收集的警告 */
  warnings: EvalWarning[];
  /** 是否发生了不可恢复的错误（结构性错误，外部兜底） */
  errored: boolean;
  error?: string;
}

export function ok(value: unknown, warnings: EvalWarning[] = []): EvalResult {
  return { value, warnings, errored: false };
}

export function err(message: string, warnings: EvalWarning[] = []): EvalResult {
  return { value: null, warnings, errored: true, error: message };
}

/** 合并多个子求值结果的警告 */
export function mergeWarnings(...results: EvalResult[]): EvalWarning[] {
  const out: EvalWarning[] = [];
  for (const r of results) {
    out.push(...r.warnings);
  }
  return out;
}
