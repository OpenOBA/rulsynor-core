/**
 * date-utils — 时间运算工具（UTC 语义，替代 date-fns，保零依赖 + 确定性）
 *
 * 对齐 SPEC v2.0 §10.5 时区语义：所有时间节点统一以 UTC 求值，
 * 保证跨实现、跨时区逐字节一致（存储/传输 UTC，业务本地时区由引擎注入 as_of 时转换）。
 *
 * 仅覆盖表达式树求值器所需的 9 个函数：
 *   - addYears / addMonths：UTC 日历运算，月末回退（clamp 到目标月最后一天，处理 2/29 闰年）
 *   - addDays / addHours：UTC 时间戳加减（UTC 日恒 86400000ms、时恒 3600000ms，无 DST）
 *   - getYear / getMonth / getDate / getDay：UTC 分量提取（等价 getUTC*）
 *   - endOfMonth：UTC 该月最后一日（Date.UTC 月末 00:00:00Z）
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-21（M1 移植自实现；随后统一为 UTC 语义对齐 SPEC §10.5）
 * @license MIT
 */

/** 某年某月（month: 0-11）的天数（UTC 日历） */
function daysInMonthUtc(year: number, month: number): number {
  // 下个月第 0 天 = 本月最后一天（UTC）
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** 加 N 年（UTC 日历运算，月末回退：2/29 + 1 年 → 2/28） */
export function addYears(date: Date, amount: number): Date {
  const d = new Date(date.getTime())
  const y = d.getUTCFullYear() + amount
  const m = d.getUTCMonth()
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m))
  d.setUTCFullYear(y, m, day)
  return d
}

/** 加 N 月（UTC 日历运算，月末回退：1/31 + 1 月 → 2/28 或 2/29） */
export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date.getTime())
  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + amount
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths - y * 12
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m))
  d.setUTCFullYear(y, m, day)
  return d
}

/** 加 N 天（UTC 时间戳加减，UTC 日恒 86400000ms） */
export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86400000)
}

/** 加 N 小时（UTC 时间戳加减，UTC 时恒 3600000ms） */
export function addHours(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 3600000)
}

/** 4 位年份（UTC） */
export function getYear(date: Date): number {
  return date.getUTCFullYear()
}

/** 月份（0-11，UTC） */
export function getMonth(date: Date): number {
  return date.getUTCMonth()
}

/** 日期（1-31，UTC） */
export function getDate(date: Date): number {
  return date.getUTCDate()
}

/** 星期（0=周日，6=周六，UTC） */
export function getDay(date: Date): number {
  return date.getUTCDay()
}

/** 该月最后一日（UTC 月末 00:00:00Z） */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}
