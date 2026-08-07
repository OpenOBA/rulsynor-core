/**
 * RuntimeEvaluator — 运行时 operator 求值器（Phase 0 三层拆分）
 *
 * 将 Evaluator.matchCondition() 中的 operator switch-case
 * 提取为独立模块，便于单独测试和后续 Phase 1 编译优化。
 *
 * 确定性：纯函数，相同输入 → 相同输出。零 I/O。
 */

import { MatchCondition, EvalContext } from './evaluator.js';
import { safeRegExp } from './safe-regex.js';

/** 评估单个 operator 条件 */
export function evaluateCondition(
  condition: MatchCondition,
  context: EvalContext,
): boolean {
  const fieldValue = resolveField(condition.field, context);
  const { operator, value } = condition;

  // SPEC §6.1: 空值传播 — 字段缺失时，除 exists/not_exists 外，所有比较返回 false
  // 注意: 字段缺失 ≠ 值为 null。eq null 在字段缺失时不触发，防止意外 DENY。
  const isAbsent = fieldValue === undefined || fieldValue === null;
  if (isAbsent) {
    if (operator === 'exists') return false;
    if (operator === 'not_exists') return true;
    // All other comparisons with absent field → false (safe default)
    // This prevents accidental DENY when a field is missing due to a typo or race condition
    return false;
  }

  switch (operator) {
    case 'eq':
      return deepEquals(fieldValue, value);

    case 'ne':
    case 'neq':
      return !deepEquals(fieldValue, value);

    case 'gt':
      return typeof fieldValue === 'number' && typeof value === 'number'
        ? fieldValue > value
        : false;

    case 'gte':
      return typeof fieldValue === 'number' && typeof value === 'number'
        ? fieldValue >= value
        : false;

    case 'lt':
      return typeof fieldValue === 'number' && typeof value === 'number'
        ? fieldValue < value
        : false;

    case 'lte':
      return typeof fieldValue === 'number' && typeof value === 'number'
        ? fieldValue <= value
        : false;

    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);

    case 'not_in':
      return Array.isArray(value) && !value.includes(fieldValue);

    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string'
        ? fieldValue.includes(value)
        : false;

    case 'match':
    case 'matches':
      if (typeof fieldValue !== 'string' || typeof value !== 'string') return false;
      try {
        return safeRegExp(value).test(fieldValue);
      } catch {
        return false;
      }

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;

    case 'length_gt':
      return typeof fieldValue === 'string' || Array.isArray(fieldValue)
        ? fieldValue.length > (value as number)
        : false;

    case 'length_gte':
      return typeof fieldValue === 'string' || Array.isArray(fieldValue)
        ? fieldValue.length >= (value as number)
        : false;

    case 'length_lt':
      return typeof fieldValue === 'string' || Array.isArray(fieldValue)
        ? fieldValue.length < (value as number)
        : false;

    case 'length_lte':
      return typeof fieldValue === 'string' || Array.isArray(fieldValue)
        ? fieldValue.length <= (value as number)
        : false;

    case 'length_eq':
      return typeof fieldValue === 'string' || Array.isArray(fieldValue)
        ? fieldValue.length === (value as number)
        : false;

    case 'starts_with':
      return typeof fieldValue === 'string' && typeof value === 'string'
        ? fieldValue.startsWith(value)
        : false;

    case 'ends_with':
      return typeof fieldValue === 'string' && typeof value === 'string'
        ? fieldValue.endsWith(value)
        : false;

    default:
      return false;
  }
}

/**
 * 从上下文解析字段值
 */
function resolveField(field: string, context: EvalContext): unknown {
  let effectiveField = field;
  if (effectiveField.startsWith('context.')) {
    effectiveField = effectiveField.slice(8);
  }

  const parts = effectiveField.split('.');

  if (parts[0] === 'tool' && parts[1] === 'name') {
    return context.toolName;
  }
  if (parts[0] === 'tool' && parts[1] === 'args') {
    const argPath = parts.slice(2).join('.');
    return resolvePath(argPath, context.toolArgs);
  }

  return resolvePath(effectiveField, context as unknown as Record<string, unknown>);
}

function resolvePath(path: string, obj: Record<string, unknown>): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a !== b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEquals(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string,unknown>).sort();
    const keysB = Object.keys(b as Record<string,unknown>).sort();
    if (keysA.length !== keysB.length) return false;
    if (!keysA.every((k, i) => k === keysB[i])) return false;
    const objA = a as Record<string,unknown>;
    const objB = b as Record<string,unknown>;
    return keysA.every(k => deepEquals(objA[k], objB[k]));
  }

  return false;
}
