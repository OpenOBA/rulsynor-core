/**
 * Clock — 时间抽象层
 *
 * 使时间依赖规则（within/rate）可测试。
 * Phase 0 必须完成（Henry 决策 #2）。
 */

export interface Clock {
  /** 返回当前时间（毫秒级 Unix timestamp） */
  now(): number;

  /** 冻结到指定时间（测试用） */
  freeze?(time: number): void;

  /** 时间快进（测试用） */
  advance?(ms: number): void;
}

/**
 * SystemClock — 真实系统时钟
 */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * VirtualClock — 虚拟时钟（测试用）
 *
 * 初始时间为 0。支持 freeze 到任意时间点、advance 快进。
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
