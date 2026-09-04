/**
 * safe-regex.test.ts — ReDoS protection unit tests
 */
import {
  safeRegExp,
  safeTest,
  analyzePattern,
  SafeRegExpError,
  REGEX_MAX_INPUT_LENGTH,
} from '../src/engine/safe-regex.js';

describe('safeRegExp', () => {
  describe('valid patterns', () => {
    it('simple pattern', () => {
      const r = safeRegExp('rm\\s+-rf');
      expect(r).toBeInstanceOf(RegExp);
      expect(r.test('rm -rf /')).toBe(true);
      expect(r.test('ls -la')).toBe(false);
    });

    it('anchored pattern', () => {
      expect(safeRegExp('^/etc/').test('/etc/hosts')).toBe(true);
    });

    it('alternation', () => {
      expect(safeRegExp('(a|b|c)').test('b')).toBe(true);
    });

    it('character class', () => {
      expect(safeRegExp('[a-z]+').test('hello')).toBe(true);
    });

    it('with flags', () => {
      expect(safeRegExp('HELLO', 'i').test('hello')).toBe(true);
    });

    it('max-length pattern (200 chars)', () => {
      const p = 'a'.repeat(200);
      expect(() => safeRegExp(p)).not.toThrow();
    });
  });

  describe('ReDoS prevention', () => {
    it('nested quantifier (a+)+', () => {
      expect(() => safeRegExp('(a+)+')).toThrow(SafeRegExpError);
    });

    it('nested quantifier (a*)*', () => {
      expect(() => safeRegExp('(a*)*')).toThrow(SafeRegExpError);
    });

    it('nested quantifier (.*)+', () => {
      expect(() => safeRegExp('(.*)+')).toThrow(SafeRegExpError);
    });

    it('nested quantifier (a+)+?', () => {
      expect(() => safeRegExp('(a+)+?')).toThrow(SafeRegExpError);
    });

    it('nested braces {1,10}{1,10}', () => {
      expect(() => safeRegExp('a{1,10}{1,10}')).toThrow(SafeRegExpError);
    });

    it('pattern with parens but no nested quantifier', () => {
      expect(() => safeRegExp('(rm|shutdown|reboot)')).not.toThrow();
    });

    it('pattern with braces but no nesting', () => {
      expect(() => safeRegExp('a{1,10}')).not.toThrow();
    });
  });

  // S2 加固回归：相邻量词原子（修复前可绕过嵌套量词检测）
  describe('adjacent quantified atoms (S2)', () => {
    it('rejects a*a* style', () => {
      expect(() => safeRegExp('a*a*a*b')).toThrow(SafeRegExpError);
    });

    it('rejects .*.* style', () => {
      expect(() => safeRegExp('.*.*a')).toThrow(SafeRegExpError);
    });

    it('rejects \\w+\\w+ style', () => {
      expect(() => safeRegExp('\\w+\\w+@')).toThrow(SafeRegExpError);
    });

    it('rejects identical char classes [a-z]+[a-z]+', () => {
      expect(() => safeRegExp('[a-z]+[a-z]+')).toThrow(SafeRegExpError);
    });

    it('allows heterogeneous adjacent classes \\w+\\d+', () => {
      expect(() => safeRegExp('\\w+\\d+')).not.toThrow();
    });

    it('allows a*b* (different literals)', () => {
      expect(() => safeRegExp('a*b*')).not.toThrow();
    });
  });

  // 非正则构造拒绝：反向引用 + 环视（跨实现确定性 + SMT 可表达性，对齐 erdl-landing spec §7.3(d)）
  describe('non-regular constructs (backref / lookaround)', () => {
    it('rejects numeric backreference (a)\\1', () => {
      expect(() => safeRegExp('(a)\\1')).toThrow(SafeRegExpError);
    });

    it('rejects leading backreference \\1(a)', () => {
      expect(() => safeRegExp('\\1(a)')).toThrow(SafeRegExpError);
    });

    it('rejects named backreference \\k<name>', () => {
      expect(() => safeRegExp('\\k<name>')).toThrow(SafeRegExpError);
    });

    it('rejects lookahead (?=a)', () => {
      expect(() => safeRegExp('(?=a)b')).toThrow(SafeRegExpError);
    });

    it('rejects negative lookahead (?!a)', () => {
      expect(() => safeRegExp('(?!a)b')).toThrow(SafeRegExpError);
    });

    it('rejects lookbehind (?<=a)', () => {
      expect(() => safeRegExp('(?<=a)b')).toThrow(SafeRegExpError);
    });

    it('rejects negative lookbehind (?<!a)', () => {
      expect(() => safeRegExp('(?<!a)b')).toThrow(SafeRegExpError);
    });

    it('accepts escaped backslash-digit \\\\1 (literal, not a backref)', () => {
      expect(() => safeRegExp('\\\\1')).not.toThrow();
    });

    it('accepts named group and non-capturing group (regular)', () => {
      expect(() => safeRegExp('(?<name>abc)')).not.toThrow();
      expect(() => safeRegExp('(?:abc)')).not.toThrow();
    });

    it('rejects inline (?i) via JS parser', () => {
      expect(() => safeRegExp('(?i)abc')).toThrow(SafeRegExpError);
    });
  });

  describe('safeTest input bound (E4 工程等价)', () => {
    it('matches within bound', () => {
      expect(safeTest(/password/, 'the password is here')).toBe(true);
    });

    it('truncates oversized input instead of scanning all', () => {
      const re = /secret$/;
      const huge = 'x'.repeat(REGEX_MAX_INPUT_LENGTH) + 'secret';
      // 'secret' 在截断窗口之外 → 不匹配（有界成本）
      expect(safeTest(re, huge)).toBe(false);
      expect(safeTest(re, 'secret')).toBe(true);
    });
  });

  describe('analyzePattern 统一出口', () => {
    it('returns null for safe pattern', () => {
      expect(analyzePattern('rm\\s+-rf')).toBeNull();
    });

    it('returns reason for nested quantifier', () => {
      expect(analyzePattern('(a+)+')).toMatch(/nested quantifiers/);
    });

    it('returns reason for adjacent atoms', () => {
      expect(analyzePattern('.*.*')).toMatch(/adjacent quantified atoms/);
    });
  });

  describe('length limit', () => {
    it('exceeds 200 chars', () => {
      const p = 'a'.repeat(201);
      expect(() => safeRegExp(p)).toThrow(SafeRegExpError);
      expect(() => safeRegExp(p)).toThrow(/exceeds/);
    });
  });

  describe('input validation', () => {
    it('rejects non-string', () => {
      expect(() => safeRegExp(123 as unknown as string)).toThrow(SafeRegExpError);
      expect(() => safeRegExp(null as unknown as string)).toThrow(SafeRegExpError);
    });

    it('rejects invalid regex syntax', () => {
      expect(() => safeRegExp('[unclosed')).toThrow(SafeRegExpError);
    });

    it('error message on invalid syntax', () => {
      let msg = '';
      try {
        safeRegExp('[unclosed');
      } catch (e: unknown) {
        msg = (e as Error).message;
      }
      expect(msg).toContain('invalid pattern');
    });
  });

  describe('real rule patterns (from preset rules)', () => {
    it('rm -rf pattern', () => {
      const r = safeRegExp('rm\\s+-rf');
      expect(r.test('rm -rf /')).toBe(true);
      expect(r.test('rm  -rf node_modules')).toBe(true);
      expect(r.test('npm run build')).toBe(false);
    });

    it('SSRF private IP pattern', () => {
      const r = safeRegExp(
        '(10\\.\\d+\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.|192\\.168\\.|127\\.0\\.0\\.|0\\.0\\.0\\.0|localhost|metadata|169\\.254\\.)',
      );
      expect(r.test('10.0.0.1')).toBe(true);
      expect(r.test('192.168.1.1')).toBe(true);
      expect(r.test('127.0.0.1')).toBe(true);
      expect(r.test('169.254.169.254')).toBe(true);
      expect(r.test('8.8.8.8')).toBe(false);
    });

    it('SQL injection pattern', () => {
      const r = safeRegExp("'; DROP TABLE");
      expect(r.test("'; DROP TABLE users;--")).toBe(true);
      expect(r.test('SELECT * FROM users')).toBe(false);
    });

    it('base64 payload pattern', () => {
      const r = safeRegExp('echo\\s+[A-Za-z0-9+/]{20,}=*\\s*\\|\\s*(base64|sh|bash)');
      expect(r.test('echo dGVzdCBkYXRhIGhlcmUAAAAA | base64 -d')).toBe(true);
      expect(r.test('echo hello')).toBe(false);
    });
  });
});
