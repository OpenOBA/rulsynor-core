/**
 * Rule Template Engine — 12 templates that produce deterministic SPEC v2.0 §11 YAML.
 *
 * Each template is a pure function with strictly-typed parameters.
 * Template functions are the ONLY way to produce SPEC v2.0 §11 YAML from user input.
 * The engine guarantees 100% output correctness through type checking + validation.
 *
 * Design invariant: YAML output is always valid because the template functions
 * construct the object graph; yaml.dump is deterministic given the same input.
 *
 * Context fields: Templates accept any valid SPEC v2.0 §11 context field name
 * (tool.name, sem.code, sem.sub_code, project.*, task.*, etc.) as the `field` parameter.
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-07-17
 */

import { RuleYamlSerializer, type ExtractedSpec5 } from './rule-yaml-serializer.js'

// ============================================
// Types
// ============================================

export type TemplateId =
  | 'toolInList'          // T1: tool.name ∈ [A, B, C]
  | 'toolInAndMatch'      // T2: tool.name ∈ [...] AND content ~= /pat/
  | 'toolEqAndCmd'        // T3: tool.name = X AND args.command ~= /pat/
  | 'toolEq'              // T4: tool.name = X
  | 'fieldCompare'        // T5: field {=,≠,>,<,≥,≤} value
  | 'fieldInList'         // T6: field ∈ [A, B]
  | 'twoFieldAnd'         // T7: f1 op1 v1 AND f2 op2 v2
  | 'twoFieldOr'          // T8: f1 op1 v1 OR f2 op2 v2
  | 'fieldInAndCompare'   // T9: f1 ∈ [...] AND f2 op v
  | 'fieldExists'         // T10: field EXISTS / NOT EXISTS
  | 'fieldMatch'          // T11: field ~= /pattern/
  | 'fieldContains'       // T12: field contains substring

export type TemplateParamType = 'toolNames' | 'field' | 'operator' | 'value' | 'pattern' | 'list' | 'boolean' | 'decision'

export interface TemplateParam {
  key: string
  label: string
  labelEn: string
  type: TemplateParamType
  required: boolean
  placeholder?: string
  description?: string
}

export interface TemplateDef {
  id: TemplateId
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  icon: string
  params: TemplateParam[]
  /** Human-language example sentence */
  sentence: string
  sentenceEn: string
}

export type OperatorComparison = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
export type OperatorSet = 'in' | 'not_in'
export type OperatorText = 'contains' | 'not_contains'
export type OperatorMatch = 'match'
export type OperatorExist = 'exists' | 'not_exists'
export type AllOperators = OperatorComparison | OperatorSet | OperatorText | OperatorMatch | OperatorExist

export type Decision = 'ALLOW' | 'DENY' | 'CORRECT' | 'REQUEST_HUMAN' | 'EMERGENCY_HALT'

export interface TemplateInput {
  templateId: TemplateId
  ruleName: string
  decision: Decision
  message: string
  priority: number
  category: string
  /** Template-specific parameters */
  params: Record<string, unknown>
  /** Optional bilingual explanation */
  explanation?: string | { zh: string; en: string }
  /** Optional alternative suggestion */
  alternative?: string | { zh: string; en: string }
}

export interface TemplateOutput {
  yaml: string
  ruleObject: Record<string, unknown>
  success: boolean
  error?: string
}

// ============================================
// Template Registry
// ============================================

// 2026-08-28 收口：原仅 13 个标签，导致前端下拉只能选内核 28 个运算符中的 13 个。
// 现覆盖全部 28 条件运算符 + 2 修饰符；erdl-schema.spec 断言「每个运算符都有标签」，缺一即红。
import { CONDITION_OPERATORS, CONDITION_MODIFIERS, OP_COMPARE, OP_VALUE_SCALAR } from './erdl-schema.js'

const COMPARISON_OP_LABELS: Record<string, { zh: string; en: string }> = {
  // 比较 6
  'eq': { zh: '等于 (=)', en: 'equals (=)' },
  'ne': { zh: '不等于 (≠)', en: 'not equals (≠)' },
  'gt': { zh: '大于 (>)', en: 'greater than (>)' },
  'gte': { zh: '大于等于 (≥)', en: 'greater than or equal (≥)' },
  'lt': { zh: '小于 (<)', en: 'less than (<)' },
  'lte': { zh: '小于等于 (≤)', en: 'less than or equal (≤)' },
  'in': { zh: '在列表中 (∈)', en: 'in list (∈)' },
  'not_in': { zh: '不在列表中 (∉)', en: 'not in list (∉)' },
  'contains': { zh: '包含', en: 'contains' },
  'not_contains': { zh: '不包含', en: 'not contains' },
  'match': { zh: '匹配正则', en: 'matches regex' },
  'exists': { zh: '存在', en: 'exists' },
  'not_exists': { zh: '不存在', en: 'not exists' },
  // 边界否定 2
  'starts_with': { zh: '以…开头', en: 'starts with' },
  'ends_with': { zh: '以…结尾', en: 'ends with' },
  'not_starts_with': { zh: '不以…开头', en: 'not starts with' },
  'not_ends_with': { zh: '不以…结尾', en: 'not ends with' },
  // 长度 5（Unicode 码点计数）
  'length_gt': { zh: '长度大于', en: 'length >' },
  'length_gte': { zh: '长度大于等于', en: 'length >=' },
  'length_lt': { zh: '长度小于', en: 'length <' },
  'length_lte': { zh: '长度小于等于', en: 'length <=' },
  'length_eq': { zh: '长度等于', en: 'length =' },
  // 范围 2（闭区间，仅数值）
  'between': { zh: '在区间内 [min,max]', en: 'between [min,max]' },
  'not_between': { zh: '不在区间内', en: 'not between' },
  // 计数 4（数组元素数）
  'count_gt': { zh: '元素数大于', en: 'count >' },
  'count_gte': { zh: '元素数大于等于', en: 'count >=' },
  'count_lt': { zh: '元素数小于', en: 'count <' },
  'count_lte': { zh: '元素数小于等于', en: 'count <=' },
  // 修饰符 2（有状态算子，写在 condition 的 within/rate 字段，不是 operator 取值）
  'within': { zh: '时间窗口内去重（修饰符）', en: 'within window (modifier)' },
  'rate': { zh: '速率限制（修饰符）', en: 'rate limit (modifier)' },
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'toolInList',
    name: '工具名在列表中',
    nameEn: 'Tool name in list',
    icon: '🔧',
    description: '当 Agent 调用的工具名在指定列表时触发',
    descriptionEn: 'Fires when the tool name is in a specified list',
    sentence: '当(when) Agent 调用的工具 在 [列表] 中 → 应当(then) [执行动作]',
    sentenceEn: 'when tool name ∈ [list] → then [action]',
    params: [
      { key: 'toolNames', label: '工具名称', labelEn: 'Tool Names', type: 'toolNames', required: true, placeholder: '选择工具…', description: '选择要拦截/放行的工具名' },
    ],
  },
  {
    id: 'toolInAndMatch',
    name: '工具名在列表中 + 内容匹配',
    nameEn: 'Tool in list + content match',
    icon: '🔧🔍',
    description: '当工具名在列表中 且 内容匹配正则时触发',
    descriptionEn: 'Fires when tool name is in list AND content matches pattern',
    sentence: '当(when) 工具 在 [列表] 中 且 内容 匹配 /正则/ → 应当(then) [执行动作]',
    sentenceEn: 'when tool ∈ [list] AND content ~= /pattern/ → then [action]',
    params: [
      { key: 'toolNames', label: '工具名称', labelEn: 'Tool Names', type: 'toolNames', required: true },
      { key: 'matchPattern', label: '匹配正则', labelEn: 'Match Pattern', type: 'pattern', required: true, placeholder: '例如: \\bany\\b 或 eval\\(', description: '正则表达式，用于匹配工具参数内容' },
    ],
  },
  {
    id: 'toolEqAndCmd',
    name: '工具名等于 + 命令匹配',
    nameEn: 'Tool equals + command match',
    icon: '💻',
    description: '当具体的工具 且 命令参数匹配正则时触发',
    descriptionEn: 'Fires when a specific tool AND its command args match',
    sentence: '当(when) 工具 = [名称] 且 命令 匹配 /正则/ → 应当(then) [执行动作]',
    sentenceEn: 'when tool = [name] AND command ~= /pattern/ → then [action]',
    params: [
      { key: 'toolName', label: '工具名称', labelEn: 'Tool Name', type: 'field', required: true, placeholder: '例如: exec' },
      { key: 'matchPattern', label: '命令正则', labelEn: 'Command Pattern', type: 'pattern', required: true, placeholder: '例如: git stash' },
    ],
  },
  {
    id: 'toolEq',
    name: '工具名等于',
    nameEn: 'Tool name equals',
    icon: '🎯',
    description: '当 Agent 调用指定的工具时触发',
    descriptionEn: 'Fires when the tool name equals a specific value',
    sentence: '当(when) 工具 = [名称] → 应当(then) [执行动作]',
    sentenceEn: 'when tool = [name] → then [action]',
    params: [
      { key: 'toolName', label: '工具名称', labelEn: 'Tool Name', type: 'field', required: true, placeholder: '例如: exec' },
    ],
  },
  {
    id: 'fieldCompare',
    name: '字段比较',
    nameEn: 'Field comparison',
    icon: '📊',
    description: '当指定字段的值满足比较条件时触发',
    descriptionEn: 'Fires when a field value satisfies comparison',
    sentence: '当(when) [字段] [比较符] [值] → 应当(then) [执行动作]',
    sentenceEn: 'when [field] [operator] [value] → then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: amount 或 sem.code', description: 'SPEC v2.0 §11 上下文字段。例如: tool.name, sem.code, amount' },
      { key: 'operator', label: '比较符', labelEn: 'Operator', type: 'operator', required: true },
      { key: 'value', label: '值', labelEn: 'Value', type: 'value', required: true, placeholder: '例如: 100' },
    ],
  },
  {
    id: 'fieldInList',
    name: '字段在列表中',
    nameEn: 'Field in list',
    icon: '📋',
    description: '当字段值在指定列表中时触发',
    descriptionEn: 'Fires when a field value is in a list',
    sentence: '当(when) [字段] ∈ [列表] → 应当(then) [执行动作]',
    sentenceEn: 'when [field] ∈ [list] → then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: status 或 sem.code', description: 'SPEC v2.0 §11 上下文字段' },
      { key: 'values', label: '值列表', labelEn: 'Values', type: 'list', required: true, placeholder: '一行一个值…', description: '每行一个值' },
    ],
  },
  {
    id: 'twoFieldAnd',
    name: '两个字段组合 (AND)',
    nameEn: 'Two fields combined (AND)',
    icon: '🔗',
    description: '当两个字段都满足各自的条件时触发',
    descriptionEn: 'Fires when BOTH fields satisfy their conditions',
    sentence: '当(when) [字段1] [比较符1] [值1] 且 [字段2] [比较符2] [值2] → 应当(then) [执行动作]',
    sentenceEn: 'when [field1] [op1] [val1] AND [field2] [op2] [val2] → then [action]',
    params: [
      { key: 'field1', label: '字段 1', labelEn: 'Field 1', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'operator1', label: '比较符 1', labelEn: 'Operator 1', type: 'operator', required: true },
      { key: 'value1', label: '值 1', labelEn: 'Value 1', type: 'value', required: true },
      { key: 'field2', label: '字段 2', labelEn: 'Field 2', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'operator2', label: '比较符 2', labelEn: 'Operator 2', type: 'operator', required: true },
      { key: 'value2', label: '值 2', labelEn: 'Value 2', type: 'value', required: true },
    ],
  },
  {
    id: 'twoFieldOr',
    name: '两个字段组合 (OR)',
    nameEn: 'Two fields combined (OR)',
    icon: '🔀',
    description: '当两个字段中任意一个满足条件时触发',
    descriptionEn: 'Fires when EITHER field satisfies its condition',
    sentence: '当(when) [字段1] [比较符1] [值1] 或 [字段2] [比较符2] [值2] → 应当(then) [执行动作]',
    sentenceEn: 'when [field1] [op1] [val1] OR [field2] [op2] [val2] → then [action]',
    params: [
      { key: 'field1', label: '字段 1', labelEn: 'Field 1', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'operator1', label: '比较符 1', labelEn: 'Operator 1', type: 'operator', required: true },
      { key: 'value1', label: '值 1', labelEn: 'Value 1', type: 'value', required: true },
      { key: 'field2', label: '字段 2', labelEn: 'Field 2', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'operator2', label: '比较符 2', labelEn: 'Operator 2', type: 'operator', required: true },
      { key: 'value2', label: '值 2', labelEn: 'Value 2', type: 'value', required: true },
    ],
  },
  {
    id: 'fieldInAndCompare',
    name: '字段在列表中 + 比较',
    nameEn: 'Field in list + comparison',
    icon: '📊📋',
    description: '当字段值在列表中 且 另一个字段满足比较条件时触发',
    descriptionEn: 'Fires when one field is in a list AND another satisfies comparison',
    sentence: '当(when) [字段1] ∈ [列表] 且 [字段2] [比较符] [值] → 应当(then) [执行动作]',
    sentenceEn: 'when [field1] ∈ [list] AND [field2] [op] [val] → then [action]',
    params: [
      { key: 'field1', label: '列表字段', labelEn: 'List Field', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'values', label: '值列表', labelEn: 'Values', type: 'list', required: true },
      { key: 'field2', label: '比较字段', labelEn: 'Compare Field', type: 'field', required: true, description: 'SPEC v2.0 §11 field' },
      { key: 'operator', label: '比较符', labelEn: 'Operator', type: 'operator', required: true },
      { key: 'value', label: '值', labelEn: 'Value', type: 'value', required: true },
    ],
  },
  {
    id: 'fieldExists',
    name: '字段是否存在',
    nameEn: 'Field exists',
    icon: '✅',
    description: '当字段存在（或不存在）时触发',
    descriptionEn: 'Fires when a field exists (or does not exist)',
    sentence: '当(when) [字段] 存在/不存在 时 → 应当(then) [执行动作]',
    sentenceEn: 'when [field] exists / not exists → then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: approval_id' },
      { key: 'exists', label: '存在/不存在', labelEn: 'Exists?', type: 'boolean', required: true },
    ],
  },
  {
    id: 'fieldMatch',
    name: '字段匹配正则',
    nameEn: 'Field matches regex',
    icon: '🔍',
    description: '当字段值匹配正则表达式时触发',
    descriptionEn: 'Fires when field value matches a regex pattern',
    sentence: '当(when) [字段] 匹配 /正则/ → 应当(then) [执行动作]',
    sentenceEn: 'when [field] ~= /pattern/ → then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: code' },
      { key: 'pattern', label: '正则', labelEn: 'Pattern', type: 'pattern', required: true, placeholder: '^[A-Z]{2}-\\d{4}$' },
    ],
  },
  {
    id: 'fieldContains',
    name: '字段包含子串',
    nameEn: 'Field contains substring',
    icon: '🔎',
    description: '当字段值包含指定子串时触发',
    descriptionEn: 'Fires when a field value contains a substring',
    sentence: '当(when) [字段] 包含 [子串] → 应当(then) [执行动作]',
    sentenceEn: 'when [field] contains [substring] → then [action]',
    params: [
      { key: 'field', label: '字段名', labelEn: 'Field', type: 'field', required: true, placeholder: '例如: title' },
      { key: 'value', label: '子串', labelEn: 'Substring', type: 'value', required: true, placeholder: '例如: 紧急' },
    ],
  },
]

// ============================================
// Template Engine
// ============================================

export class TemplateEngine {
  /** Get all template definitions (for building the UI) */
  getTemplates(): TemplateDef[] {
    return TEMPLATES
  }

  /** Get a specific template by ID */
  getTemplate(id: TemplateId): TemplateDef | undefined {
    return TEMPLATES.find((t) => t.id === id)
  }

  /**
   * 运算符标签（UI operator 下拉数据源）。
   *
   * 2026-08-28 全量 review 修复：本方法原样返回 COMPARISON_OP_LABELS（含 within/rate 共 30 键），
   * 导致 UI 把「修饰符」当 operator 供选，而校验器 VALID_ALL_OPS 只放行 28 个条件运算符
   * → 用户一选必被拒。现只暴露 28 个条件运算符，**与校验器放行域严格一致**。
   */
  getOperatorLabels(): Record<string, { zh: string; en: string }> {
    const out: Record<string, { zh: string; en: string }> = {}
    for (const op of CONDITION_OPERATORS) {
      const l = COMPARISON_OP_LABELS[op]
      if (l) out[op] = l
    }
    return out
  }


  /**
   * 每个模板的**运算符可选域**（2026-08-28 全量 review 新增）。
   *
   * 缺陷背景：UI 对所有模板统一渲染全量运算符下拉，而校验器对 fieldCompare /
   * fieldInAndCompare 只放行 6 个比较符 → 用户选了其余必被拒；而 twoFieldAnd/Or 虽放行 28，
   * 但模板的 value 是标量输入，选 in/between 类会在编译期报错。
   * 因此可选域 = 校验器放行域 ∩ 模板 value 形态能表达的运算符。
   */
  getTemplateOperatorDomains(): Record<string, readonly string[]> {
    return {
      // 校验器：checkComparisonOp → 仅 6 个比较符
      fieldCompare: OP_COMPARE,
      fieldInAndCompare: OP_COMPARE,
      // 校验器：checkAllOp → 28 全集；但模板 value 为标量 → 取标量形态子集
      twoFieldAnd: OP_VALUE_SCALAR,
      twoFieldOr: OP_VALUE_SCALAR,
    }
  }

  /**
   * 修饰符标签（within/rate）。它们**不是 operator 取值**，而是 condition 的独立字段，
   * UI 应在 condition 的 within/rate 字段位置使用本表，不得混进 operator 下拉。
   */
  getModifierLabels(): Record<string, { zh: string; en: string }> {
    const out: Record<string, { zh: string; en: string }> = {}
    for (const m of CONDITION_MODIFIERS) {
      const l = COMPARISON_OP_LABELS[m]
      if (l) out[m] = l
    }
    return out
  }

  /**
   * Generate SPEC v2.0 §11 YAML from template parameters.
   *
   * Uses RuleYamlSerializer for deterministic SPEC v2.0 §11 F1-F8 output
   * (template assembly, not yaml.dump).
   */
  generate(input: TemplateInput): TemplateOutput {
    const tpl = this.getTemplate(input.templateId)
    if (!tpl) {
      return { yaml: '', ruleObject: {}, success: false, error: `Unknown template: ${input.templateId}` }
    }

    try {
      const data = this.buildSpec5(input)

      // Use RuleYamlSerializer for deterministic SPEC v2.0 §11 F1-F8 output
      const serializer = new RuleYamlSerializer('.') // dir unused by serializeSpec5
      const yamlStr = serializer.serializeSpec5(data)

      return { yaml: yamlStr, ruleObject: data as unknown as Record<string, unknown>, success: true }
    } catch (err) {
      return {
        yaml: '', ruleObject: {}, success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // ============================================
  // Private: Build SPEC v2.0 §11 data structure (delegates YAML to RuleYamlSerializer)
  // ============================================

  private buildSpec5(input: TemplateInput): ExtractedSpec5 {
    const conditions = this.buildConditions(input.templateId, input.params)

    const rule: Record<string, unknown> = {
      name: input.ruleName,
      description: `Rule generated from template: ${input.templateId}`,
      priority: input.priority,
      ring: this.ringForPriority(input.priority),
      when: conditions.length === 0 ? 'true' : {
        logic: this.isOrTemplate(input.templateId) ? 'OR' : 'AND',
        conditions,
      },
      then: input.decision,
      message: input.message,
    }

    // Computed override from priority (Ring 0 = critical, Ring 1 = high)
    if (input.priority <= 2) rule.override = 'critical'
    else if (input.priority <= 5) rule.override = 'high'

    if (input.explanation) rule.explanation = input.explanation
    if (input.alternative) rule.alternative = input.alternative

    return {
      protocol: 'erdl/v2',
      version: '2.0.0',
      metadata: {
        name: input.ruleName,
        description: `Rule generated from template: ${input.templateId}`,
        category: input.category,
        decision: input.decision,
        tags: [input.category],
      },
      rules: [rule],
    }
  }

  private ringForPriority(priority: number): number {
    if (priority <= 2) return 0
    if (priority <= 5) return 1
    if (priority <= 20) return 2
    return 3
  }

  private isOrTemplate(id: TemplateId): boolean {
    return id === 'twoFieldOr'
  }

  private buildConditions(
    id: TemplateId,
    params: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const p = params

    switch (id) {
      case 'toolInList':
        return [{ field: 'tool.name', operator: 'in', value: p.toolNames }]

      case 'toolInAndMatch':
        return [
          { field: 'tool.name', operator: 'in', value: p.toolNames },
          { field: 'tool.args', operator: 'match', value: p.matchPattern },
        ]

      case 'toolEqAndCmd':
        return [
          { field: 'tool.name', operator: 'eq', value: p.toolName },
          { field: 'tool.args.command', operator: 'match', value: p.matchPattern },
        ]

      case 'toolEq':
        return [{ field: 'tool.name', operator: 'eq', value: p.toolName }]

      case 'fieldCompare':
        return [{ field: p.field, operator: p.operator, value: p.value }]

      case 'fieldInList':
        return [{ field: p.field, operator: 'in', value: p.values }]

      case 'twoFieldAnd':
        return [
          { field: p.field1, operator: p.operator1, value: p.value1 },
          { field: p.field2, operator: p.operator2, value: p.value2 },
        ]

      case 'twoFieldOr':
        return [
          { field: p.field1, operator: p.operator1, value: p.value1 },
          { field: p.field2, operator: p.operator2, value: p.value2 },
        ]

      case 'fieldInAndCompare':
        return [
          { field: p.field1, operator: 'in', value: p.values },
          { field: p.field2, operator: p.operator, value: p.value },
        ]

      case 'fieldExists':
        return [{ field: p.field, operator: p.exists ? 'exists' : 'not_exists' }]

      case 'fieldMatch':
        return [{ field: p.field, operator: 'match', value: p.pattern }]

      case 'fieldContains':
        return [{ field: p.field, operator: 'contains', value: p.value }]

      default:
        return []
    }
  }
}

/** Singleton */
export const templateEngine = new TemplateEngine()
