/**
 * Clock — time abstraction layer
 *
 * Makes time-dependent rules (within/rate) testable.
 * Must be completed in Phase 0 (Henry decision #2).
 */

export interface Clock {
  /** Return the current time (millisecond Unix timestamp) */
  now(): number;

  /** Freeze to a specified time (test only) */
  freeze?(time: number): void;

  /** Advance time (test only) */
  advance?(ms: number): void;
}

/**
 * SystemClock — real system clock
 */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * VirtualClock — virtual clock (test only)
 *
 * Initial time is 0. Supports freeze to any point in time and advance.
 */
export class VirtualClock implements Clock {
  private _now: number;

  constructor(initialTime: number = 0) {
    this._now = initialTime;
  }

  now(): number {
    return this._now;
  }

  freeze(time: number): void {
    this._now = time;
  }

  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('VirtualClock.advance: ms must be non-negative');
    }
    this._now += ms;
  }
}
