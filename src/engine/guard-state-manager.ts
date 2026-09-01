/**
 * GuardStateManager — 状态管理 + 热更新策略
 *
 * 管理有状态 operator（within/rate）的运行时计数器。
 * 对齐 Evaluator 内嵌的「滑动时间戳数组」语义（2026-08-15 外置重构，保语义不变）。
 *
 * 语义要点（与旧 evaluator 内嵌实现逐字节一致）：
 * - rate：时间戳数组，窗口内 `recent.length >= maxCount` 即超限；
 * - within：时间戳数组，窗口内 `recent.length >= 1` 即通过（要求窗口内已有历史）；
 * - 清理：cleanup(maxAgeMs) 逐 key 裁剪过期时间戳。
 *
 * 另提供热更新「保守冻结」能力（snapshotBeforeMigration / isFrozen / conservativeCount），
 * 防止热重载时清空计数器导致安全规则窗口期漏洞。
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
  // rate — 滑动时间戳数组语义（读/写分离）
  // ═══════════════════════════════════════════

  /**
   * 检查 rate 是否超限（只读，不写回）。
   * @returns true 表示未超限（可继续），false 表示已超限。
   */
  checkRate(key: string, maxCount: number, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length < maxCount;
  }

  /**
   * 记录一次 rate 事件（未超限时记录，即放行的操作）。
   * 业界限流语义：计数统计「放行的操作次数」，超限的操作不再累加，窗口自然恢复。
   */
  recordRate(key: string, windowMs: number): void {
    const now = this.clock.now();
    const timestamps = this.rateTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    this.rateTracker.set(key, recent);
  }

  /**
   * 获取指定 key 在当前窗口内的计数（只读，用于 temporal_state 快照，RFC-002 §2.4）。
   * @param key  tracker key（rate:field:rate 或 within:field）
   * @param windowMs 窗口毫秒数
   * @param isRate  true 表示 rate tracker，false 表示 within tracker
   */
  getCount(key: string, windowMs: number, isRate: boolean): number {
    const now = this.clock.now();
    const tracker = isRate ? this.rateTracker : this.withinTracker;
    const timestamps = tracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length;
  }

  // ═══════════════════════════════════════════
  // within — 滑动时间戳数组语义
  // ═══════════════════════════════════════════

  /**
   * 检查 within 窗口内是否已有历史事件（只读）。
   * 语义对齐旧实现：要求窗口内至少已有 1 个时间戳。
   */
  checkWithin(key: string, windowMs: number): boolean {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    return recent.length >= 1;
  }

  /**
   * 记录一次 within 事件（首次触发时记录，即放行的操作）。
   * 去重语义：窗口内首次触发记录，第二次起命中（拦截）。
   */
  recordWithin(key: string): void {
    const now = this.clock.now();
    const timestamps = this.withinTracker.get(key) ?? [];
    timestamps.push(now);
    this.withinTracker.set(key, timestamps);
  }

  // ═══════════════════════════════════════════
  // 清理
  // ═══════════════════════════════════════════

  /**
   * 裁剪过期时间戳（按 maxAgeMs 保守清理）。
   */
  cleanup(maxAgeMs: number): void {
    const now = this.clock.now();
    for (const [key, timestamps] of this.rateTracker) {
      const recent = timestamps.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) this.rateTracker.delete(key);
      else this.rateTracker.set(key, recent);
    }
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter((t) => now - t < maxAgeMs);
      if (recent.length === 0) this.withinTracker.delete(key);
      else this.withinTracker.set(key, recent);
    }
  }

  // ═══════════════════════════════════════════
  // 热更新保守冻结
  // ═══════════════════════════════════════════

  /**
   * 热更新前快照：返回当前活跃 key 与时间戳，用于冻结期内保守计数。
   */
  snapshotBeforeMigration(): { withinKeys: string[]; rateKeys: string[]; snapshotTime: number } {
    return {
      withinKeys: Array.from(this.withinTracker.keys()),
      rateKeys: Array.from(this.rateTracker.keys()),
      snapshotTime: this.clock.now(),
    };
  }

  /** 是否处于冻结窗口内 */
  isFrozen(snapshotTime: number): boolean {
    return (this.clock.now() - snapshotTime) < this.freezeWindowMs;
  }

  /**
   * 保守计数：冻结期内 count 取 max(actual, floor(limit * 0.8))，
   * 防止热更新后窗口期内低估已有调用次数。
   */
  conservativeCount(actualCount: number, limit: number): number {
    return Math.max(actualCount, Math.floor(limit * 0.8));
  }

  /** 清空所有状态（仅测试用） */
  reset(): void {
    this.withinTracker.clear();
    this.rateTracker.clear();
  }

  /** 获取窗口内活跃的 within key 数（诊断用） */
  getActiveWithinKeys(windowMs: number): string[] {
    const now = this.clock.now();
    const active: string[] = [];
    for (const [key, timestamps] of this.withinTracker) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length > 0) active.push(key);
    }
    return active;
  }
}
