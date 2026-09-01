/**
 * normalize.spec.ts — NFC 规范化（SPEC v2.0 §10 E10）
 * 覆盖 normalizeNfc + normalizeStringValue 的字符串/数组/对象/非字符串分支。
 */
import { normalizeNfc, normalizeStringValue } from '../../src/engine/expr-tree/normalize.js';

describe('normalizeNfc', () => {
  it('NFC-composes combining sequences', () => {
    const precomposed = '\u00e9'; // é
    const decomposed = 'e\u0301'; // e + combining acute
    expect(precomposed).not.toBe(decomposed);
    expect(normalizeNfc(decomposed)).toBe(precomposed);
  });

  it('leaves already-normalized ASCII unchanged', () => {
    expect(normalizeNfc('hello world')).toBe('hello world');
  });
});

describe('normalizeStringValue', () => {
  it('normalizes a plain string', () => {
    expect(normalizeStringValue('cafe\u0301')).toBe('caf\u00e9');
  });

  it('normalizes every element in an array', () => {
    const out = normalizeStringValue(['a\u0301', 'plain', 42]);
    expect(out).toEqual(['\u00e1', 'plain', 42]);
  });

  it('recursively normalizes nested objects', () => {
    const out = normalizeStringValue({
      name: 'cafe\u0301',
      nested: { key: 'e\u0301' },
      list: ['a\u0301'],
    });
    expect(out).toEqual({
      name: 'caf\u00e9',
      nested: { key: '\u00e9' },
      list: ['\u00e1'],
    });
  });

  it('preserves non-string values (number/boolean/null)', () => {
    expect(normalizeStringValue(42)).toBe(42);
    expect(normalizeStringValue(true)).toBe(true);
    expect(normalizeStringValue(null)).toBe(null);
  });

  it('preserves undefined', () => {
    expect(normalizeStringValue(undefined)).toBe(undefined);
  });

  it('normalizes values, preserves keys', () => {
    const out = normalizeStringValue({ 'cafe': 'e\u0301' });
    expect(out).toEqual({ 'cafe': '\u00e9' });
  });
});
