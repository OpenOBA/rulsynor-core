/**
 * canonical — 规范化表达式树 + 哈希（SPEC v2.0 §10.3 + §28）
 *
 * 哈希对象 = 规范化树（非序列化文本）。规范化规则：
 * - 节点序固定：S-expression 的 children 数组顺序即规范序（构造时已定序）
 * - 字段名承重：field 路径参与哈希，冻结不可改
 * - 字面量规范：number 保持 number（JCS IEEE 754，严格类型与 string 区分），字符串 NFC（E10）；金额/浮点 MUST 用字符串（§28）
 * - var 规范：仅 '$'/'$.path'
 * - 元数据剥离：S-expression 不含元数据（本实现不加），天然满足
 *
 * 哈希算法：JCS（RFC 8785，json-canonicalize）+ SHA-256。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import { createHash } from 'node:crypto'
import { canonicalize } from 'json-canonicalize'
import type { ExprNode } from './node-types.js'
import { toSExpr } from './s-expression.js'
import { normalizeNfc } from './normalize.js'

/** 递归规范化 S-expression 中的字面量值（严格类型：number 保持 number 交 JCS IEEE754，与 string 区分；字符串 NFC） */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeNfc(value)
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeValue(v)
    }
    return out
  }
  // number / boolean / null：原样保留（严格类型，number 与 string 区分）
  return value
}

/** 规范化表达式树 → JCS 字节序列 */
export function canonicalTree(node: ExprNode): string {
  const sexpr = toSExpr(node)
  const normalized = normalizeValue(sexpr)
  return canonicalize(normalized as Record<string, unknown>)
}

/** 规范化表达式树哈希（SHA-256） */
export function hashTree(node: ExprNode): string {
  const canonical = canonicalTree(node)
  return createHash('sha256').update(canonical).digest('hex')
}

/** 返回带前缀的哈希（与 GuardService 的 'sha256:' 前缀一致） */
export function hashTreeWithPrefix(node: ExprNode): string {
  return `sha256:${hashTree(node)}`
}
