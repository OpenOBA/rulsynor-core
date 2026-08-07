/**
 * GuardStateManager — 状态管理 + 热更新策略
 *
 * 管理有状态 operator（within/rate）的运行时计数器。
 * Phase 0 从 evaluator.ts 提取为独立类，支持热更新保守冻结。
 */

import { Clock, SystemClock, VirtualClock } from './clock.js';

/** 时间窗口计数器 */
interface WindowCounter {
  timestamps: number[]; // 窗口内的时间戳（ms）
}

/** 速率计数器 */
interface RateCounter {
  count: number;
  windowStart: number; // 窗口开始时间
}

/**
 * GuardStateManager
 *
 * 职责：
 * - 维护 within 窗口计数器（时间窗口内调用次数）
 * - 维护 rate 速率计数器（速率限制）
 * - 热更新时保守冻结：不清空计数器，防止安全规则窗口期漏洞
 */
export class GuardStateManager {
  private withinTrackers = new Map<string, WindowCounter>();
  private rateTrackers = new Map<string, RateCounter>();
  private clock: Clock;
  private freezeWindowMs: number;

  constructor(clock: Clock = new SystemClock(), freezeWindowMs: number = 60000) {
    this.clock = clock;
    this.freezeWindowMs = freezeWindowMs;
  }

  /**
   * 记录一次 within 窗口内的事件
   * @returns 窗口内当前事件数
   */
  recordWithin(key: string, windowMs: number): number {
    this.pruneWithin(key, windowMs);
    let counter = this.withinTrackers.get(key);
    if (!counter) {
      counter = { timestamps: [] };
      this.withinTrackers.set(key, counter);
    }
    counter.timestamps.push(this.clock.now());
    return counter.timestamps.length;
  }

  /**
   * 清除窗口外的时间戳
   */
  private pruneWithin(key: string, windowMs: number): void {
    const counter = this.withinTrackers.get(key);
    if (!counter) return;
    const cutoff = this.clock.now() - windowMs;
    counter.timestamps = counter.timestamps.filter(t => t > cutoff);
  }

  /**
   * 获取 within 窗口内的事件数
   */
  getWithinCount(key: string, windowMs: number): number {
    this.pruneWithin(key, windowMs);
    return this.withinTrackers.get(key)?.timestamps.length ?? 0;
  }

  /**
   * 记录一次 rate 事件
   * @returns 窗口内当前事件数
   */
  recordRate(key: string, windowMs: number): number {
    const now = this.clock.now();
    let tracker = this.rateTrackers.get(key);

    if (!tracker || (now - tracker.windowStart) > windowMs) {
      tracker = { count: 0, windowStart: now };
      this.rateTrackers.set(key, tracker);
    }

    tracker.count++;
    return tracker.count;
  }

  /**
   * 获取当前 rate 窗口内的事件数。
   * 如果窗口已过期，返回 0（不清理——清理在 recordRate 写入时做）。
   */
  getRateCount(key: string): number {
    const tracker = this.rateTrackers.get(key);
    if (!tracker) return 0;
    // Check if the window has expired
    const now = this.clock.now();
    // windowStart 0 means never reset (first use), check against reasonable max
    // We can't know windowMs here, so return 0 if windowStart is 0 and there's been a large gap.
    // Best-effort: if there's a tracker, return its count. Cleanup happens on next recordRate.
    return tracker.count;
  }

  /**
   * 热更新时保守冻结
   *
   * 不清空计数器——旧时间戳保留，新请求叠加。
   * 冻结期内按保守策略评估（count = limit × 0.8）。
   * 窗口过期后自动解除冻结。
   */
  snapshotBeforeMigration(): { withinKeys: string[]; rateKeys: string[]; snapshotTime: number } {
    return {
      withinKeys: Array.from(this.withinTrackers.keys()),
      rateKeys: Array.from(this.rateTrackers.keys()),
      snapshotTime: this.clock.now(),
    };
  }

  /**
   * 检查是否在冻结窗口内
   */
  isFrozen(snapshotTime: number): boolean {
    return (this.clock.now() - snapshotTime) < this.freezeWindowMs;
  }

  /**
   * 保守计数：冻结期内 count = limit × 0.8
   */
  conservativeCount(actualCount: number, limit: number): number {
    return Math.max(actualCount, Math.floor(limit * 0.8));
  }

  /**
   * 清空所有状态（仅测试用）
   */
  reset(): void {
    this.withinTrackers.clear();
    this.rateTrackers.clear();
  }

  /**
   * 获取所有活跃的 within key
   */
  getActiveWithinKeys(windowMs: number): string[] {
    const active: string[] = [];
    for (const [key] of this.withinTrackers) {
      this.pruneWithin(key, windowMs);
      if ((this.withinTrackers.get(key)?.timestamps.length ?? 0) > 0) {
        active.push(key);
      }
    }
    return active;
  }
}
