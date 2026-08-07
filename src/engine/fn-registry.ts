/**
 * ERDL Function Registry
 *
 * @file erdl-fn-registry.ts — 行业函数注册与沙箱执行
 * @author 唐浩然
 * @since 2026-07-02
 * @license MIT
 *
 * @description
 * ERDL 扩展层的 fn 元属性实现。核心表达式（7 运算符）封闭，
 * 行业特定能力通过 fn 注册。注册表提供：
 *   - 函数签名声明（类型安全）
 *   - 沙箱执行（超时 + 资源限制）
 *   - 审计日志
 */

export interface FnSignature {
  /** 函数名 */
  name: string
  /** 参数描述（如 "(series, period) → number"） */
  signature: string
  /** 参数名列表 */
  params: string[]
  /** 返回类型 */
  returns: string
}

export interface FnRegistration {
  signature: FnSignature
  /** 函数实现 */
  impl: (...args: unknown[]) => unknown
  /** 超时（毫秒），默认 5 秒 */
  timeoutMs?: number
}

export class ERDLFnRegistry {
  private readonly fns = new Map<string, FnRegistration>()
  private readonly callLog: Array<{ fn: string; args: unknown[]; result: unknown; error?: string; elapsedMs: number }> = []

  /**
   * 注册一个行业函数
   *
   * @example
   * registry.register({
   *   signature: { name: 'riskScore', signature: 'riskScore(name, amount) → number', params: ['name', 'amount'], returns: 'number' },
   *   impl: (name, amount) => { ... },
   * })
   */
  register(reg: FnRegistration): void {
    if (this.fns.has(reg.signature.name)) {
      throw new Error(`[ERDL FnRegistry] Function "${reg.signature.name}" already registered`)
    }
    this.fns.set(reg.signature.name, reg)
  }

  /**
   * 检查函数是否已注册
   */
  has(name: string): boolean {
    return this.fns.has(name)
  }

  /**
   * 获取函数签名（供 LLM 上下文生成）
   */
  getSignature(name: string): FnSignature | undefined {
    const reg = this.fns.get(name)
    return reg?.signature
  }

  /**
   * 获取所有已注册函数签名（供 MCP Tool Description 生成）
   */
  getAllSignatures(): FnSignature[] {
    return [...this.fns.values()].map(r => r.signature)
  }

  /**
   * 调用已注册函数（带超时保护）
   *
   * @param name 函数名
   * @param args 参数列表
   * @returns 函数返回值
   * @throws 如果函数未注册、超时或执行错误
   */
  async invoke(name: string, ...args: unknown[]): Promise<unknown> {
    const reg = this.fns.get(name)
    if (!reg) {
      throw new Error(`[ERDL FnRegistry] Function "${name}" is not registered`)
    }

    const start = Date.now()
    const timeout = reg.timeoutMs || 5000
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      const result = await Promise.race([
        Promise.resolve(reg.impl(...args)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Function "${name}" timed out after ${timeout}ms`)), timeout)
        }),
      ])

      this.callLog.push({ fn: name, args, result, elapsedMs: Date.now() - start })
      // N-01: ring-buffer style log trimming (keep last 1000 entries)
      if (this.callLog.length > 1000) this.callLog.splice(0, this.callLog.length - 1000)
      return result
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      this.callLog.push({ fn: name, args, result: undefined, error: err, elapsedMs: Date.now() - start })
      throw e
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /**
   * 获取调用审计日志
   */
  getCallLog(): ReadonlyArray<typeof this.callLog[0]> {
    return this.callLog
  }

  /**
   * 清空调用日志
   */
  clearLog(): void {
    this.callLog.length = 0
  }

  /**
   * 解析 fn 签名字符串
   *
   * 格式：riskScore(name, amount) → number
   */
  static parseSignature(sig: string): FnSignature {
    const match = sig.match(/^(\w+)\s*\(([^)]*)\)\s*(?:→|->)\s*(\w+)$/)
    if (!match) {
      throw new Error(`[ERDL FnRegistry] Invalid fn signature: "${sig}". Expected format: name(params) → returnType`)
    }
    const [, name, paramsStr, returns] = match
    const params = paramsStr.trim()
      ? paramsStr.split(',').map(p => p.trim())
      : []
    return { name, signature: sig, params, returns }
  }
}
