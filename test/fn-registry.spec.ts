/**
 * fn-registry.test.ts — ERDLFnRegistry unit tests
 */
import { ERDLFnRegistry, type FnRegistration } from '../src/engine/fn-registry.js';

describe('ERDLFnRegistry', () => {
  let registry: ERDLFnRegistry;

  const makeReg = (overrides?: Partial<FnRegistration>): FnRegistration => ({
    signature: {
      name: 'testFn',
      signature: 'testFn(a, b) → number',
      params: ['a', 'b'],
      returns: 'number',
    },
    impl: (...args: unknown[]) => (args[0] as number) + (args[1] as number),
    timeoutMs: 1000,
    ...overrides,
  });

  beforeEach(() => {
    registry = new ERDLFnRegistry();
  });

  describe('register', () => {
    it('registers a function', () => {
      registry.register(makeReg());
      expect(registry.has('testFn')).toBe(true);
    });

    it('throws on duplicate name', () => {
      registry.register(makeReg());
      expect(() => registry.register(makeReg())).toThrow(/already registered/);
    });
  });

  describe('has', () => {
    it('returns false for unregistered fn', () => {
      expect(registry.has('nope')).toBe(false);
    });

    it('returns true for registered fn', () => {
      registry.register(makeReg());
      expect(registry.has('testFn')).toBe(true);
    });
  });

  describe('getSignature', () => {
    it('returns signature for registered fn', () => {
      registry.register(makeReg());
      const sig = registry.getSignature('testFn');
      expect(sig?.name).toBe('testFn');
      expect(sig?.params).toEqual(['a', 'b']);
      expect(sig?.returns).toBe('number');
    });

    it('returns undefined for unregistered fn', () => {
      expect(registry.getSignature('nope')).toBeUndefined();
    });
  });

  describe('getAllSignatures', () => {
    it('returns all registered signatures', () => {
      registry.register(makeReg());
      registry.register(
        makeReg({
          signature: {
            name: 'testFn2',
            signature: 'testFn2() → void',
            params: [],
            returns: 'void',
          },
          impl: () => {},
        }),
      );
      expect(registry.getAllSignatures()).toHaveLength(2);
      expect(registry.getAllSignatures().map(s => s.name)).toEqual(['testFn', 'testFn2']);
    });
  });

  describe('invoke', () => {
    it('invokes registered function', async () => {
      registry.register(makeReg());
      const result = await registry.invoke('testFn', 1, 2);
      expect(result).toBe(3);
    });

    it('throws on unregistered fn', async () => {
      await expect(registry.invoke('nope')).rejects.toThrow(/not registered/);
    });

    it('times out on slow function', async () => {
      registry.register(
        makeReg({
          impl: () => new Promise(() => {}), // never resolves
          timeoutMs: 50,
        }),
      );
      await expect(registry.invoke('testFn')).rejects.toThrow(/timed out/);
    }, 5000);

    it('completes before timeout', async () => {
      registry.register(
        makeReg({
          impl: () => new Promise(resolve => setTimeout(() => resolve('ok'), 10)),
          timeoutMs: 200,
        }),
      );
      const result = await registry.invoke('testFn');
      expect(result).toBe('ok');
    });

    it('passes multiple args', async () => {
      registry.register(
        makeReg({
          impl: (...args: unknown[]) => args.join('-'),
        }),
      );
      const result = await registry.invoke('testFn', 'a', 'b', 'c');
      expect(result).toBe('a-b-c');
    });
  });

  describe('call log', () => {
    it('records successful call', async () => {
      registry.register(makeReg());
      await registry.invoke('testFn', 1, 2);
      const log = registry.getCallLog();
      expect(log).toHaveLength(1);
      expect(log[0].fn).toBe('testFn');
      expect(log[0].result).toBe(3);
      expect(log[0].error).toBeUndefined();
      expect(log[0].elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('does not log unregistered fn calls', async () => {
      await expect(registry.invoke('nope')).rejects.toThrow(/not registered/);
      const log = registry.getCallLog();
      // Unregistered fn throws before entering try/catch — not logged
      expect(log).toHaveLength(0);
    });

    it('ring-buffer trims at 1000 entries', async () => {
      registry.register(
        makeReg({
          impl: (n: unknown) => n,
        }),
      );
      // Push enough to trigger ring-buffer trim (>1000)
      for (let i = 0; i < 1050; i++) {
        await registry.invoke('testFn', i);
      }
      const log = registry.getCallLog();
      // Ring-buffer keeps last 1000: entries 0-49 should be trimmed, 50-1049 kept
      expect(log.length).toBe(1000);
      // First remaining entry should be >= 50
      expect(log[0].result).toBeGreaterThanOrEqual(50);
    }, 15000);
  });

  describe('clearLog', () => {
    it('clears call log', async () => {
      registry.register(makeReg());
      await registry.invoke('testFn', 1, 2);
      expect(registry.getCallLog()).toHaveLength(1);
      registry.clearLog();
      expect(registry.getCallLog()).toHaveLength(0);
    });
  });

  describe('parseSignature (static)', () => {
    it('parses standard signature', () => {
      const sig = ERDLFnRegistry.parseSignature('riskScore(name, amount) → number');
      expect(sig.name).toBe('riskScore');
      expect(sig.params).toEqual(['name', 'amount']);
      expect(sig.returns).toBe('number');
    });

    it('parses signature with no params', () => {
      const sig = ERDLFnRegistry.parseSignature('now() → string');
      expect(sig.name).toBe('now');
      expect(sig.params).toEqual([]);
      expect(sig.returns).toBe('string');
    });

    it('parses with arrow variant', () => {
      const sig = ERDLFnRegistry.parseSignature('add(a, b) -> number');
      expect(sig.name).toBe('add');
      expect(sig.params).toEqual(['a', 'b']);
      expect(sig.returns).toBe('number');
    });

    it('throws on invalid signature', () => {
      expect(() => ERDLFnRegistry.parseSignature('not a signature')).toThrow(/Invalid/);
    });
  });
});
