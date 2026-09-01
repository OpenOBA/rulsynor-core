/**
 * GuardStateManager unit tests（适配 rulsynor 新版接口：checkWithin/checkRate boolean 语义）
 */
import { GuardStateManager } from '../src/engine/guard-state-manager.js';
import { VirtualClock } from '../src/engine/clock.js';

describe('GuardStateManager', () => {
  let clock: VirtualClock;
  let state: GuardStateManager;

  beforeEach(() => {
    clock = new VirtualClock(1000000);
    state = new GuardStateManager(clock, 60000);
  });

  describe('within check', () => {
    it('starts empty (checkWithin false)', () => {
      expect(state.checkWithin('key-a', 60000)).toBe(false);
    });

    it('records events within window', () => {
      state.recordWithin('key-a');
      state.recordWithin('key-a');
      expect(state.checkWithin('key-a', 60000)).toBe(true);
    });

    it('prunes events outside window', () => {
      state.recordWithin('key-a');
      expect(state.checkWithin('key-a', 60000)).toBe(true);
      clock.advance(120000);
      expect(state.checkWithin('key-a', 60000)).toBe(false);
    });

    it('tracks different keys independently', () => {
      state.recordWithin('key-a');
      state.recordWithin('key-b');
      state.recordWithin('key-b');
      expect(state.checkWithin('key-a', 60000)).toBe(true);
      expect(state.checkWithin('key-b', 60000)).toBe(true);
    });
  });

  describe('rate check', () => {
    it('starts empty (checkRate true)', () => {
      expect(state.checkRate('rate-a', 3, 60000)).toBe(true);
    });

    it('checks rate limit (recent.length < maxCount)', () => {
      state.recordRate('rate-a', 60000);
      state.recordRate('rate-a', 60000);
      expect(state.checkRate('rate-a', 3, 60000)).toBe(true); // 2 < 3
      state.recordRate('rate-a', 60000);
      expect(state.checkRate('rate-a', 3, 60000)).toBe(false); // 3 >= 3
    });

    it('prunes when time exceeds window', () => {
      state.recordRate('rate-a', 60000);
      state.recordRate('rate-a', 60000);
      expect(state.checkRate('rate-a', 2, 60000)).toBe(false); // 2 >= 2
      clock.advance(120000);
      expect(state.checkRate('rate-a', 2, 60000)).toBe(true); // pruned
    });
  });

  describe('snapshot & freeze migration', () => {
    it('snapshot records keys', () => {
      state.recordWithin('w1');
      state.recordRate('r1', 60000);
      const snap = state.snapshotBeforeMigration();
      expect(snap.withinKeys).toContain('w1');
      expect(snap.rateKeys).toContain('r1');
    });

    it('isFrozen returns true within freeze window', () => {
      const snap = state.snapshotBeforeMigration();
      expect(state.isFrozen(snap.snapshotTime)).toBe(true);
      clock.advance(120000);
      expect(state.isFrozen(snap.snapshotTime)).toBe(false);
    });

    it('conservativeCount returns max of actual and 0.8*limit', () => {
      expect(state.conservativeCount(1, 10)).toBe(8); // 0.8*10=8 > 1
      expect(state.conservativeCount(9, 10)).toBe(9); // 9 > 8
      expect(state.conservativeCount(0, 100)).toBe(80);
    });
  });

  describe('getActiveWithinKeys', () => {
    it('returns only keys with active timestamps', () => {
      state.recordWithin('active');
      expect(state.getActiveWithinKeys(60000)).toContain('active');
      clock.advance(120000);
      expect(state.getActiveWithinKeys(60000)).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      state.recordWithin('w1');
      state.recordRate('r1', 60000);
      state.reset();
      expect(state.checkWithin('w1', 60000)).toBe(false);
      expect(state.checkRate('r1', 1, 60000)).toBe(true);
    });
  });
});
