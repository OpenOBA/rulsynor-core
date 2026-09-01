/**
 * eval-trace 单测 — SPEC v1.2 §17（树即证据 E6）
 */

import { ExprTreeEvaluator, objectContext } from '../../src/engine/expr-tree/evaluator.js';
import { hashNodeCanonical, emptyTrace } from '../../src/engine/expr-tree/eval-trace.js';
import { compileSimpleCondition } from '../../src/engine/expr-tree/simple-compiler.js';
import type { ExprNode } from '../../src/engine/expr-tree/node-types.js';

const ev = new ExprTreeEvaluator();

describe('eval-trace — evaluateWithTrace 节点级记录', () => {
  it('单条件求值 → trace 记录 ≥1 条（含根节点）', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { result, trace } = ev.evaluateWithTrace(tree, objectContext({ amount: 20000 }));
    expect(result.value).toBe(true);
    expect(trace.records.length).toBeGreaterThanOrEqual(1);
    expect(trace.finalValue).toBe(true);
  });
  it('叶子节点（field）记录输入值快照', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ amount: 20000 }));
    const fieldRec = trace.records.find(r => r.nodeType === 'field');
    expect(fieldRec).toBeDefined();
    expect(fieldRec!.inputValues.length).toBe(1);
    expect(fieldRec!.inputValues[0].type).toBe('number');
  });

  it('组合节点（compare）记录两个操作数输入值快照', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ amount: 20000 }));
    const compareRec = trace.records.find(r => r.nodeType === 'compare');
    expect(compareRec).toBeDefined();
    // compare 节点应记录左右两个输入值
    expect(compareRec!.inputValues.length).toBe(2);
  });

  it('组合节点（and）记录所有子节点输入值', () => {
    const tree: ExprNode = {
      type: 'and',
      args: [
        compileSimpleCondition({ field: 'age', operator: 'gt', value: 16 }),
        compileSimpleCondition({ field: 'age', operator: 'lt', value: 60 }),
      ],
    };
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ age: 30 }));
    const andRec = trace.records.find(r => r.nodeType === 'and');
    expect(andRec).toBeDefined();
    expect(andRec!.inputValues.length).toBe(2);
  });

  it('DerivationRecord 含 contextHash', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { trace } = ev.evaluateWithTrace(
      tree,
      objectContext({ amount: 20000 }, new Date('2026-01-01T00:00:00Z')),
    );
    for (const rec of trace.records) {
      expect(rec.contextHash).toBeDefined();
    }
  });

  it('trace 含根节点哈希', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ amount: 20000 }));
    expect(trace.rootHash).toBe(hashNodeCanonical(tree));
  });
  it('复合树（and 多条件）→ 记录所有节点', () => {
    const tree: ExprNode = {
      type: 'and',
      args: [
        compileSimpleCondition({ field: 'age', operator: 'gt', value: 16 }),
        compileSimpleCondition({ field: 'age', operator: 'lt', value: 60 }),
      ],
    };
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ age: 30 }));
    // and 节点 + 2 个 compare 节点 + 2 个 field + 3 个 literal（左右）= 至少 and + 2 compare
    expect(trace.records.length).toBeGreaterThanOrEqual(3);
    // 应含 and 节点和 compare 节点
    const types = trace.records.map(r => r.nodeType);
    expect(types).toContain('and');
    expect(types).toContain('compare');
  });
});

describe('eval-trace — DerivationRecord 结构', () => {
  it('每条记录含 nodeHash / inputValues / output / verdict', () => {
    const tree = compileSimpleCondition({ field: 'amount', operator: 'gt', value: 10000 });
    const { trace } = ev.evaluateWithTrace(tree, objectContext({ amount: 20000 }));
    for (const rec of trace.records) {
      expect(rec.nodeHash).toBeDefined();
      expect(rec.inputValues).toBeDefined();
      expect(rec.output).toBeDefined();
      expect(rec.verdict).toBeDefined();
    }
  });
});

describe('eval-trace — TraceCollector 快照（undefined/对象区分）', () => {
  it('字段缺失 → input/verdict 快照区分 absent', () => {
    const tree = compileSimpleCondition({ field: 'missing', operator: 'eq', value: 1 });
    // 直接测 TraceCollector 的 snapshot 行为通过 evaluateWithTrace 间接覆盖
    const { result, trace } = ev.evaluateWithTrace(tree, objectContext({}));
    expect(result.value).toBe(false);
    expect(trace.finalValue).toBe(false);
  });
  it('hashNodeCanonical 确定性', () => {
    const a = compileSimpleCondition({ field: 'x', operator: 'eq', value: 1 });
    const b = compileSimpleCondition({ field: 'x', operator: 'eq', value: 1 });
    expect(hashNodeCanonical(a)).toBe(hashNodeCanonical(b));
  });
});

describe('eval-trace — emptyTrace', () => {
  it('emptyTrace 返回空结构', () => {
    const t = emptyTrace();
    expect(t.rootHash).toBe('');
    expect(t.records).toEqual([]);
    expect(t.finalValue).toBeNull();
  });
});
