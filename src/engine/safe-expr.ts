/**
 * SafeExpr — 安全表达式引擎
 *
 * 纯递归下降评估器，零代码注入风险。
 * 替代 expr-eval，所有操作均在白名单 operator 集合内执行。
 *
 * ATCF Phase 0 核心模块。
 */

import { SafeExpr, RuleCondition } from './types.js';

/**
 * SafeExprEvaluator — 在上下文中评估 SafeExpr AST
 */
export class SafeExprEvaluator {
  /**
   * 评估 SafeExpr，返回 boolean 结果
   * @param expr SafeExpr AST 节点
   * @param context 运行时上下文（字段名 → 值）
   * @throws 当字段在 context 中不存在时抛出明确错误
   * @throws 当 operator 未知时抛出错误
   * @throws 当类型不匹配时（如 gt 用于 string）抛出错误
   */
  evaluate(expr: SafeExpr, context: Record<string, unknown>): boolean {
    const { type, args } = expr;

    switch (type) {
      case 'eq':
        return this.evalEq(args, context);
      case 'ne':
        return this.evalNe(args, context);
      case 'gt':
        return this.evalGt(args, context);
      case 'gte':
        return this.evalGte(args, context);
      case 'lt':
        return this.evalLt(args, context);
      case 'lte':
        return this.evalLte(args, context);
      case 'in':
        return this.evalIn(args, context);
      case 'not_in':
        return this.evalNotIn(args, context);
      case 'contains':
        return this.evalContains(args, context);
      case 'match':
        return this.evalMatch(args, context);
      case 'exists':
        return this.evalExists(args, context);
      case 'starts_with':
        return this.evalStartsWith(args, context);
      case 'ends_with':
        return this.evalEndsWith(args, context);
      case 'and':
        return this.evalAnd(args, context);
      case 'or':
        return this.evalOr(args, context);
      case 'not':
        return this.evalNot(args, context);
      default:
        throw new Error(`SafeExprEvaluator: unknown operator '${type}'`);
    }
  }

  // ─── 比较操作符 ───────────────────────────────────────────────

  private evalEq(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    return left === right;
  }

  private evalNe(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    return left !== right;
  }

  private evalGt(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveNumericArgs(args, context, 'gt');
    return left > right;
  }

  private evalGte(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveNumericArgs(args, context, 'gte');
    return left >= right;
  }

  private evalLt(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveNumericArgs(args, context, 'lt');
    return left < right;
  }

  private evalLte(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveNumericArgs(args, context, 'lte');
    return left <= right;
  }

  // ─── 集合操作符 ───────────────────────────────────────────────

  private evalIn(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (!Array.isArray(right)) {
      throw new Error(`SafeExprEvaluator: 'in' operator requires array as right operand, got ${typeof right}`);
    }
    return right.includes(left);
  }

  private evalNotIn(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (!Array.isArray(right)) {
      throw new Error(`SafeExprEvaluator: 'not_in' operator requires array as right operand, got ${typeof right}`);
    }
    return !right.includes(left);
  }

  private evalContains(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (typeof left !== 'string') {
      throw new Error(`SafeExprEvaluator: 'contains' operator requires string as left operand, got ${typeof left}`);
    }
    if (typeof right !== 'string') {
      throw new Error(`SafeExprEvaluator: 'contains' operator requires string as right operand, got ${typeof right}`);
    }
    return left.includes(right);
  }

  // ─── 字符串操作符 ─────────────────────────────────────────────

  private evalMatch(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (typeof left !== 'string') {
      throw new Error(`SafeExprEvaluator: 'match' operator requires string as left operand, got ${typeof left}`);
    }
    if (typeof right !== 'string') {
      throw new Error(`SafeExprEvaluator: 'match' operator requires string pattern as right operand, got ${typeof right}`);
    }
    const regex = new RegExp(right);
    return regex.test(left);
  }

  private evalStartsWith(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (typeof left !== 'string') {
      throw new Error(`SafeExprEvaluator: 'starts_with' operator requires string as left operand, got ${typeof left}`);
    }
    if (typeof right !== 'string') {
      throw new Error(`SafeExprEvaluator: 'starts_with' operator requires string as right operand, got ${typeof right}`);
    }
    return left.startsWith(right);
  }

  private evalEndsWith(args: unknown[], context: Record<string, unknown>): boolean {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (typeof left !== 'string') {
      throw new Error(`SafeExprEvaluator: 'ends_with' operator requires string as left operand, got ${typeof left}`);
    }
    if (typeof right !== 'string') {
      throw new Error(`SafeExprEvaluator: 'ends_with' operator requires string as right operand, got ${typeof right}`);
    }
    return left.endsWith(right);
  }

  // ─── 存在性检查 ───────────────────────────────────────────────

  private evalExists(args: unknown[], context: Record<string, unknown>): boolean {
    if (args.length < 1) {
      throw new Error(`SafeExprEvaluator: 'exists' operator requires at least 1 argument`);
    }
    const field = args[0];
    if (typeof field !== 'string') {
      throw new Error(`SafeExprEvaluator: 'exists' operator requires string field name, got ${typeof field}`);
    }
    return field in context && context[field] !== null && context[field] !== undefined;
  }

  // ─── 逻辑操作符 ───────────────────────────────────────────────

  private evalAnd(args: unknown[], context: Record<string, unknown>): boolean {
    if (args.length < 2) {
      throw new Error(`SafeExprEvaluator: 'and' operator requires at least 2 arguments`);
    }
    for (const arg of args) {
      if (!this.evaluate(arg as SafeExpr, context)) {
        return false;
      }
    }
    return true;
  }

  private evalOr(args: unknown[], context: Record<string, unknown>): boolean {
    if (args.length < 2) {
      throw new Error(`SafeExprEvaluator: 'or' operator requires at least 2 arguments`);
    }
    for (const arg of args) {
      if (this.evaluate(arg as SafeExpr, context)) {
        return true;
      }
    }
    return false;
  }

  private evalNot(args: unknown[], context: Record<string, unknown>): boolean {
    if (args.length < 1) {
      throw new Error(`SafeExprEvaluator: 'not' operator requires at least 1 argument`);
    }
    return !this.evaluate(args[0] as SafeExpr, context);
  }

  // ─── 辅助方法 ─────────────────────────────────────────────────

  /**
   * 解析二元操作符的参数：第一个参数为字段名（从 context 取值），第二个为字面量
   */
  private resolveBinaryArgs(args: unknown[], context: Record<string, unknown>): [unknown, unknown] {
    if (args.length < 2) {
      throw new Error(`SafeExprEvaluator: binary operator requires at least 2 arguments, got ${args.length}`);
    }
    const field = args[0];
    if (typeof field !== 'string') {
      throw new Error(`SafeExprEvaluator: first argument must be a field name (string), got ${typeof field}`);
    }
    if (!(field in context)) {
      throw new Error(`SafeExprEvaluator: field '${field}' not found in context`);
    }
    const value = context[field];
    return [value, args[1]];
  }

  /**
   * 解析数值比较操作符的参数：验证两侧均为 number
   */
  private resolveNumericArgs(
    args: unknown[],
    context: Record<string, unknown>,
    op: string
  ): [number, number] {
    const [left, right] = this.resolveBinaryArgs(args, context);
    if (typeof left !== 'number') {
      throw new Error(`SafeExprEvaluator: '${op}' operator requires number as left operand, got ${typeof left}`);
    }
    if (typeof right !== 'number') {
      throw new Error(`SafeExprEvaluator: '${op}' operator requires number as right operand, got ${typeof right}`);
    }
    return [left, right];
  }
}

/**
 * 从 RuleCondition 构建 SafeExpr AST 节点
 *
 * @param condition RuleCondition（来自 ERDL 规则定义）
 * @returns SafeExpr AST 节点
 */
export function safeExprFromCondition(condition: RuleCondition): SafeExpr {
  const { field, operator, value } = condition;

  // exists 操作符只需要 field，不需要 value
  if (operator === 'exists') {
    return {
      type: 'exists',
      args: [field],
    };
  }

  // 其他操作符需要 field + value
  if (value === undefined) {
    throw new Error(`safeExprFromCondition: operator '${operator}' requires a value, but none provided`);
  }

  return {
    type: operator,
    args: [field, value],
  };
}
