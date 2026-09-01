/**
 * GuardStateManager — state management + hot-reload strategy
 *
 * Manages the runtime counters for stateful operators (within/rate).
 * Aligned with the "sliding timestamp array" semantics embedded in the Evaluator (externalized refactor 2026-08-15, semantics unchanged).
 *
 * Semantic points (byte-identical to the old evaluator-embedded implementation):
 * - rate: timestamp array, within the window `recent.length >= maxCount` means exceeded;
 * - within: timestamp array, within the window `recent.length >= 1` means passed (requires prior history in the window);
 * - cleanup: cleanup(maxAgeMs) trims expired timestamps per key.
 *
 * Also provides hot-reload "conservative freeze" capability (snapshotBeforeMigration / isFrozen / conservativeCount),
 * preventing a window-period hole in security rules from clearing counters on hot reload.
 */

import { Clock, SystemClock } from './clock.js';

/**
 * GuardStateManager
 */
export class GuardStateManager {
  private withinTracker = new Map<string, number[]>();
  private rateTracker = new Map<string, number[]>();
  private readonly clock: Clock;
  private readonly freezeWindowMs: number;

  constructor(clock: Clock = new SystemClock(), freezeWindowMs: number = 60000) {
    this.clock = clock;
    this.freezeWindowMs = freezeWindowMs;
  }

  // ═══════════════════════════════════════════
  // rate — sliding timestamp array semantics (read/write separated)
  // ═══════════════════════════════════════════

  /**
   * Check whether rate is exceeded (read-only, no write-back).
   * @returns true means not exceeded (can continue), false means exceeded.
   */
  checkRate(key: string, maxCount: number, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter(t => now - t < windowMs);
    return recent.length < maxCount;
  }

  /**
   * Record a rate event (recorded when not exceeded, i.e. an allowed operation).
   * Business rate-limit semantics: the count tracks "allowed operation count", exceeded operations no longer accumulate, and the window recovers naturally.
   */
  recordRate(key: string, windowMs: number): void {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter(t => now - t < windowMs);
    recent.push(now);
    this.rateTracker.set(key, recent);
  }

  /**
   * Get the count for a key within the current window (read-only, for temporal_state snapshot, RFC-002 §2.4).
   * @param key  tracker key (rate:field:rate or within:field)
   * @param windowMs  window in milliseconds
   * @param isRate  true for rate tracker, false for within tracker
   */
  getCount(key: string, windowMs: number, isRate: boolean): number {
    const now = this.clock.now();
    const tracker = isRate ? this.rateTracker : this.withinTracker;
    const timestamps = tracker.get(key) ?? [];
    const recent = timestamps.filter(t => now - t < windowMs);
    return recent.length;
  }

  // ═══════════════════════════════════════════
  // within — sliding timestamp array semantics
  // ═══════════════════════════════════════════

  /**
   * Check whether there is already a historical event within the within window (read-only).
   * Semantics aligned with the old implementation: requires at least 1 timestamp within the window.
   */
  checkWithin(key: string, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    const recent = timestamps.filter(t => now - t < windowMs);
    return recent.length >= 1;
  }

  /**
   * Record a within event (recorded on first trigger, i.e. an allowed operation).
   * Dedup semantics: first trigger within the window records, from the second onward it hits (block).
   */
  recordWithin(key: string): void {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    timestamps.push(now);
    this.withinTracker.set(key, timestamps);
  }

  // ═══════════════════════════════════════════
  // cleanup
  // ═══════════════════════════════════════════

  /**
   * Trim expired timestamps (conservative cleanup by maxAgeMs).
   */
  cleanup(maxAgeMs: number): void {
    const now = this.clock.now();
    for (const [key, timestamps] of this.rateTracker) {
      const recent = timestamps.filter(t => now - t < maxAgeMs);
      if (recent.length === 0) this.rateTracker.delete(key);
      else this.rateTracker.set(key, recent);
    }
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter(t => now - t < maxAgeMs);
      if (recent.length === 0) this.withinTracker.delete(key);
      else this.withinTracker.set(key, recent);
    }
  }

  // ═══════════════════════════════════════════
  // hot-reload conservative freeze
  // ═══════════════════════════════════════════

  /**
   * Pre-hot-reload snapshot: returns the current active keys and timestamps, used for conservative counting during the freeze window.
   */
  snapshotBeforeMigration(): { withinKeys: string[]; rateKeys: string[]; snapshotTime: number } {
    return {
      withinKeys: Array.from(this.withinTracker.keys()),
      rateKeys: Array.from(this.rateTracker.keys()),
      snapshotTime: this.clock.now(),
    };
  }

  /** Whether within the freeze window */
  isFrozen(snapshotTime: number): boolean {
    return this.clock.now() - snapshotTime < this.freezeWindowMs;
  }

  /**
   * Conservative count: within the freeze window, count takes max(actual, floor(limit * 0.8)),
   * preventing underestimation of prior call counts after hot reload.
   */
  conservativeCount(actualCount: number, limit: number): number {
    return Math.max(actualCount, Math.floor(limit * 0.8));
  }

  /** Clear all state (test only) */
  reset(): void {
    this.withinTracker.clear();
    this.rateTracker.clear();
  }

  /** Get the count of active within keys within the window (diagnostic) */
  getActiveWithinKeys(windowMs: number): string[] {
    const now = this.clock.now();
    const active: string[] = [];
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter(t => now - t < windowMs);
      if (recent.length > 0) active.push(key);
    }
    return active;
  }
}
