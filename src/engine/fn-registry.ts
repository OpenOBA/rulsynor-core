/**
 * ERDL Function Registry — SPEC v2.0 §16.1
 *
 * Industry function registration, sandbox execution, resource quotas,
 * and degradation protocol (on_timeout fallback).
 *
 * ⚠️ Trust boundary (S7 note): timeout is implemented via Promise.race, covering only async impls.
 * A synchronous infinite-loop impl blocks the event loop, so the timeout cannot fire; nor can the impl be cancelled after timeout.
 * Therefore registered fn implementations MUST be deployer-trusted code (same trust anchor level as the rule package).
 * SPEC §59 Worker Threads hard isolation is deferred to Phase 2 (same batch as ECDSA signing infrastructure).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-07-02 · updated 2026-08-10 (sandbox + quotas + degradation)
 * @license BSL 1.1
 */

export interface FnSignature {
  name: string;
  signature: string;
  params: string[];
  returns: string;
}

/** SPEC v2.0 §16.1: Degradation behavior on timeout */
export type OnTimeout = 'throw' | 'fallback';

/** SPEC v2.0 §16.1: Sandbox scope constraint */
export type SandboxScope = 'pure' | 'network' | 'filesystem';

export interface FnRegistration {
  signature: FnSignature;
  impl: (...args: unknown[]) => unknown;
  /** Timeout in ms, default 5000 */
  timeoutMs?: number;
  /** SPEC v2.0 §16.1: Degradation protocol. Default: 'throw' */
  onTimeout?: OnTimeout;
  /** Fallback value when onTimeout='fallback' */
  fallbackValue?: unknown;
  /** SPEC v2.0 §16.1: Sandbox scope. Default: 'pure' */
  sandbox?: SandboxScope;
  /** SPEC v2.0 §16.1: determinism declaration — functions used on the Guard evaluation path must declare and guarantee determinism. Default false (non-deterministic, must not enter Guard evaluation) */
  deterministic?: boolean;
}

/** SPEC v2.0 §16.1: Resource quota */
export interface FnQuota {
  /** Max total invocations (cumulative), 0 = unlimited */
  maxInvocations?: number;
  /** Max concurrent invocations, 0 = unlimited */
  maxConcurrent?: number;
}

export class ERDLFnRegistry {
  private readonly fns = new Map<string, FnRegistration>();
  private readonly callLog: Array<{
    fn: string;
    args: unknown[];
    result: unknown;
    error?: string;
    elapsedMs: number;
  }> = [];
  private readonly invocationCounts = new Map<string, number>();
  private activeInvocations = 0;
  private quota: FnQuota = {};

  // ==================== Registration ====================

  register(reg: FnRegistration): void {
    if (this.fns.has(reg.signature.name)) {
      throw new Error(`[ERDL FnRegistry] Function "${reg.signature.name}" already registered`);
    }
    this.fns.set(reg.signature.name, reg);
  }

  has(name: string): boolean {
    return this.fns.has(name);
  }

  getSignature(name: string): FnSignature | undefined {
    return this.fns.get(name)?.signature;
  }

  /** SPEC v2.0 §16.1: query whether a function declares determinism (Guard evaluation path requires determinism) */
  isDeterministic(name: string): boolean {
    return this.fns.get(name)?.deterministic === true;
  }

  getAllSignatures(): FnSignature[] {
    return [...this.fns.values()].map(r => r.signature);
  }

  // ==================== Quota Management ====================

  /** Set global resource quotas */
  setQuota(quota: FnQuota): void {
    this.quota = { ...quota };
  }

  /** Get current quota usage */
  getQuotaUsage(): { activeInvocations: number; totalInvocations: number } {
    return {
      activeInvocations: this.activeInvocations,
      totalInvocations: [...this.invocationCounts.values()].reduce((a, b) => a + b, 0),
    };
  }

  /** Reset per-fn invocation counters */
  resetCounters(): void {
    this.invocationCounts.clear();
  }

  // ==================== Invocation ====================

  async invoke(name: string, ...args: unknown[]): Promise<unknown> {
    const reg = this.fns.get(name);
    if (!reg) {
      throw new Error(`[ERDL FnRegistry] Function "${name}" is not registered`);
    }

    // Quota check: maxInvocations
    const count = this.invocationCounts.get(name) ?? 0;
    if (this.quota.maxInvocations && count + 1 > this.quota.maxInvocations) {
      throw new Error(
        `[ERDL FnRegistry] Quota exceeded for "${name}": max ${this.quota.maxInvocations} invocations`,
      );
    }

    // Quota check: maxConcurrent
    if (this.quota.maxConcurrent && this.activeInvocations >= this.quota.maxConcurrent) {
      throw new Error(
        `[ERDL FnRegistry] Concurrent quota exceeded: max ${this.quota.maxConcurrent}`,
      );
    }

    const start = Date.now();
    const timeout = reg.timeoutMs ?? 5000;
    this.activeInvocations++;
    this.invocationCounts.set(name, count + 1);

    try {
      const result = await Promise.race([
        Promise.resolve(reg.impl(...args)),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            // SPEC v2.0 §16.1: on_timeout degradation
            const onTimeout = reg.onTimeout ?? 'throw';
            if (onTimeout === 'fallback') {
              // Fallback: resolve with fallback value — don't reject
              reject(new FallbackError(reg.fallbackValue));
            } else {
              reject(new Error(`Function "${name}" timed out after ${timeout}ms`));
            }
          }, timeout),
        ),
      ]);

      this.callLog.push({ fn: name, args, result, elapsedMs: Date.now() - start });
      if (this.callLog.length > 1000) this.callLog.splice(0, this.callLog.length - 1000);
      return result;
    } catch (e) {
      if (e instanceof FallbackError) {
        // Return fallback value on timeout
        this.callLog.push({
          fn: name,
          args,
          result: e.fallbackValue,
          elapsedMs: Date.now() - start,
        });
        if (this.callLog.length > 1000) this.callLog.splice(0, this.callLog.length - 1000);
        return e.fallbackValue;
      }
      const err = e instanceof Error ? e.message : String(e);
      this.callLog.push({
        fn: name,
        args,
        result: undefined,
        error: err,
        elapsedMs: Date.now() - start,
      });
      throw e;
    } finally {
      this.activeInvocations--;
    }
  }

  // ==================== Audit & Cleanup ====================

  getCallLog(): ReadonlyArray<(typeof this.callLog)[0]> {
    return this.callLog;
  }

  clearLog(): void {
    this.callLog.length = 0;
  }

  /** Parse fn signature string: name(params) → returnType */
  static parseSignature(sig: string): FnSignature {
    const match = sig.match(/^(\w+)\s*\(([^)]*)\)\s*(?:→|->)\s*(\w+)$/);
    if (!match) {
      throw new Error(
        `[ERDL FnRegistry] Invalid fn signature: "${sig}". Expected format: name(params) → returnType`,
      );
    }
    const [, name, paramsStr, returns] = match;
    const params = paramsStr.trim() ? paramsStr.split(',').map(p => p.trim()) : [];
    return { name, signature: sig, params, returns };
  }
}

/** Internal error class for fallback delivery */
class FallbackError extends Error {
  constructor(public readonly fallbackValue: unknown) {
    super('FnRegistry fallback');
  }
}
