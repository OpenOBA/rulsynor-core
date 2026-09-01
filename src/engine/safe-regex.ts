/**
 * SafeRegExp — ReDoS-protected regex construction.
 *
 * All pattern-based rule conditions (match, matches operators) MUST use
 * safeRegExp() instead of bare `new RegExp()`. This prevents:
 *   1. ReDoS (exponential backtracking) via nested quantifier detection
 *   2. ReDoS (polynomial backtracking) via adjacent quantified-atom detection
 *   3. Pattern length overflow via max-length cap
 *   4. Invalid regex crash via try-catch wrapper
 *
 * Cost bound (SPEC v2.0 E4 正则步数 ≤10000 的工程等价物）：
 * JS RegExp 无步数计数原语，本模块以「模式静态分析 + 输入长度上限」约束
 * 最坏执行成本。safeTest() 对超限输入截断后再匹配，保证单规则求值有界。
 *
 * 注意：静态检测为启发式缓解，非完备 ReDoS 证明。
 */

const REGEX_MAX_LENGTH = 200;
/** 正则匹配输入长度上限：约束最坏回溯成本（E4 工程等价） */
export const REGEX_MAX_INPUT_LENGTH = 10_000;

// Detect nested quantifiers: (a+)+, (a+)*, (a+)+?, (a*)*, (a+){1,10}, etc.
// Matches: ) followed by optional whitespace then another quantifier
// Quantifier after ) means nested: )+, )*, )?, ){n,m}
// The { must be followed by a digit to be a regex quantifier —
// plain { } blocks (e.g. fork bomb :(){ :|:& };:) are not quantifiers.
const NESTED_QUANTIFIER = /\)\s*([+*?]|\{\d)/;

// S2 加固：相邻量词原子检测（a*a*、.*.*、\w+\w+、[a-z]+[a-z]+ 等多维回溯风险）。
// 仅当两个相邻原子相同、或任一为通配 '.' 时判定为危险（\w+\d+ 等异类相邻允许）。
const ADJACENT_QUANTIFIED_ATOMS =
  /(\\[wdsWDS]|\[[^\]]*\]|\.|[A-Za-z0-9])([+*]|\{\d+(?:,\d*)?\})(\\[wdsWDS]|\[[^\]]*\]|\.|[A-Za-z0-9])([+*]|\{\d)/g;

export class SafeRegExpError extends Error {
  constructor(message: string) {
    super(`SafeRegExp: ${message}`);
    this.name = 'SafeRegExpError';
  }
}

/**
 * 静态分析正则模式的安全性。返回 null 表示通过，否则返回拒绝原因。
 * 统一出口：safeRegExp() 与规则加载期质量门禁共用，
 * 保证「加载期拦截」与「运行时构造」判定一致。
 */
export function analyzePattern(pattern: string): string | null {
  if (typeof pattern !== 'string') {
    return `pattern must be a string, got ${typeof pattern}`;
  }

  if (pattern.length > REGEX_MAX_LENGTH) {
    return `pattern exceeds ${REGEX_MAX_LENGTH} chars (got ${pattern.length})`;
  }

  if (NESTED_QUANTIFIER.test(pattern)) {
    return 'potential ReDoS pattern rejected: nested quantifiers detected';
  }

  ADJACENT_QUANTIFIED_ATOMS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ADJACENT_QUANTIFIED_ATOMS.exec(pattern)) !== null) {
    const [, atom1, , atom2] = m;
    if (atom1 === atom2 || atom1 === '.' || atom2 === '.') {
      return `potential ReDoS pattern rejected: adjacent quantified atoms (${atom1}…${atom2})`;
    }
  }

  return null;
}

export function safeRegExp(pattern: string, flags?: string): RegExp {
  const rejection = analyzePattern(pattern);
  if (rejection) {
    throw new SafeRegExpError(rejection);
  }

  try {
    return new RegExp(pattern, flags);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SafeRegExpError(`invalid pattern "${pattern}": ${msg}`);
  }
}

/**
 * 有界正则匹配：输入超过 maxInputLength 时截断后再匹配（E4 成本上限的工程等价）。
 * 调用方语义为「条件是否命中」——截断只限制匹配窗口，不改变 fail-close 方向：
 * 匹配类规则未命中 → 条件 false → 规则不触发，与既有空值传播语义一致。
 */
export function safeTest(
  re: RegExp,
  input: string,
  maxInputLength: number = REGEX_MAX_INPUT_LENGTH,
): boolean {
  const bounded = input.length > maxInputLength ? input.slice(0, maxInputLength) : input;
  return re.test(bounded);
}
