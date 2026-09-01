/**
 * eval-trace — 求值溯源链（SPEC v2.0 §17，E6「树即证据」）
 *
 * 表达层的求值是「树即证据」：每个派生值一条 DerivationRecord，构成可独立重算的溯源链；
 * eval_trace 是节点级推理链，Expression MUST、Simple SHOULD，记入决策对象。
 *
 * DerivationRecord 字段（SPEC §17）：
 * - 节点标识（node type + 位置）
 * - 语义规范哈希（节点在其规范形式下的哈希）
 * - 上下文快照哈希（求值时的上下文快照，非引用）
 * - 输入值快照（非引用，undefined 输入区分）
 * - 输出与判定
 *
 * gloss（G4）与 eval_trace 共同构成决策对象的两面：人读 gloss 判对错，算校验 eval_trace 证真伪。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

import { createHash } from 'node:crypto';
import type { ExprNode } from './node-types.js';
import { canonicalTree } from './canonical.js';

/** 单条派生记录（DerivationRecord） */
export interface DerivationRecord {
  /** 节点类型 */
  nodeType: string;
  /** 节点在树中的位置（人类可读定位辅助；节点唯一标识由 nodeHash 保证） */
  path: string;
  /** 节点规范形式的哈希（语义规范哈希，即节点标识） */
  nodeHash: string;
  /** 上下文快照哈希（求值时 context 的非引用快照哈希，供独立重算校验） */
  contextHash: string;
  /** 输入值快照（非引用，undefined/缺失区分；叶子节点记录 resolve 值，组合节点留空由调用方填充） */
  inputValues: Array<{ type: string; value: unknown; absent: boolean }>;
  /** 输出值 */
  output: unknown;
  /** 判定结果（boolean 或值） */
  verdict: unknown;
  /** 求值警告（若有） */
  warnings?: string[];
}

/** 完整 eval_trace */
export interface EvalTrace {
  /** 根节点哈希 */
  rootHash: string;
  /** 逐节点的派生记录 */
  records: DerivationRecord[];
  /** 最终结果 */
  finalValue: unknown;
}

/** 值快照：安全序列化（undefine/null 区分，非引用） */
function snapshot(value: unknown): { type: string; value: unknown; absent: boolean } {
  if (value === undefined) return { type: 'undefined', value: null, absent: true };
  if (value === null) return { type: 'null', value: null, absent: false };
  const t = typeof value;
  if (t === 'bigint') {
    // 裸 bigint（非 Rational）防御性转字符串，避免 JSON 序列化崩溃
    return { type: 'bigint', value: String(value), absent: false };
  }
  if (
    t === 'object' &&
    value !== null &&
    typeof (value as { num?: unknown }).num === 'bigint' &&
    typeof (value as { den?: unknown }).den === 'bigint'
  ) {
    // Rational 对象快照
    return {
      type: 'rational',
      value: `${(value as { num: bigint }).num}/${(value as { den: bigint }).den}`,
      absent: false,
    };
  }
  if (t === 'object') {
    // 对象快照（JSON 序列化，非引用）
    try {
      return { type: 'object', value: JSON.parse(JSON.stringify(value)), absent: false };
    } catch {
      return { type: 'object', value: '[unserializable]', absent: false };
    }
  }
  return { type: t, value, absent: false };
}

/** 节点规范哈希（用于语义规范哈希） */
export function hashNodeCanonical(node: ExprNode): string {
  return createHash('sha256').update(canonicalTree(node)).digest('hex');
}

/** 空 trace */
export function emptyTrace(): EvalTrace {
  return { rootHash: '', records: [], finalValue: null };
}

// ═══════════════════════════════════════════
// TraceCollector — 求值过程中收集 DerivationRecord
// ═══════════════════════════════════════════

/** 求值器在递归过程中调用的 trace 收集器 */
export class TraceCollector {
  private readonly records: DerivationRecord[] = [];
  private contextHash: string = '';

  /** 设置上下文快照哈希（求值开始时调用一次） */
  setContextHash(hash: string): void {
    this.contextHash = hash;
  }

  /** 记录一条派生记录 */
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

  /** 产出完整 EvalTrace */
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
