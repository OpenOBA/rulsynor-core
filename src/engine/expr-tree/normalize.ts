/**
 * normalize — string NFC normalization (SPEC v2.0 §10 E10)
 *
 * String literals, before entering the canonical tree / hash, uniformly apply Unicode NFC
 * normalization, ensuring that "visually identical but different code points" strings
 * (e.g. é vs e + combining mark) produce the same byte sequence.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

/** NFC-normalize a string (JS built-in normalize('NFC')) */
export function normalizeNfc(input: string): string {
  return input.normalize('NFC');
}

/** Recursively normalize all string values in an object (for literal normalization) */
export function normalizeStringValue(value: unknown): unknown {
  if (typeof value === 'string') return normalizeNfc(value);
  if (Array.isArray(value)) return value.map(normalizeStringValue);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeStringValue(v);
    }
    return out;
  }
  return value;
}
