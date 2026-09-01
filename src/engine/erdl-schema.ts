/**
 * erdl-schema — ERDL 确定性内核的**单一事实源**（SPEC v2.0 权威枚举）
 *
 * 立此文件的原因（2026-08-28 对账实测）：运算符/决策枚举此前散落 6 处、4 个不同的值，
 * 互相漂移——内核支持 30 运算符，校验器只放行 13，UI 只显示 13，法规入口校验 15，
 * LLM prompt 只被告知 6。确定性内核有多份定义，"确定性"即名存实亡。
 *
 * 本文件是这些枚举的唯一权威来源：**类型由常量派生**（`typeof X[number]`），
 * 不允许在别处再写一份联合类型或字符串数组。所有消费方 MUST import 本文件。
 *
 * 权威锚点（SPEC 母本 erdl-spec-v2.0.md）：
 *  - §11.1 L1250-1264：30 运算符 = 28 条件运算符 + 2 条件修饰符
 *  - §11.4 L1283-1304：28 条件运算符 → 表达式树编译映射（13 直接 + 6 not 派生 + 9 length/count 组合）
 *  - §27.5 L1820-1836：13 种基础决策类型（result.decision 取值域）
 *  - §10.1 L1059-1076：34 语义节点（10 组，FREEZE-2）
 *
 * 冻结等级：运算符集/节点集为 `[FREEZE-2]`（可增不可改语义）；13 决策取值域随 DO 进审计链。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-28
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════
// 一、运算符（SPEC §11.1：28 条件 + 2 修饰符 = 30）
// ═══════════════════════════════════════════════════════════════

/** 比较族 6（§11.1） */
export const OP_COMPARE = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] as const
/** 列表族 2 */
export const OP_LIST = ['in', 'not_in'] as const
/** 字符串族 5 */
export const OP_STRING = ['contains', 'not_contains', 'match', 'starts_with', 'ends_with'] as const
/** 边界否定族 2 */
export const OP_BOUNDARY_NEG = ['not_starts_with', 'not_ends_with'] as const
/** 存在性族 2（唯一可感知字段缺失的算子） */
export const OP_EXISTENCE = ['exists', 'not_exists'] as const
/** 长度族 5 */
export const OP_LENGTH = ['length_gt', 'length_gte', 'length_lt', 'length_lte', 'length_eq'] as const
/** 范围族 2 */
export const OP_RANGE = ['between', 'not_between'] as const
/** 计数族 4 */
export const OP_COUNT = ['count_gt', 'count_gte', 'count_lt', 'count_lte'] as const

/** 28 个条件运算符（编译进表达式树求值，§11.4） */
export const CONDITION_OPERATORS = [
  ...OP_COMPARE, ...OP_LIST, ...OP_STRING, ...OP_BOUNDARY_NEG,
  ...OP_EXISTENCE, ...OP_LENGTH, ...OP_RANGE, ...OP_COUNT,
] as const

/**
 * 2 个条件修饰符（有状态算子，状态在树外由 GuardStateManager 维护，
 * 窗口计数以 `evaluation.temporal_state` 进 DO，见 RFC-002 §2.4）。
 * 真值语义（2026-08-27 定案）：计数达阈值 → 触发；未达 → record + 放行。
 *  - rate  = 限流：前 N 次放行并计数，第 N+1 次起触发（nginx limit_req / Redis INCR 语义）
 *  - within = rate 的阈值 1 版：首次放行并 record，窗口内第 2 次起触发（去重）
 */
export const CONDITION_MODIFIERS = ['within', 'rate'] as const

/** 30 个语义单元全集（28 条件 + 2 修饰符） */
export const ALL_OPERATORS = [...CONDITION_OPERATORS, ...CONDITION_MODIFIERS] as const

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]
export type ConditionModifier = (typeof CONDITION_MODIFIERS)[number]
export type AnyOperator = (typeof ALL_OPERATORS)[number]

/**
 * 运算符的**值形态**（2026-08-28 全量 review 新增）。
 *
 * 为何必需：模板式创作与 UI 下拉只能提供「值形态匹配」的运算符。
 * 例：模板的 value 是标量输入框，若下拉里出现 between（需 [min,max] 二元数组），
 * 用户选了就会在编译期报「between 需要 [min, max] 数组」——能选但必错。
 * 值形态以前只存在于人读文档的表格里，现在进单一事实源，供 UI / 校验器 / LLM prompt 共用。
 */
export const OP_VALUE_NONE = ['exists', 'not_exists'] as const
export const OP_VALUE_ARRAY = ['in', 'not_in'] as const
export const OP_VALUE_TUPLE = ['between', 'not_between'] as const
/** 值为标量（数值/字符串/布尔/正则）的运算符 = 28 减去上述三类 */
export const OP_VALUE_SCALAR = CONDITION_OPERATORS.filter(
  (op) => !(OP_VALUE_NONE as readonly string[]).includes(op)
    && !(OP_VALUE_ARRAY as readonly string[]).includes(op)
    && !(OP_VALUE_TUPLE as readonly string[]).includes(op),
) as readonly ConditionOperator[]

export type OperatorValueShape = 'none' | 'scalar' | 'array' | 'tuple'

/** 某运算符的 value 应为何种形态 */
export function operatorValueShape(op: string): OperatorValueShape | null {
  if ((OP_VALUE_NONE as readonly string[]).includes(op)) return 'none'
  if ((OP_VALUE_ARRAY as readonly string[]).includes(op)) return 'array'
  if ((OP_VALUE_TUPLE as readonly string[]).includes(op)) return 'tuple'
  if ((CONDITION_OPERATORS as readonly string[]).includes(op)) return 'scalar'
  return null
}

/**
 * 宽容解析别名（历史兼容，非新增运算符）。
 * 归一后必须落在 CONDITION_OPERATORS 内；SPEC 母本尚未登记这两个别名（待回写，见对账 O1）。
 */
export const OPERATOR_ALIASES: Readonly<Record<string, ConditionOperator>> = Object.freeze({
  matches: 'match',
  neq: 'ne',
})

/** §11.4 编译归宿分类（用于向量与文档自证"无悬空"） */
export const OP_COMPILE_DIRECT = [
  ...OP_COMPARE, 'in', 'contains', 'starts_with', 'ends_with', 'match', 'exists', 'between',
] as const
export const OP_COMPILE_VIA_NOT = [
  'not_in', 'not_contains', 'not_starts_with', 'not_ends_with', 'not_exists', 'not_between',
] as const
export const OP_COMPILE_VIA_LENGTH_COUNT = [...OP_LENGTH, ...OP_COUNT] as const

export function isConditionOperator(v: unknown): v is ConditionOperator {
  return typeof v === 'string' && (CONDITION_OPERATORS as readonly string[]).includes(v)
}

/** 归一运算符（含别名）；非法返回 null */
export function normalizeOperatorName(op: string | undefined | null): ConditionOperator | null {
  if (!op) return null
  const mapped = OPERATOR_ALIASES[op] ?? op
  return isConditionOperator(mapped) ? mapped : null
}

// ═══════════════════════════════════════════════════════════════
// 二、决策（SPEC §27.5：13 种基础决策 = DO result.decision 取值域）
// ═══════════════════════════════════════════════════════════════

/** 13 种基础决策类型（**唯一** 可进 DO `result.decision` 的取值域，§27.5 权威枚举） */
export const DO_DECISIONS = [
  'ALLOW', 'DENY', 'CORRECT', 'NOTIFY', 'REQUEST_HUMAN', 'ESCALATE', 'DELEGATE',
  'DEFER', 'EMERGENCY_HALT', 'ROLLBACK', 'QUARANTINE', 'WORKFLOW', 'GUIDE',
] as const

/** WORKFLOW 状态机子态（非独立决策类型，不计入 13） */
export const WORKFLOW_SUBSTATES = ['WORKFLOW_WAITING', 'WORKFLOW_PROGRESS'] as const
/** 4 内部推理动作（不进 DO） */
export const INTERNAL_REASONING = ['STRATEGIZE', 'AUDIT', 'CALCULATE', 'VALIDATE'] as const
/** 内部状态（不进 DO） */
export const INTERNAL_STATES = ['PASS'] as const
/** rulsynor 扩展（后置审查管线，不在 SPEC 13 内） */
export const RULSYNOR_EXTENSIONS = ['CENSOR'] as const

/** 引擎内部可流转的全部决策标识（21 = 13 + 2 子态 + 4 内部推理 + 1 内部态 + 1 扩展） */
export const ALL_DECISIONS = [
  ...DO_DECISIONS, ...WORKFLOW_SUBSTATES, ...INTERNAL_REASONING, ...INTERNAL_STATES, ...RULSYNOR_EXTENSIONS,
] as const

/**
 * Guard 规则允许的决策子集（2026-08-28 review 收口：原为 rule-validator 内的本地数组）。
 * = Ring 0-2 动作 + Ring 3 例外（ALLOW/CORRECT）。内部推理动作（STRATEGIZE 等）不得进 Guard。
 */
export const GUARD_ALLOWED_DECISIONS = [
  'DENY', 'EMERGENCY_HALT',            // Ring 0
  'ROLLBACK', 'QUARANTINE',            // Ring 1
  'REQUEST_HUMAN', 'ESCALATE', 'DELEGATE', // Ring 2
  'CORRECT', 'ALLOW',                  // Ring 3 例外
] as const

/** 拦截性决策（质量门禁 wild-when-with-blocking-then 等据此判定） */
export const BLOCKING_DECISIONS = ['DENY', 'CORRECT', 'REQUEST_HUMAN', 'EMERGENCY_HALT'] as const

export type DODecision = (typeof DO_DECISIONS)[number]
export type Decision = (typeof ALL_DECISIONS)[number]

/** 能否进 DO 的 result.decision（§27.5 取值域门禁） */
export function isDODecision(v: unknown): v is DODecision {
  return typeof v === 'string' && (DO_DECISIONS as readonly string[]).includes(v)
}
export function isDecision(v: unknown): v is Decision {
  return typeof v === 'string' && (ALL_DECISIONS as readonly string[]).includes(v)
}

// ═══════════════════════════════════════════════════════════════
// 三、规则分类
// ═══════════════════════════════════════════════════════════════

/**
 * 规则分类（ADR-001，2026-08-28）：共 11 类。
 * `observability` 于 2026-08-28 补入——调研实测它已在 5 处代码（校验器/序列化器/导入/模板/前端）
 * 与 1 条存量规则中使用，内核类型缺它才是漂移方；分类枚举不在 FREEZE-2 冻结项，可增。
 */
export const RULE_CATEGORIES = [
  'coding', 'engineering', 'security', 'writing', 'design',
  'performance', 'testing', 'compliance', 'accessibility', 'observability', 'custom',
] as const
export type RuleCategory = (typeof RULE_CATEGORIES)[number]

/**
 * 规则名 CAT 前缀登记表（ADR-003，注册制可扩展，非封闭集）。
 * 前缀 → 归属分类。新增业务域前缀 MUST 先登记在此并同步 SPEC，禁止「先用后补」。
 * 命名门禁无条件校验本表（历史实现只在正则失配时才查，致白名单形同虚设，已修）。
 */
export const RULE_NAME_PREFIXES: Readonly<Record<string, RuleCategory>> = Object.freeze({
  SEC: 'security',
  COD: 'coding',
  ENG: 'engineering',
  PRF: 'performance',
  TST: 'testing',
  WRT: 'writing',
  OBS: 'observability',
  CUS: 'custom',
  ETH: 'compliance',   // Ethics
  CMP: 'compliance',   // Compliance
  POL: 'compliance',   // Policy
  OCC: 'custom',       // Occupation
  CNV: 'writing',      // Convention
  SBP: 'compliance',   // Soil & water conservation Balance Plan（水土保持，106 条存量，ADR-003 补登记）
})

/**
 * 岗位分类（ADR-004）——与规则分类是两个独立的域（岗位 = 组织角色分类）。
 * 当前存量仅 `review`；新增走登记制，岗位装配时校验。
 */
export const OCCUPATION_CATEGORIES = ['review'] as const
export type OccupationCategory = (typeof OCCUPATION_CATEGORIES)[number]

// ═══════════════════════════════════════════════════════════════
// 四、34 语义节点（SPEC §10.1，FREEZE-2）— 逐组可数，禁悬空
// ═══════════════════════════════════════════════════════════════

/**
 * 34 语义节点按 10 组逐组列举。与 `expr-tree/node-types.ts` 的 20 个判别式 type
 * 是"语义节点 ↔ 类型投影"关系（参数化节点合并），非数量矛盾（§10.1 原文）。
 */
export const SEMANTIC_NODES = Object.freeze({
  取值: ['field', 'var', 'literal'],
  逻辑: ['and', 'or', 'not'],
  比较: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  集合: ['in'],
  字符串: ['contains', 'match', 'starts_with', 'ends_with'],
  存在量纲: ['exists', 'length', 'between'],
  量词: ['all', 'any', 'none'],
  算术: ['add', 'sub', 'mul', 'div', 'round'],
  时间: ['days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day'],
  聚合: ['aggregate'],
}) as Readonly<Record<string, readonly string[]>>

/** 34 语义节点扁平清单 */
export const SEMANTIC_NODE_NAMES: readonly string[] = Object.freeze(Object.values(SEMANTIC_NODES).flat())

/** 表达式树判别式 type 全集（20，node-types.ts 的 ExprNode['type']） */
export const EXPR_NODE_TYPES = [
  'field', 'var', 'literal', 'and', 'or', 'not', 'compare', 'in', 'string',
  'exists', 'length', 'between', 'quantifier', 'arith',
  'days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day', 'aggregate',
] as const

// ═══════════════════════════════════════════════════════════════
// 五、自证常量（供文档/prompt/测试引用，杜绝手写数字漂移）
// ═══════════════════════════════════════════════════════════════

export const SCHEMA_COUNTS = Object.freeze({
  conditionOperators: CONDITION_OPERATORS.length, // 28
  conditionModifiers: CONDITION_MODIFIERS.length, // 2
  allOperators: ALL_OPERATORS.length,             // 30
  doDecisions: DO_DECISIONS.length,               // 13
  allDecisions: ALL_DECISIONS.length,             // 21
  semanticNodes: SEMANTIC_NODE_NAMES.length,      // 34
  exprNodeTypes: EXPR_NODE_TYPES.length,          // 20
  ruleCategories: RULE_CATEGORIES.length,         // 11（ADR-001）
  ruleNamePrefixes: Object.keys(RULE_NAME_PREFIXES).length, // 14（ADR-003）
  occupationCategories: OCCUPATION_CATEGORIES.length,       // 1（ADR-004）
})

/** SPEC 对齐基线（改动本文件必须同步核对 SPEC 母本行号） */
export const SPEC_BASELINE = Object.freeze({
  spec: 'erdl-spec-v2.0',
  operators: '§11.1 L1250-1264 / §11.4 L1283-1304',
  decisions: '§27.5 L1820-1836',
  nodes: '§10.1 L1059-1076',
  temporalSemantics: 'RFC-002 §2.4 + 语义定案 2026-08-27',
})
