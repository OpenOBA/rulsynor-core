/**
 * clock.test.ts — SystemClock and VirtualClock unit tests
 */
import { SystemClock, VirtualClock } from '../src/engine/clock.js';

describe('SystemClock', () => {
  it('now returns a positive timestamp', () => {
    const clock = new SystemClock();
    expect(clock.now()).toBeGreaterThan(0);
  });

  it('now returns increasing values', () => {
    const clock = new SystemClock();
    const t1 = clock.now();
    const t2 = clock.now();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});

describe('VirtualClock', () => {
  it('defaults to 0', () => {
    const clock = new VirtualClock();
    expect(clock.now()).toBe(0);
  });

  it('starts at specified time', () => {
    const clock = new VirtualClock(1000000);
    expect(clock.now()).toBe(1000000);
  });

  it('freeze sets time', () => {
    const clock = new VirtualClock(1000);
    clock.freeze(5000);
    expect(clock.now()).toBe(5000);
  });

  it('advance moves time forward', () => {
    const clock = new VirtualClock(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.advance(300);
    expect(clock.now()).toBe(1800);
  });

  it('advance rejects negative', () => {
    const clock = new VirtualClock(1000);
    expect(() => clock.advance(-100)).toThrow('non-negative');
  });

  it('freeze is idempotent', () => {
    const clock = new VirtualClock(1000);
    clock.freeze(5000);
    expect(clock.now()).toBe(5000);
    clock.freeze(3000);
    expect(clock.now()).toBe(3000);
  });
});
