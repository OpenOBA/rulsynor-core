/**
 * eval-trace — evaluation provenance chain (SPEC v2.0 §17, E6 "tree as evidence")
 *
 * Expression-layer evaluation is "tree as evidence": every derived value gets one
 * DerivationRecord, forming an independently recomputable provenance chain;
 * eval_trace is the node-level reasoning chain — Expression MUST, Simple SHOULD — recorded
 * into the decision object.
 *
 * DerivationRecord fields (SPEC §17):
 * - node identifier (node type + position)
 * - semantic canonical hash (the node's hash in its canonical form)
 * - context snapshot hash (a snapshot of the evaluation context, not a reference)
 * - input value snapshot (non-reference, undefined inputs distinguished)
 * - output and verdict
 *
 * gloss (G4) and eval_trace together form the two faces of the decision object: the
 * human-readable gloss judges correctness, the machine-verified eval_trace proves authenticity.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-15
 * @license BSL 1.1
 */

import { createHash } from 'node:crypto';
import type { ExprNode } from './node-types.js';
import { canonicalTree } from './canonical.js';

/** A single derivation record (DerivationRecord) */
export interface DerivationRecord {
  /** Node type */
  nodeType: string;
  /** Node position in the tree (human-readable location aid; node uniqueness is guaranteed by nodeHash) */
  path: string;
  /** Hash of the node's canonical form (semantic canonical hash, i.e. the node identifier) */
  nodeHash: string;
  /** Context snapshot hash (non-reference snapshot hash of the evaluation context, for independent recompute verification) */
  contextHash: string;
  /** Input value snapshot (non-reference; undefined/missing distinguished; leaf nodes record the resolve value, composite nodes left empty and filled by the caller) */
  inputValues: Array<{ type: string; value: unknown; absent: boolean }>;
  /** Output value */
  output: unknown;
  /** Verdict (boolean or value) */
  verdict: unknown;
  /** Evaluation warnings (if any) */
  warnings?: string[];
}

/** Complete eval_trace */
export interface EvalTrace {
  /** Root node hash */
  rootHash: string;
  /** Per-node derivation records */
  records: DerivationRecord[];
  /** Final result */
  finalValue: unknown;
}

/** Value snapshot: safe serialization (undefined/null distinguished, non-reference) */
function snapshot(value: unknown): { type: string; value: unknown; absent: boolean } {
  if (value === undefined) return { type: 'undefined', value: null, absent: true };
  if (value === null) return { type: 'null', value: null, absent: false };
  const t = typeof value;
  if (t === 'bigint') {
    // Bare bigint (non-Rational): defensively convert to string to avoid JSON serialization crashes
    return { type: 'bigint', value: String(value), absent: false };
  }
  if (
    t === 'object' &&
    value !== null &&
    typeof (value as { num?: unknown }).num === 'bigint' &&
    typeof (value as { den?: unknown }).den === 'bigint'
  ) {
    // Rational object snapshot
    return {
      type: 'rational',
      value: `${(value as { num: bigint }).num}/${(value as { den: bigint }).den}`,
      absent: false,
    };
  }
  if (t === 'object') {
    // Object snapshot (JSON serialization, non-reference)
    try {
      return { type: 'object', value: JSON.parse(JSON.stringify(value)), absent: false };
    } catch {
      return { type: 'object', value: '[unserializable]', absent: false };
    }
  }
  return { type: t, value, absent: false };
}

/** Node canonical hash (used as the semantic canonical hash) */
export function hashNodeCanonical(node: ExprNode): string {
  return createHash('sha256').update(canonicalTree(node)).digest('hex');
}

/** Empty trace */
export function emptyTrace(): EvalTrace {
  return { rootHash: '', records: [], finalValue: null };
}

// ═══════════════════════════════════════════
// TraceCollector — collects DerivationRecords during evaluation
// ═══════════════════════════════════════════

/** Trace collector called by the evaluator during recursion */
export class TraceCollector {
  private readonly records: DerivationRecord[] = [];
  private contextHash: string = '';

  /** Set the context snapshot hash (called once at evaluation start) */
  setContextHash(hash: string): void {
    this.contextHash = hash;
  }

  /** Record a derivation record */
  record(
    nodeType: string,
    path: string,
    node: ExprNode,
    inputValues: unknown[],
    output: unknown,
    verdict: unknown,
    warnings?: string[],
  ): void {
    this.records.push({
      nodeType,
      path,
      nodeHash: hashNodeCanonical(node),
      contextHash: this.contextHash,
      inputValues: inputValues.map(v => snapshot(v)),
      output: snapshot(output).value,
      verdict: snapshot(verdict).value,
      ...(warnings && warnings.length > 0 ? { warnings } : {}),
    });
  }

  /** Produce the complete EvalTrace */
  toTrace(root: ExprNode, finalValue: unknown): EvalTrace {
    return {
      rootHash: hashNodeCanonical(root),
      records: this.records,
      finalValue: snapshot(finalValue).value,
    };
  }

  get size(): number {
    return this.records.length;
  }
}
