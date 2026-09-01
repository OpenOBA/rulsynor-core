/**
 * Rulsynor — Rule YAML Serializer
 *
 * Converts RuleConfig DB entities to ERDL SPEC v2.0 §11 YAML files.
 *
 * SPEC v2.0 §11 format ironclad rules (F1-F8):
 *   F1 顶层顺序: protocol → version → metadata → rules
 *   F2 metadata: name → description → category → decision → tags
 *   F3 rules[]: name → description → priority → override → ring → when → then → message → instruction → unless
 *   F4 when.conditions[]: field → operator → value
 *   F6 自然语言字符串双引号 / 枚举裸词 / tags 裸词
 *   F7 2 空格缩进
 *   F8 protocol 必须开头
 *
 * 实现策略：不依赖 yaml.dump()（JS 对象 key order 不可控、quoting 不可控），
 * 改用自定义模板逐字段拼接，确保字段顺序与引号风格铁律满足 SPEC v2.0 §11。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-20 · P2 DB → FS sync
 * @rework 2026-07-26 · 模板拼接法对齐 SPEC v2.0 §11 F1-F8
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { RuleConfig } from './rule-config.js'
import { RulsynorLogger } from './logger.js'
import { fromSExpr } from './expr-tree/s-expression.js'

const log = new RulsynorLogger('RuleYamlSerializer')

// ============================================
// Types
// ============================================

interface Spec5Metadata {
  name: string
  description: string
  category: string
  decision: string
  /** SPEC v2.0 §11 F2: tags 为裸词列表，可选 */
  tags?: unknown[]
}

interface Spec5Rule {
  name: string
  description?: string
  priority?: number
  override?: string
  ring?: number
  when: Record<string, unknown> | string
  then: string
  message?: string
  instruction?: string
  unless?: Record<string, unknown> | string
  explanation?: string | { zh: string; en: string }
  alternative?: string | { zh: string; en: string }
  /** 规则依据的法律法规出处（如《XX 管理办法》第 X 条） */
  legal_basis?: string
  /** 规则依据的法规原文全文 */
  source_text?: string
}

interface Spec5Document {
  protocol: string
  version: string
  metadata: Spec5Metadata
  rules: Spec5Rule[]
}

/** 从 rule.content 提取出的 SPEC v2.0 §11 结构化数据 */
export interface ExtractedSpec5 {
  protocol: string
  version: string
  metadata: Record<string, unknown>
  rules: Record<string, unknown>[]
}

// ============================================
// Serializer
// ============================================

export class RuleYamlSerializer {
  private readonly rulesDir: string

  constructor(rulesDir: string) {
    this.rulesDir = rulesDir
  }

  /**
   * Convert a RuleConfig DB entity to SPEC v2.0 §11 YAML string.
   *
   * 模板拼接法：按 F1-F8 逐字段拼接，不依赖 yaml.dump()。
   * 优先从 rule.content 读取完整 SPEC 结构；若 content 不是 SPEC5 嵌套格式，
   * 用 DB 字段构造最小结构。
   */
  toSpec5Yaml(rule: RuleConfig): string {
    return this.serializeSpec5(this.extractSpec5(rule))
  }

  /**
   * Write a rule to the file system:
   *   ~/.openoba/rules/{category}/{safe-name}.erdl.yaml
   *
   * Returns the written file path.
   */
  /**
   * P0-26 fix: Validate category against whitelist to prevent path traversal.
   * Without this, category="../../../etc" could write rule files to arbitrary directories.
   */
  private static readonly VALID_CATEGORIES = new Set([
    'coding', 'engineering', 'security', 'testing', 'performance',
    'writing', 'design', 'observability', 'compliance', 'accessibility', 'custom',
  ])

  private validateCategory(category: string): string {
    const cat = category || 'custom'
    if (!RuleYamlSerializer.VALID_CATEGORIES.has(cat)) {
      throw new Error(`Invalid category: "${cat}". Must be one of: ${[...RuleYamlSerializer.VALID_CATEGORIES].join(', ')}`)
    }
    return cat
  }

  writeRuleFile(rule: RuleConfig): string {
    // P0-26 fix: validate category before path.join to prevent path traversal
    const category = this.validateCategory(rule.category || 'custom')
    const categoryDir = path.join(this.rulesDir, category)
    // Defense in depth: verify resolved path stays within rulesDir
    const resolvedDir = path.resolve(categoryDir)
    const resolvedRoot = path.resolve(this.rulesDir)
    if (resolvedDir !== resolvedRoot && !resolvedDir.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Path traversal detected: category="${category}" escapes rules directory`)
    }
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true })
    }

    const safeName = rule.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const filePath = path.join(categoryDir, `${safeName}.erdl.yaml`)

    const yamlStr = this.toSpec5Yaml(rule)
    fs.writeFileSync(filePath, yamlStr, 'utf-8')
    log.log(`[yaml-sync] Wrote: ${filePath}`)
    return filePath
  }

  /**
   * Remove a rule's YAML file from the file system.
   */
  removeRuleFile(name: string, category: string): void {
    // P0-26 fix: validate category before path operations
    const safeCategory = this.validateCategory(category || 'custom')
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const dir = path.join(this.rulesDir, safeCategory)
    const filePath = path.join(dir, `${safeName}.erdl.yaml`)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      log.log(`[yaml-sync] Removed: ${filePath}`)
    }
  }

  /**
   * Full sync: write all DB rules to the file system.
   * Returns count of written files.
   */
  syncAll(rules: RuleConfig[]): number {
    let count = 0
    const writtenDirs = new Set<string>()

    for (const rule of rules) {
      try {
        this.writeRuleFile(rule)
        writtenDirs.add(path.join(this.rulesDir, rule.category || 'custom'))
        count++
      } catch (err) {
        log.log(`[yaml-sync] Error writing rule "${rule.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    log.log(`[yaml-sync] Synced ${count} rules to ${this.rulesDir}`)
    return count
  }

  // ============================================
  // Private: 结构化文档（供程序化消费，结构对齐 SPEC v2.0 §11 F2）
  // ============================================

  /** 返回 SPEC v2.0 §11 结构化文档对象（metadata 不再含 priority/ring/enabled/source）。 */
  toSpec5Document(rule: RuleConfig): Spec5Document {
    const data = this.extractSpec5(rule)
    const m = data.metadata
    const docMetadata: Spec5Metadata = {
      name: String(m.name ?? ''),
      description: String(m.description ?? ''),
      category: String(m.category ?? 'custom'),
      decision: String(m.decision ?? 'ALLOW'),
    }
    if (m.tags !== undefined) docMetadata.tags = m.tags as unknown[]
    return {
      protocol: data.protocol,
      version: data.version,
      metadata: docMetadata,
      rules: data.rules.map((r) => this.toSpec5Rule(r)),
    }
  }

  private toSpec5Rule(r: Record<string, unknown>): Spec5Rule {
    const out: Spec5Rule = {
      name: String(r.name ?? ''),
      when: (r.when as Spec5Rule['when']) ?? 'true',
      then: String(r.then ?? 'ALLOW'),
    }
    if (r.description !== undefined) out.description = String(r.description)
    if (r.priority !== undefined) out.priority = Number(r.priority)
    const ov = this.normalizeOverride(r.override)
    if (ov) out.override = ov
    if (r.ring !== undefined) out.ring = Number(r.ring)
    if (r.message !== undefined) out.message = String(r.message)
    if (r.instruction !== undefined) out.instruction = String(r.instruction)
    if (r.unless !== undefined) out.unless = r.unless as Spec5Rule['unless']
    if (r.explanation !== undefined) out.explanation = r.explanation as Spec5Rule['explanation']
    if (r.alternative !== undefined) out.alternative = r.alternative as Spec5Rule['alternative']
    if (r.legal_basis !== undefined) out.legal_basis = String(r.legal_basis)
    if (r.source_text !== undefined) out.source_text = String(r.source_text)
    return out
  }

  // ============================================
  // Private: 提取 + 模板序列化
  // ============================================

  /**
   * 从 RuleConfig 提取 SPEC v2.0 §11 结构。
   * 优先用 content 中已有的完整 { protocol, version, metadata, rules }；
   * 否则用 DB 字段构造最小结构（兼容 flat/legacy content）。
   */
  private extractSpec5(rule: RuleConfig): ExtractedSpec5 {
    const content = (rule.content as Record<string, unknown>) ?? {}

    if (content.protocol === 'erdl/v2' && Array.isArray(content.rules) && content.rules.length > 0) {
      return {
        protocol: String(content.protocol),
        version: String(content.version ?? '2.0.0'),
        metadata: (content.metadata as Record<string, unknown>) ?? {},
        rules: content.rules as Record<string, unknown>[],
      }
    }

    // Fallback: flat / legacy content → 构造最小 SPEC v2.0 §11
    const raw = content
    const name = (raw.name as string) ?? rule.name
    const decision = (raw.then as string) ?? rule.decision ?? 'ALLOW'
    const metadata: Record<string, unknown> = {
      name,
      description: (raw.description as string) ?? name,
      category: (raw.category as string) ?? rule.category ?? 'custom',
      decision,
    }
    const ruleEntry: Record<string, unknown> = {
      name,
      priority: (raw.priority as number) ?? rule.priority ?? 100,
      ring: rule.ring_level ?? 3,
      when: raw.when ?? 'true',
      then: decision,
      message: (raw.message as string) ?? (raw.instruction as string) ?? '',
    }
    if (raw.override !== undefined) ruleEntry.override = raw.override
    if (raw.unless !== undefined) ruleEntry.unless = raw.unless
    if (raw.instruction !== undefined) ruleEntry.instruction = raw.instruction
    if (raw.explanation !== undefined) ruleEntry.explanation = raw.explanation
    if (raw.alternative !== undefined) ruleEntry.alternative = raw.alternative
    return { protocol: 'erdl/v2', version: '2.0.0', metadata, rules: [ruleEntry] }
  }

  /**
   * 模板拼接：按 F1-F8 逐行生成 YAML 字符串。
   * Public so template-engine can produce SPEC v2.0 §11 YAML without a RuleConfig entity.
   */
  serializeSpec5(data: ExtractedSpec5): string {
    const lines: string[] = []

    // F1 / F8: protocol 开头，紧跟 version
    lines.push(`protocol: ${this.q(data.protocol)}`)
    lines.push(`version: ${this.q(data.version)}`)
    lines.push('')

    // F2: metadata: name → description → category → decision → tags
    const m = data.metadata
    lines.push('metadata:')
    lines.push(`  name: ${this.q(m.name)}`)
    if (m.description !== undefined) lines.push(`  description: ${this.q(m.description)}`)
    if (m.category !== undefined) lines.push(`  category: ${this.bare(m.category)}`)
    if (m.decision !== undefined) lines.push(`  decision: ${this.bare(m.decision)}`)
    const tagsLine = this.serializeTags(m.tags)
    if (tagsLine !== null) lines.push(`  tags: ${tagsLine}`)
    lines.push('')

    // F3: rules
    lines.push('rules:')
    for (const rule of data.rules) {
      lines.push(...this.serializeRule(rule))
    }

    return lines.join('\n') + '\n'
  }

  /**
   * 序列化单条规则（F3 字段顺序）。
   * 缩进：rules 顶层 0，规则项 `- ` 在 2，规则字段在 4。
   */
  private serializeRule(rule: Record<string, unknown>): string[] {
    const lines: string[] = []
    // F3: name → description → priority → override → ring → when → then → message → instruction → unless
    lines.push(`  - name: ${this.q(rule.name)}`)
    if (rule.description !== undefined) lines.push(`    description: ${this.q(rule.description)}`)
    if (rule.priority !== undefined) lines.push(`    priority: ${this.bare(rule.priority)}`)
    const ov = this.normalizeOverride(rule.override)
    if (ov) lines.push(`    override: ${this.bare(ov)}`)
    if (rule.ring !== undefined) lines.push(`    ring: ${this.bare(rule.ring)}`)
    // when
    lines.push(...this.serializeWhenOrUnless('when', rule.when, 4))
    // then
    if (rule.then !== undefined) lines.push(`    then: ${this.bare(rule.then)}`)
    // message
    if (rule.message !== undefined) lines.push(`    message: ${this.q(rule.message)}`)
    // instruction
    if (rule.instruction !== undefined) lines.push(`    instruction: ${this.q(rule.instruction)}`)
    // unless
    if (rule.unless !== undefined) lines.push(...this.serializeWhenOrUnless('unless', rule.unless, 4))
    // explanation / alternative（可选，置于末尾）
    if (rule.explanation !== undefined) {
      lines.push(...this.serializeBilingual('explanation', rule.explanation, 4))
    }
    if (rule.alternative !== undefined) {
      lines.push(...this.serializeBilingual('alternative', rule.alternative, 4))
    }
    // legal_basis / source_text（法规依据 + 原文，置于末尾）
    if (rule.legal_basis !== undefined) lines.push(`    legal_basis: ${this.q(rule.legal_basis)}`)
    if (rule.source_text !== undefined) lines.push(`    source_text: ${this.q(rule.source_text)}`)
    return lines
  }

  /**
   * 序列化 when / unless 块（结构相同）。
   * 支持三种形态（按优先级）：
   *  - S-expression 表达式树（when 顶层即树）
   *  - 平铺 { logic, conditions: [...] }（Simple 投影面）
   *  - 字符串 'true' / 其他字符串
   * F4: conditions[]: field → operator → value
   */
  private serializeWhenOrUnless(key: 'when' | 'unless', block: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent)
    const lines: string[] = []

    if (block === undefined || block === null || block === 'true') {
      // 字符串 'true' 用单引号保留语义，避免 YAML 解析为布尔
      lines.push(`${pad}${key}: 'true'`)
      return lines
    }

    if (typeof block === 'string') {
      lines.push(`${pad}${key}: ${this.q(block)}`)
      return lines
    }

    if (typeof block === 'object' && !Array.isArray(block)) {
      const w = block as Record<string, unknown>

      // SPEC v2.0 §12 权威：when.expr 包裹形态（{ expr: {树} }）
      if ('expr' in w) {
        try {
          const inner = w.expr
          fromSExpr(inner)
          lines.push(`${pad}${key}:`)
          lines.push(`${pad}  expr:`)
          lines.push(...this.serializeSExprTree(inner, indent + 4))
          return lines
        } catch {
          // 不是合法表达式树，走平铺路径
        }
      }

      // §12 Expression 投影面 + 兼容形态：when 顶层即 S-expression 表达式树
      // （不含 conditions / logic / expr 键，尝试按树序列化；失败回退平铺）
      if (!('conditions' in w) && !('logic' in w) && !('expr' in w)) {
        try {
          fromSExpr(w)
          lines.push(`${pad}${key}:`)
          lines.push(...this.serializeSExprTree(w, indent + 2))
          return lines
        } catch {
          // 不是合法 S-expression，走平铺路径
        }
      }

      lines.push(`${pad}${key}:`)
      lines.push(`${pad}  logic: ${this.bare(w.logic ?? 'AND')}`)
      const conds = w.conditions as Array<Record<string, unknown>> | undefined
      if (conds && Array.isArray(conds) && conds.length > 0) {
        lines.push(`${pad}  conditions:`)
        for (const c of conds) {
          lines.push(`${pad}    - field: ${this.q(c.field)}`)
          lines.push(`${pad}      operator: ${this.bare(c.operator ?? 'eq')}`)
          lines.push(`${pad}      value: ${this.serializeValue(c.value)}`)
        }
      }
      return lines
    }

    // 兜底
    lines.push(`${pad}${key}: 'true'`)
    return lines
  }

  /**
   * 递归序列化 S-expression 表达式树为 YAML（键名即节点，子节点内嵌）。
   * 与 toSExpr 的规格一致：
   * - 裸值（number/string/boolean/null）= 叶子，直接用 serializeValue
   * - { field: "path" } / { var: "path" } = field/var 节点
   * - { <op>: [ ...children ] } = 操作节点，子节点数组内联
   * - { <op>: { unit, base, amount } } = 参数化节点（date_add/date_part）
   *
   * 缩进由调用方控制层级；这里逐行返回。
   */
  private serializeSExprTree(node: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent)
    const lines: string[] = []

    // 叶子：裸值
    if (node === null || typeof node !== 'object') {
      lines.push(`${pad}${this.serializeValue(node)}`)
      return lines
    }
    if (Array.isArray(node)) {
      // 子节点数组：每个元素各占一行（列表项）
      for (const child of node) {
        lines.push(...this.serializeSExprTreeListItem(child, indent))
      }
      return lines
    }

    const obj = node as Record<string, unknown>
    const keys = Object.keys(obj)

    // 单字段节点：field / var / 参数化对象
    if (keys.length === 1) {
      const k = keys[0]
      const v = obj[k]

      if (k === 'field' || k === 'var') {
        lines.push(`${pad}${k}: ${this.q(v)}`)
        return lines
      }

      // 参数化节点（date_add / date_part：{ unit, base, amount }/{ unit, arg }）
      // 子节点数组（compare/string/arith/in/between/days_between/quantifier/aggregate 等）
      if (Array.isArray(v)) {
        lines.push(`${pad}${k}:`)
        for (const child of v) {
          lines.push(...this.serializeSExprTreeListItem(child, indent + 2))
        }
        return lines
      }

      if (typeof v === 'object' && v !== null) {
        // 参数化对象（date_add/date_part/quantifier）
        lines.push(`${pad}${k}:`)
        lines.push(...this.serializeParamObject(v as Record<string, unknown>, indent + 2))
        return lines
      }

      // 单键但值为裸值（理论不会到 fromSExpr 合法树，但兜底）
      lines.push(`${pad}${k}: ${this.serializeValue(v)}`)
      return lines
    }

    // 兜底：多键对象（不应出现，按 map 序列化）
    for (const [k, v] of Object.entries(obj)) {
      lines.push(`${pad}${k}: ${this.serializeValue(v)}`)
    }
    return lines
  }

  /**
   * 序列化参数化对象（date_add/date_part/quantifier 的值，如 { unit, base, amount }）。
   * unit/binding 为裸词，其余字段（base/amount/arg）递归序列化，避免 [object Object]。
   */
  private serializeParamObject(inner: Record<string, unknown>, indent: number): string[] {
    const pad = ' '.repeat(indent)
    const lines: string[] = []
    for (const [ik, iv] of Object.entries(inner)) {
      if (ik === 'unit' || ik === 'binding') {
        lines.push(`${pad}${ik}: ${this.bare(iv)}`)
      } else if (typeof iv === 'object' && iv !== null && !Array.isArray(iv)) {
        lines.push(`${pad}${ik}:`)
        lines.push(...this.serializeSExprTree(iv, indent + 2))
      } else if (Array.isArray(iv)) {
        lines.push(`${pad}${ik}:`)
        for (const child of iv) {
          lines.push(...this.serializeSExprTreeListItem(child, indent + 2))
        }
      } else {
        lines.push(`${pad}${ik}: ${this.serializeValue(iv)}`)
      }
    }
    return lines
  }

  /** 列表项序列化：子节点数组里的每个元素（非叶子用 `- <内容>` 形式） */
  private serializeSExprTreeListItem(child: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent)
    const lines: string[] = []

    if (child === null || typeof child !== 'object') {
      // 叶子裸值：`- "value"` / `- 123`
      lines.push(`${pad}- ${this.serializeValue(child)}`)
      return lines
    }

    const obj = child as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 1) {
      const k = keys[0]
      const v = obj[k]
      if (k === 'field' || k === 'var') {
        lines.push(`${pad}- ${k}: ${this.q(v)}`)
        return lines
      }
      if (Array.isArray(v)) {
        lines.push(`${pad}- ${k}:`)
        for (const c of v) {
          lines.push(...this.serializeSExprTreeListItem(c, indent + 2))
        }
        return lines
      }
      if (typeof v === 'object' && v !== null) {
        // 单键 + 值为对象（参数化节点如 date_add/date_part/quantifier）：
        // 直接序列化参数化对象字段，避免 [object Object] 或重复键名
        lines.push(`${pad}- ${k}:`)
        lines.push(...this.serializeParamObject(v as Record<string, unknown>, indent + 2))
        return lines
      }
      lines.push(`${pad}- ${k}: ${this.serializeValue(v)}`)
      return lines
    }

    // 兜底
    lines.push(`${pad}- ${this.serializeValue(child)}`)
    return lines
  }

  /** 序列化 conditions[].value：字符串双引号、数组内字符串双引号、数字/布尔裸词。 */
  private serializeValue(val: unknown): string {
    if (val === undefined || val === null) return '""'
    if (Array.isArray(val)) {
      return `[${val.map((v) => (typeof v === 'string' ? this.q(v) : this.bare(v))).join(', ')}]`
    }
    if (typeof val === 'string') return this.q(val)
    return this.bare(val)
  }

  /** 序列化 explanation/alternative：字符串双引号；{ zh, en } 对象输出为 block map。 */
  private serializeBilingual(key: string, val: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent)
    if (typeof val === 'string') {
      return [`${pad}${key}: ${this.q(val)}`]
    }
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>
      const lines = [`${pad}${key}:`]
      for (const [k, v] of Object.entries(obj)) {
        lines.push(`${pad}  ${k}: ${this.q(v)}`)
      }
      return lines
    }
    return [`${pad}${key}: ${this.q(val)}`]
  }

  // ============================================
  // Private: 标量格式化助手
  // ============================================

  /** 双引号包裹自然语言/标识符字符串，转义 YAML 特殊字符。 */
  private q(val: unknown): string {
    if (val === undefined || val === null) return '""'
    const s = String(val)
    const escaped = s
      .replace(/\\/g, '\\\\') // 反斜杠先转义
      .replace(/"/g, '\\"') // 双引号
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
    return `"${escaped}"`
  }

  /** 裸词（枚举/数字/标识符），不加引号。 */
  private bare(val: unknown): string {
    return String(val)
  }

  /** tags 裸词列表：[tag1, tag2, ...]；空或缺失返回 null（省略该行）。 */
  private serializeTags(val: unknown): string | null {
    if (val === undefined || val === null) return null
    if (Array.isArray(val)) {
      if (val.length === 0) return null
      return `[${val.map((v) => this.bare(v)).join(', ')}]`
    }
    return this.bare(val)
  }

  /**
   * 规范化 override：boolean → string，legacy 值 → canonical。
   */
  private normalizeOverride(val: unknown): string | undefined {
    if (val === true) return 'high'
    if (val === false || val === null || val === undefined) return undefined
    const s = String(val)
    if (['critical', 'high', 'normal', 'low'].includes(s)) return s
    if (s === 'true') return 'high'
    return undefined
  }
}
