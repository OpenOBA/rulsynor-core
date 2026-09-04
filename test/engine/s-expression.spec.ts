/**
 * s-expression.spec.ts — S-expression 序列化/反序列化（SPEC v2.0 §12）
 * 重点覆盖 fromSExpr 的否定对偶算子、错误路径，以及 isSExprWhen / extractWhenExpr。
 */
import {
  toSExpr,
  fromSExpr,
  roundtrip,
  isSExprWhen,
  extractWhenExpr,
  SExprParseError,
} from '../../src/engine/expr-tree/s-expression.js';

describe('fromSExpr — negation dual operators (not_exists kept, others rejected)', () => {
  it('not_in / not_contains / not_starts_with / not_ends_with throw', () => {
    expect(() => fromSExpr({ not_in: ['x', ['a', 'b']] })).toThrow(SExprParseError);
    expect(() => fromSExpr({ not_contains: ['x', 'y'] })).toThrow(SExprParseError);
    expect(() => fromSExpr({ not_starts_with: ['x', 'y'] })).toThrow(SExprParseError);
    expect(() => fromSExpr({ not_ends_with: ['x', 'y'] })).toThrow(SExprParseError);
  });

  it('not_between throws', () => {
    expect(() => fromSExpr({ not_between: ['x', 1, 5] })).toThrow(SExprParseError);
  });

  it('not_exists stays a lenient alias for not(exists) (spec §5.2 exception)', () => {
    const n = fromSExpr({ not_exists: { field: 'a' } });
    expect(n.type).toBe('not');
    expect((n as { arg: { type: string } }).arg.type).toBe('exists');
  });

  it('canonical { not: { in: [...] } } still parses to a not(in) tree', () => {
    const n = fromSExpr({ not: { in: ['x', ['a', 'b']] } });
    expect(n.type).toBe('not');
    expect((n as { arg: { type: string } }).arg.type).toBe('in');
  });
});

describe('fromSExpr — error paths', () => {
  it('rejects multi-key node', () => {
    expect(() => fromSExpr({ a: 1, b: 2 })).toThrow(SExprParseError);
  });

  it('rejects unknown key', () => {
    expect(() => fromSExpr({ unknown_key: 1 })).toThrow(SExprParseError);
  });

  it('rejects wrong arity for in', () => {
    expect(() => fromSExpr({ in: [1] })).toThrow(SExprParseError);
  });

  it('rejects wrong arity for between', () => {
    expect(() => fromSExpr({ between: [1, 2] })).toThrow(SExprParseError);
  });

  it('rejects unknown date_add unit', () => {
    expect(() => fromSExpr({ date_add: { unit: 'bad', base: 1, amount: 2 } })).toThrow(
      SExprParseError,
    );
  });

  it('rejects unknown date_part unit', () => {
    expect(() => fromSExpr({ date_part: { unit: 'bad', arg: 1 } })).toThrow(SExprParseError);
  });
});

describe('isSExprWhen', () => {
  it('true for pure S-expression tree', () => {
    expect(isSExprWhen({ lt: [{ field: 'amount' }, 100] })).toBe(true);
  });

  it('false for flat conditions structure', () => {
    expect(isSExprWhen({ logic: 'AND', conditions: [] })).toBe(false);
  });

  it('false for null / string / array', () => {
    expect(isSExprWhen(null)).toBe(false);
    expect(isSExprWhen('x')).toBe(false);
    expect(isSExprWhen([1, 2])).toBe(false);
  });

  it('false for when containing expr/decision_table keys', () => {
    expect(isSExprWhen({ expr: { lt: [1, 2] } })).toBe(false);
    expect(isSExprWhen({ decision_table: {} })).toBe(false);
  });
});

describe('extractWhenExpr', () => {
  it('extracts wrapped expr form', () => {
    expect(extractWhenExpr({ expr: { lt: [{ field: 'a' }, 1] } })).toEqual({
      lt: [{ field: 'a' }, 1],
    });
  });

  it('extracts top-level tree form', () => {
    expect(extractWhenExpr({ lt: [{ field: 'a' }, 1] })).toEqual({ lt: [{ field: 'a' }, 1] });
  });

  it('returns null for flat conditions', () => {
    expect(extractWhenExpr({ logic: 'AND', conditions: [] })).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(extractWhenExpr(null)).toBeNull();
    expect(extractWhenExpr(42)).toBeNull();
  });

  it('returns null when wrapped expr is not a valid S-expression', () => {
    expect(extractWhenExpr({ expr: { bad: 1, extra: 2 } })).toBeNull();
  });
});

describe('roundtrip', () => {
  it('field node roundtrips', () => {
    const node = { type: 'field', field: 'tool.name' } as const;
    const rt = roundtrip(node as never);
    expect(rt.type).toBe('field');
  });

  it('compare node roundtrips via toSExpr/fromSExpr', () => {
    const sexpr = toSExpr({
      type: 'compare',
      op: 'gt',
      left: { type: 'field', field: 'amount' },
      right: { type: 'literal', value: 100 },
    } as never);
    expect(sexpr).toEqual({ gt: [{ field: 'amount' }, 100] });
    const back = fromSExpr(sexpr);
    expect(back.type).toBe('compare');
  });
});
