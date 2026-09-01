/**
 * canonical — canonical expression tree + hash (SPEC v2.0 §10.3 + §28)
 *
 * The hashed object = the canonical tree (not the serialized text). Canonicalization rules:
 * - node order is fixed: the S-expression children array order IS the canonical order (fixed at construction)
 * - field names are load-bearing: the field path enters the hash, frozen and unchangeable
 * - literal canonicalization: number stays number (JCS IEEE 754, strictly typed, distinguished from string), string NFC (E10); monetary/float values MUST use strings (§28)
 * - var canonicalization: only '$'/'$.path'
 * - metadata stripped: S-expressions carry no metadata (this implementation adds none), naturally satisfied
 *
 * Hash algorithm: JCS (RFC 8785, json-canonicalize) + SHA-256.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license MIT
 */

import { createHash } from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import type { ExprNode } from './node-types.js';
import { toSExpr } from './s-expression.js';
import { normalizeNfc } from './normalize.js';

/** Recursively normalize literal values in the S-expression (strict type: number stays number, handled by JCS IEEE754 and distinguished from string; string NFC) */
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeNfc(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeValue(v);
    }
    return out;
  }
  // number / boolean / null: kept as-is (strict type, number distinguished from string)
  return value;
}

/** Canonical expression tree → JCS byte sequence */
export function canonicalTree(node: ExprNode): string {
  const sexpr = toSExpr(node);
  const normalized = normalizeValue(sexpr);
  return canonicalize(normalized as Record<string, unknown>);
}

/** Canonical expression-tree hash (SHA-256) */
export function hashTree(node: ExprNode): string {
  const canonical = canonicalTree(node);
  return createHash('sha256').update(canonical).digest('hex');
}

/** Return the hash with a prefix (consistent with GuardService's 'sha256:' prefix) */
export function hashTreeWithPrefix(node: ExprNode): string {
  return `sha256:${hashTree(node)}`;
}
