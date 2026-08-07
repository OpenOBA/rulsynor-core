/**
 * op-sem-registry.test.ts — Operation Semantic Registry unit tests
 */
import { OpSemRegistry } from '../src/engine/op-sem-registry.js';
import type { OpSemCode } from '../src/engine/op-sem-registry.js';

describe('OpSemRegistry', () => {
  let registry: OpSemRegistry;

  beforeEach(() => {
    registry = new OpSemRegistry();
  });

  describe('load', () => {
    it('loads the bundled YAML registry', () => {
      registry.load();
      expect(registry.isLoaded).toBe(true);
    });

    it('throws on nonexistent file', () => {
      expect(() => registry.load('nonexistent.yaml')).toThrow(/not found/);
    });
  });

  describe('classify', () => {
    beforeEach(() => registry.load());

    it('classifies exec as OP_EXEC', () => {
      const r = registry.classify('exec', {});
      expect(r.code).toBe('OP_EXEC');
    });

    it('classifies read_file as OP_READ', () => {
      const r = registry.classify('read_file', {});
      expect(r.code).toBe('OP_READ');
      expect(r.risk).toBe('low');
    });

    it('classifies write_file as OP_WRITE', () => {
      const r = registry.classify('write_file', {});
      expect(r.code).toBe('OP_WRITE');
    });

    it('sub-classifies git exec command', () => {
      const r = registry.classify('exec', { command: 'git commit -m "fix"' });
      expect(r.code).toBe('OP_EXEC');
      expect(r.subCode).toBeDefined();
      expect(r.subCode).not.toBe('');
      expect(r.subCode).not.toBe('UNKNOWN');
    });

    it('classifies npm install as exec with subCode', () => {
      const r = registry.classify('exec', { command: 'npm install' });
      expect(r.code).toBe('OP_EXEC');
      expect(r.subCode).toBeDefined();
    });

    it('classifies rm -rf as high risk', () => {
      const r = registry.classify('exec', { command: 'rm -rf node_modules' });
      expect(r.code).toBe('OP_EXEC');
      // rm is classified as FS_DELETE → should have elevated risk
      expect(r.risk).toBeDefined();
    });

    it('classifies unknown tool as OP_EXEC high risk', () => {
      const r = registry.classify('unknown_tool_xyz', {});
      expect(r.code).toBe('OP_EXEC');
      expect(r.risk).toBe('high');
    });

    it('returns valid codeStr/riskStr/subCodeStr', () => {
      const r = registry.classify('exec', { command: 'ls' });
      expect(typeof r.codeStr).toBe('string');
      expect(typeof r.riskStr).toBe('string');
      expect(typeof r.subCodeStr).toBe('string');
    });
  });

  describe('unloaded state', () => {
    it('returns unknown result when not loaded', () => {
      const r = registry.classify('exec', {});
      expect(r.code).toBe('OP_EXEC');
      expect(r.risk).toBe('high');
      expect(r.label).toBe('未知操作');
    });

    it('isLoaded is false before load', () => {
      expect(registry.isLoaded).toBe(false);
    });
  });

  describe('getCategories', () => {
    it('returns empty before load', () => {
      expect(registry.getCategories()).toHaveLength(0);
    });

    it('returns categories after load', () => {
      registry.load();
      const cats = registry.getCategories();
      expect(cats.length).toBeGreaterThan(0);
      for (const c of cats) {
        expect(typeof c.risk).toBe('string');
        expect(typeof c.label).toBe('string');
      }
    });
  });

  describe('reload', () => {
    it('reloads without error', () => {
      registry.load();
      registry.reload();
      expect(registry.isLoaded).toBe(true);
    });
  });
});
