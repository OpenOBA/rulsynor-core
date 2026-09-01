/**
 * FixedPoint — 严格定点小数有理数运算（SPEC v2.0 §10 E2 / §10.4(b)）
 *
 * 约束（严格实现，不留坑）：
 * - 中间计算用【高精度有界有理数】（bigint 分子/分母），不做舍入
 *   → 避免多步运算累积舍入误差，满足 §10.3 跨实现逐字节一致哈希
 * - 仅【输出节点】按 scale=14 + half-even（银行家舍入，IEEE 754-2019 ROUND_HALF_EVEN）
 *   舍入为字符串序列化
 *
 * 有理数表示：{ num: bigint, den: bigint }，den > 0，恒为最简（gcd 归约）。
 * 所有运算返回规范化有理数；`toDecimalString()` 是唯一的舍入出口。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

export const DECIMAL_SCALE = 14

/** 有理数（分子/分母，分母恒正，恒最简） */
export interface Rational {
  num: bigint
  den: bigint
}

export class FixedPointError extends Error {
  constructor(message: string) {
    super(`[FixedPoint] ${message}`)
    this.name = 'FixedPointError'
  }
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b !== 0n) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

/** 规范化有理数：分母恒正 + gcd 归约 */
function normalize(num: bigint, den: bigint): Rational {
  if (den === 0n) throw new FixedPointError('Division by zero')
  if (den < 0n) {
    num = -num
    den = -den
  }
  const g = gcd(num, den)
  if (g > 1n) {
    num /= g
    den /= g
  }
  return { num, den }
}

/** 从整数构造有理数 */
export function fromInt(n: number | bigint | string): Rational {
  const big = typeof n === 'bigint' ? n : BigInt(String(n))
  return { num: big, den: 1n }
}

/** 从十进制字符串构造有理数（如 "0.15" → 15/100 → 3/20） */
export function fromDecimalString(s: string): Rational {
  const str = s.trim()
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new FixedPointError(`非法十进制字面量: ${s}`)
  const neg = str.startsWith('-')
  const abs = neg ? str.slice(1) : str
  const [intPart, fracPart = ''] = abs.split('.')
  const scale = fracPart.length
  const den = 10n ** BigInt(scale)
  const num = BigInt(intPart || '0') * den + BigInt(fracPart || '0')
  return normalize(neg ? -num : num, den)
}

/**
 * 将 JS number 的 String() 输出中的科学计数法展开为普通十进制字符串。
 * String(1e-7) === "1e-7"、String(1e21) === "1e+21"，fromDecimalString 不接受该格式。
 * 展开后保持 String(v) 的最短往返十进制语义（确定性、跨实现一致）。
 */
function expandExponential(s: string): string {
  if (!/[eE]/.test(s)) return s
  const [mantissa, expStr] = s.split(/[eE]/)
  const exp = parseInt(expStr, 10)
  if (!Number.isFinite(exp)) throw new FixedPointError(`非法指数: ${s}`)
  const neg = mantissa.startsWith('-')
  const m = neg ? mantissa.slice(1) : mantissa
  const [intPart, fracPart = ''] = m.split('.')
  const digits = intPart + fracPart
  const pointPos = intPart.length + exp
  let out: string
  if (pointPos <= 0) out = '0.' + '0'.repeat(-pointPos) + digits
  else if (pointPos >= digits.length) out = digits + '0'.repeat(pointPos - digits.length)
  else out = digits.slice(0, pointPos) + '.' + digits.slice(pointPos)
  return (neg ? '-' : '') + out
}

/**
 * 从 JS number 构造有理数（运行时上下文入口，E12 fail-close 语义由调用方处理）。
 * 非有限值（NaN/±Infinity）抛 FixedPointError。
 */
export function fromNumber(v: number): Rational {
  if (!Number.isFinite(v)) throw new FixedPointError(`非有限数值: ${v}`)
  return fromDecimalString(expandExponential(String(v)))
}

export function add(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den + b.num * a.den, a.den * b.den)
}
export function sub(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den - b.num * a.den, a.den * b.den)
}
export function mul(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.num, a.den * b.den)
}
export function div(a: Rational, b: Rational): Rational {
  return normalize(a.num * b.den, a.den * b.num)
}
export function neg(a: Rational): Rational {
  return { num: -a.num, den: a.den }
}

/** 比较：-1/0/1 */
export function compare(a: Rational, b: Rational): number {
  const lhs = a.num * b.den
  const rhs = b.num * a.den
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0
}

/**
 * scale=14 + half-even 舍入为十进制字符串。
 * 这是唯一的舍入出口——中间计算一律保持有理数，不在此前舍入。
 */
export function toDecimalString(r: Rational, scale: number = DECIMAL_SCALE): string {
  const pow = 10n ** BigInt(scale)
  const { num, den } = r
  const neg = num < 0n
  const absNum = neg ? -num : num

  // 整数部分 + 余数
  const intPart = absNum / den
  const remainder = absNum % den

  // 目标：remainder / den 的前 scale 位小数 + 第 scale+1 位用于舍入判断
  // scaled = floor(remainder * 10^(scale+1) / den)
  const scaled = (remainder * pow * 10n) / den
  const kept = scaled / 10n          // 前 scale 位
  const nextDigit = Number(scaled % 10n) // 第 scale+1 位（0-9）

  // 判断是否有剩余尾数（nextDigit 之后还有非零）
  const afterNext = (remainder * pow * 10n) % den
  const hasRest = afterNext !== 0n

  // half-even 的"最后保留位"：scale>0 时看 kept 末位，scale=0 时看整数部分 intPart 末位
  const lastKeptDigit = Number(scale > 0 ? (kept % 10n) : (intPart % 10n))

  let rounded = kept
  if (nextDigit > 5) {
    rounded += 1n
  } else if (nextDigit === 5 && (hasRest || lastKeptDigit % 2 === 1)) {
    // half-even：尾数非零 或 保留位为奇数 → 进一
    rounded += 1n
  }

  // 若舍入导致整数部分进位（如 0.999... → 1.000...）
  let intStr = intPart.toString()
  let fracStr = rounded.toString().padStart(scale, '0')
  if (rounded >= pow) {
    intStr = (intPart + 1n).toString()
    fracStr = (rounded - pow).toString().padStart(scale, '0')
  }

  // 去掉尾部多余的 0——按 SPEC §28.2 最小规范表示：整数不带小数点，小数去尾零
  const trimmed = scale > 0 ? `${fracStr}`.replace(/0+$/, '') : ''
  const out = scale > 0 ? (trimmed === '' ? intStr : `${intStr}.${trimmed}`) : intStr
  return (neg ? '-' : '') + out
}

/** 求值有理数是否为整数（分母==1） */
export function isInteger(r: Rational): boolean {
  return r.den === 1n
}

/** 有理数转 number（仅用于需要与 JS 互操作的边界，不用于规则求值） */
export function toNumber(r: Rational): number {
  return Number(r.num) / Number(r.den)
}
