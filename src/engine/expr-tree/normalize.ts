/**
 * normalize — 字符串 NFC 规范化（SPEC v2.0 §10 E10）
 *
 * 字符串字面量在进入规范化树 / 哈希前，统一做 Unicode NFC 规范化，
 * 保证"视觉相同、码点不同"的字符串（如 é vs e+组合符）产生相同字节序列。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

/** NFC 规范化字符串（JS 内置 normalize('NFC')） */
export function normalizeNfc(input: string): string {
  return input.normalize('NFC')
}

/** 递归规范化对象中所有字符串值（用于字面量规范化） */
export function normalizeStringValue(value: unknown): unknown {
  if (typeof value === 'string') return normalizeNfc(value)
  if (Array.isArray(value)) return value.map(normalizeStringValue)
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeStringValue(v)
    }
    return out
  }
  return value
}
