/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATCF V2.0 — Agent Training & Compliance Framework
 * Official Interface Definitions (Source of Truth)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Extracted from: atcf-v2.0.md
 * Source: Rulsynor ATCF V2.0 Architecture Document
 * Author: 唐浩然 (OpenOBA AI 执行官)
 * Date: 2026-08-01
 * Status: 架构提案 V2.1 — 经 Henry 确认，本方案为最终架构方案
 *
 * This file contains PURE TypeScript interface, enum, and type definitions.
 * All implementation code has been removed; only signatures and type shapes remain.
 * Generated for @rulsynor/core.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// Module: External Type Stubs
// ═══════════════════════════════════════════════════════════════════════════

// External type stubs — defined in rulsynor@v1, aliased for compilation closure

// From ERDL SPEC / rule-definition.ts
export interface ERDLRuleSet { protocol: string; version: string; metadata: Record<string,unknown>; rules: RuleDefinition[]; }
/** RuleDefinition — ERDL SPEC §3.2 规则定义
 *  override?: 可选以兼容旧规则文件（早期版本未设此字段）；
 *  加载时未声明者默认赋值为 'normal'（SPEC §3.2 规则评估顺序第 3 条）。
 */
export interface RuleDefinition { id: string; name: string; description: string; category: string; priority: number; override?: OverrideLevel; ring?: number; when?: WhenCondition; then: string; message?: string; unless?: WhenCondition; within?: string; conditions?: RuleCondition[]; conditionLogic?: 'AND'|'OR'; action?: { decision: string; reason: string; ring?: number }; enabled?: boolean; }
export interface RuleCondition { field: string; operator: string; value?: unknown; rate?: string; }
export interface WhenCondition { logic?: 'AND'|'OR'; conditions?: RuleCondition[]; [field: string]: unknown; }
export type OverrideLevel = 'critical' | 'high' | 'normal' | 'low';
/** Decision — 规则定义中的 then 决策值（ERDL SPEC §3.4 完整动作集） */
export type Decision = string;

// From erdl-vectors
export interface VectorSet { vectors: TestVector[]; audit_vectors: AuditTestVector[]; dynamic_vectors?: Record<string,TestVector[]>; }
export interface TestVector { id: string; scenario: string; rules: RuleDefinition[]; context: Record<string,unknown>; expected: { decision: string; matched_rules?: string[]; applied_rule?: string; reason?: string; }; decision_object?: Record<string,unknown>; }
export interface AuditTestVector { id: string; decision_object: Record<string,unknown>; }

// From ATCF compiler output
export interface DecisionTree { root: TreeNode; traverse(context: Record<string,unknown>): Decision; }
export interface TreeNode { left?: TreeNode; right?: TreeNode; condition?: RuleCondition; terminal?: Decision; runtimeEval?: { nodeId: string; operator: string }; }
export interface RuntimeEvaluator { evaluate(context: Record<string,unknown>): boolean; }
export interface SafeExprBytecode { op: string; args: unknown[]; }

// From ATCF verification layer
export interface VectorVerificationReport { passed: number; failed: number; total: number; details: unknown[]; }
export interface EquivalenceReport { passed: boolean; divergenceCount: number; samples: unknown[]; }
export interface GoldenTestReport { passed: number; failed: number; total: number; tests: unknown[]; }

// From ATCF core
export interface TaskGoal { domain: string; description: string; }
export interface LLMContext { messages: unknown[]; tools: unknown[]; }
export interface ToolCall { name: string; arguments: Record<string,unknown>; }

// ═══════════════════════════════════════════════════════════════════════════
// ERC 协议层基础类型
// 来源: ERDL SPEC v1.1 — 这些是 ERDL 协议定义的通用类型，
// @rulsynor/core 自行定义；将来 @rulsynor/server 从 core import。
// 依赖方向: server → core，不反向。
// ═══════════════════════════════════════════════════════════════════════════

/** Severity — 严重性等级 (ERDL SPEC §12.3) */
export type Severity = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** DecisionType — 进入 Decision Object 的决策类型 (ERDL SPEC §12.3 外部合规子集)
 *
 * SPEC 版本对应:
 *   v1.1: 13 种（当前）— DELEGATE 通过 ESCALATE 映射进入 DO
 *   v1.2 计划新增: 'DELEGATE' | 'DEFER'（非 breaking，union 扩展向后兼容）
 *
 * ? 消费者注意：此类型随 SPEC 版本演进。不要在消费端做 exhaustive check
 *   （如 switch-default 抛异常），应始终提供 default fallback 分支。
 */
export type DecisionType =
  | 'ALLOW'
  | 'DENY'
  | 'CORRECT'
  | 'REQUEST_HUMAN'
  | 'ESCALATE'
  | 'NOTIFY'
  | 'PASS'
  | 'ROLLBACK'
  | 'EMERGENCY_HALT'
  | 'QUARANTINE'
  | 'WORKFLOW'
  | 'WORKFLOW_PROGRESS'
  | 'WORKFLOW_WAITING';

/** DecisionObject — 完整决策对象 (ERDL SPEC §12) */
// v1.1 结构已由 SPEC 定义；Phase 2 前从 ERDL spec 转为结构化 interface
export type DecisionObject = Record<string, unknown>;

/** MerkleProof — Merkle 树证明 */
export type MerkleProof = Record<string, unknown>;

/** SafeExpr — 安全表达式 AST 节点 */
// Phase 1 前需替换为实际 AST 类型（参考 rulsynor safe-expr.ts）
export type SafeExpr = {
  type: string;      // operator type: 'eq' | 'gt' | 'in' | 'match' | 'and' | 'or' | ...
  args: unknown[];   // operands
};

/** DeterministicFiniteAutomaton — DFA 状态机 */
export interface DeterministicFiniteAutomaton {
  states: string[];
  transitions: Record<string, unknown>;
  initialState: string;
  acceptingStates: string[];
}

/** TokenBudgetExhaustedError — Token 预算耗尽异常 */
export class TokenBudgetExhaustedError extends Error {}

/** JSONSchema — JSON Schema 定义（工具参数 Schema） */
export type JSONSchema = Record<string, unknown>;

/** ToolPlugin — 第三方工具插件接口 */
export interface ToolPlugin {
  id: string;
  name: string;
  tools: ToolDefinition[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Engine
// ═══════════════════════════════════════════════════════════════════════════

export interface RuleCompiler {
  load(filePath: string): ERDLRuleSet;
  compile(ruleSet: ERDLRuleSet): CompiledRuleSet;
  compileBatch(ruleSets: ERDLRuleSet[]): CompiledRuleSet[];

  // 验证接口
  verifyAgainstVectors(
    compiled: CompiledRuleSet,
    vectors: VectorSet     // erdl-vectors v1.3
  ): VectorVerificationReport;

  verifyEquivalence(
    source: ERDLRuleSet,
    compiled: CompiledRuleSet,
    mode: 'fuzz' | 'symbolic' | 'full'
  ): EquivalenceReport;

  // Golden Test Suite（编译器自身的正确性测试）
  runGoldenTests(): GoldenTestReport;
}

// 10 条手工审核的 Golden Tests，编译器每次修改后必须通过
// 这 10 条测试独立于 71 vectors——它们是编译器的单元测试
// 测试内容：编译器算法正确性，而非工具链集成

export interface CompiledRuleSet {
  id: string;                         // UUID v7
  sourceFiles: string[];              // 编译来源的 .erdl.yaml 文件
  compiledAt: Date;
  sourceHash: string;                 // 所有源文件的 SHA-256（可追溯）

  // 四种并行产物
  complianceSchema: ComplianceSchema;
  guidanceArtifacts: GuidanceArtifact[];
  guardDirectives: GuardDirective[];
  auditTemplates: AuditTemplate[];

  /** 质量门禁告警（SPEC §11.5），编译时不阻断，记录供人工复审 */
  qualityGateAlerts?: QualityGateAlert[];
}

/** 编译产物版本（AtomicCompiledSetManager 原子交换单元） */
export interface CompiledSetVersion {
  id: string;
  compiledAt: Date;
  sourceHash: string;
  vectorVerification: { passed: boolean; total: number; failed: number; details: unknown[] };
  goldenTestReport: { passed: number; failed: number; total: number; tests: unknown[] };
  compiledRuleSet: CompiledRuleSet;
}

/** 质量门禁告警 */
export interface QualityGateAlert {
  ruleId: string;
  ruleName: string;
  level: 'error' | 'warning';
  gate: string;              // 门禁名称，如 'no-condition-on-security-rule'
  reason: string;
}

// RuleCompiler 输出的 ComplianceSchema 如何在代码层面注入到 tools[].function.parameters
export interface SchemaInjector {
  // 将编译产物注入工具定义的 JSON Schema
  inject(
    schema: ComplianceSchema,
    toolDefs: ToolDefinition[]
  ): ToolDefinition[];

  // 单工具注入
  injectOne(
    schema: ComplianceSchema,
    tool: ToolDefinition
  ): ToolDefinition;
}

// ComplianceSchema 编译产物的类型定义
export interface ComplianceSchema {
  ruleId: string;
  toolName: string;                  // 目标工具
  parameters: {
    [paramPath: string]: {           // 参数路径，如 "amount" 或 "filters.status"
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      pattern?: string;              // 正则（来自 ERDL match operator）
      enum?: string[];               // 枚举（来自 ERDL in operator）
      description: string;           // 含建议文本的自然语言描述
    };
  };
  // 标记此 Schema 的 ERDL operator 限制
  // 来自 within/rate/contains 等不可映射为 JSON Schema 的 operator → 不生成 constraints
  unmappableOperators?: string[];
}

export interface GuidanceArtifact {
  ruleId: string;
  ruleName: string;          // SPEC §3.2.4 格式

  // ═══ 语义生成层与 Then 解耦 ═══
  // GuidanceArtifact 在语义生成阶段不引用 then 类型。
  // 仅基于 when 条件推断风险画像和预防建议。
  // 审计追溯阶段保留 then 类别映射（见下方"与 ERDL then 的关系"）。
  // 它回答「什么场景，有什么风险，建议怎么做」——
  // 而非「这个场景会触发什么 Guard 动作」。

  // 风险画像（从 when 条件的字段 + operator 推断，不引用 then）
  riskProfile: {
    category: 'format' | 'security' | 'workflow' | 'convention';
    // 该条件在历史审计数据中的触发频率（冷启动 = null）
    likelihood?: number;
    impact: 'low' | 'medium' | 'high';
  };

  // 预防性建议（纯 when 条件语义，不假设 Guard 会对匹配的 tool_call 做什么）
  preventiveGuide: string;    // 「操作数据库时，建议先确认连接状态」
  bestPractice: string;       // 「金额字段推荐使用 decimal(10,2) 格式」

  // ERDL message 字段（SPEC §3.2.3）——保留给审计/调试用
  message: string;

  // 激活条件：仅当 when 条件匹配时注入。纯 SafeExpr，不引用 then
  activationCondition: SafeExpr;
}

export interface GuardDirective {
  // 原始规则引用（审计追溯用）
  sourceRule: { name: string; version: string; file: string };

  // 预验证 Transform（零歧义的格式/枚举修正，归 Guard 而非 Guidance）
  // 审计要求：每次修正生成 PreValidationAuditRecord（变更三元组）
  preValidations: PreValidation[];

  // 按工具索引的决策树
  toolDecisionTree: DecisionTree;

  // 组合规则 DFA（跨步风险——多轮 ReAct 间的状态累积检测）
  // 工程规格：每个 within/rate 规则编译为独立计数器 + 时间戳日志
  //   - 单个规则 ≤ 256 状态（硬上限），超限降级为运行时计数器评估
  //   - 多规则组合：使用 Tarjan SCC 算法基于规则依赖图拆分
  //     两条规则检查同一 field → 有边（同一 SCC）→ 需乘积
  //     两条规则检查不同 field → 无边（独立 DFA）→ 无需乘积
  //     例：Rule A (field='tool.name') 与 Rule B (field='tool.name') → 同 SCC → 乘积
  //         Rule A (field='tool.name') 与 Rule C (field='tool.args.table') → 不同 SCC → 独立
  //   - Phase 1 交付：W1-2 RuleCompiler 先按运行时计数器编译，W3-4 GuardDirective 使用运行时评估器
  //   - Phase 2 交付：comboDFA 增量替换运行时计数器（影子模式验证等价性后再替代）
  //   - 回滚协议：若 DFA 与运行时计数器在 7 天影子窗口内的决策分歧率 > 0.1%，
  //     自动回滚至运行时计数器并记录分歧样本。分歧样本用于修正 DFA 编译器，
  //     修正后重新进入影子模式
  //   - 回滚触发后 24h 内禁止再次尝试 DFA 切换（防止振荡）
  //   - 状态快照注入：每次状态迁移记录 StateTransitionLog（迁入状态、触发条件、时间戳）
  //     分歧时冻结当前 DFA 状态快照 → 存入调试库 → 运维插件可视化重放
  comboDFA?: DeterministicFiniteAutomaton;

  // staticTree — 无状态规则的编译决策树。纯函数，<1ms 遍历。Phase 1 起始终存在。
  staticTree?: DecisionTree;
  // runtimeNodes — 有状态 operator (within/rate/workflow) 的运行时求值器。Phase 1 起始终存在。
  // comboDFA 存在时，runtimeNodes 不会移除——它作为影子对照继续运行（回滚安全网）。
  // GuardEvaluator 评估优先级：comboDFA（如存在）> runtimeNodes（兜底）。
  // 两者同时存在不是歧义：DFA 结果为准，runtimeNodes 结果为影子对照（记录 StateTransitionLog.divergence）。
  runtimeNodes?: Map<string, RuntimeEvaluator>;

  // ═══ Vector 编译期验证 + 运行时调试 ═══
  meta: {
    dfaVerification: DFAVerification;
  };

  // 上下文规则字节码（SafeExpr 编译产物）
  contextExprs: SafeExprBytecode[];

  // 审计锚点映射
  auditAnchor: AuditTemplate;
}

export interface PreValidation {
  field: string;              // 参数路径
  trigger: 'zero_ambiguity';  // 仅在零歧义时触发

  // 零歧义的精确定义（满足任一条件即触发）：
  //   1. 输入值精确匹配 mapping 的某个键 → 直接映射
  //      例：{"进行中": "pending", "已完成": "done"}
  //      输入 "进行中" → 映射为 "pending" ✅
  //   2. 输入值已通过 JSON Schema enum 校验，但使用非标准字符变体 → 归一化
  //      例：{"PENDING": "pending", "Pending": "pending", "ｐｅｎｄｉｎｇ": "pending"}
  //      仅归一化大小写差异、全半角差异——不含语义等价判断
  //   3. 格式归一化（PreValidationAuditRecord.mechanism = 'format_normalization'）：
  //      例："100.0" → "100.00"（decimal(10,2) 格式对齐）
  //      输入 "+86 13800001111" → "13800001111"（电话号码去空格和区号）
  //      仅做格式层面的确定性转换——不做语义解析
  //
  // ❌ 不触发 autoTransform 的情况（不在 mapping 键空间内）：
  //   输入 "处理中" → 不匹配任何键 → 不触发 → 送 Guard 正常评估
  //   输入 "已完成一半" → 可能语义接近 "done" 但不在 mapping 中 → 不触发
  //   无 mapping 但需语义等价判断 → Guard 评估层处理

  mapping: Record<string, string>;  // 违规值 → 合规值
  // 示例：{"进行中": "pending", "已完成": "done"}
  // 注意：如果映射表的键空间不能覆盖所有可能输入，
  //   未被覆盖的输入不触发 autoTransform——不会"猜测"映射

  // Normalization Helper（层 A+）：扩展零歧义的覆盖范围
  // 对于确定性 mapping 未覆盖的高频变体，提供轻量级语义辅助
  normalizationHelper?: {
    // 业务词典：确定性的语义变体映射（规则定义者维护，不走 LLM）
    // 例：{"completed": "done", "remove": "delete", "finished": "done"}
    semanticMapping?: Record<string, string>;

    // LLM 辅助：仅当词典未覆盖且确属高频场景时启用
    // 仅返回 boolean（一致/不一致），不修改数据
    // 若一致 → Guard 走 CORRECT 路径（而非 DENY）
    llmAssist?: {
      enabled: boolean;            // 默认 false
      field: string;               // 需要语义判断的字段
      frequencyThreshold: number;  // 触发 LLM 辅助的最低出现频率，默认 10 次/小时
      prompt: string;              // 给 LLM 的语义一致性判断 prompt
    };
  };
}

// PreValidation 审计记录（变更三元组 + 摘要聚合）
// autoTransform 修改 tool_call 参数时生成
// 参与核心审计链——防止"修正后的值"掩盖"原始值中是否存在恶意意图"
//
// 高频优化：批量操作中每 100 次修正或事务结束时生成一条聚合记录
//   聚合：{ ruleId, count: 100, aggregatedHash: SHA-256(all changes), sampleChange: "..." }
//   DENY 或异常时强制记录全量明细
//   合规：密码学可验证（Hash 锚定），存储量降低 100 倍
export interface PreValidationAuditRecord {
  mode: 'individual' | 'aggregated';  // 单次记录 or 批量聚合

  // individual 模式
  stepId?: string;
  transformRuleId: string;     // 触发修正的规则 ID

  // 变更三元组：原始值 → 修正逻辑 → 修正值
  originalValue?: unknown;      // 原始值（哈希保护）
  transformedValue?: unknown;   // 修正后值
  transformLogic: string;      // 修正逻辑的可读描述
                               // 例："condition.field='tool.args.status' match '进行中' → 'pending'"

  // aggregated 模式
  aggregatedCount?: number;     // 聚合的修正次数
  aggregatedHash?: string;      // SHA-256 of all aggregated changes
  sampleChange?: string;        // 第一条修正的摘要（供快速浏览）

  // 参与核心审计链
  changeHash: string;          // SHA-256(originalValue + transformLogic + transformedValue)
  previousChangeHash: string;  // 链式连接（当前步内的 Previous 变更记录）

  // 修正溯源
  mechanism:
    | 'exact_mapping'           // 精确匹配 mapping 键（如 "进行中" → mapping → "pending"）
    | 'char_normalization'      // 字符变体归一化（大小写/全半角差异）
    | 'format_normalization';   // 格式对齐（如 decimal 补零、电话号码去特殊字符）
  confidence: 1.0;             // autoTransform 的 confidence 恒为 1.0（零歧义，三个 mechanism 都是确定性的）
}

export interface AuditTemplate {
  ruleId: string;
  decisionType: string;        // SPEC §12.3 决策类型
  severity: Severity;          // none/low/medium/high/critical
  auditAs: string;             // SPEC §3.8 Audit 记录字段映射

  // unless 审计行为（SPEC §3.8 v1.1 新增）
  unlessAudit: {
    decision: 'ALLOW';
    ruleRef: string;           // "[rule-name]/unless"
    reason: string;            // 包含 unless 匹配的详情
  } | null;

  // PreValidation 审计引用（当此规则触发了 autoTransform）
  preValidationAudit?: PreValidationAuditRecord;
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Certificate
// ═══════════════════════════════════════════════════════════════════════════

// ═══ 证书动态有效期 ═══
// 不再一刀切 30 天。TTL 由熟练度等级 × domain 风险系数 × 实况退化记录合成。
// 详见 §2.2.3 CertificateTTL 详解
export interface CertificateTTL {
  baseTTL: number;               // 基础有效期（天），默认 30

  // 调节因子
  modifiers: {
    proficiencyLevel: {            // 熟练度调节（默认值见注释）
      junior: number;            // 默认 0.5 → 15 天（低熟练度，退化风险高）
      mid: number;               // 默认 1.0 → 30 天
      senior: number;            // 默认 2.0 → 60 天（高熟练度，行为稳定）
    };

    domainRisk: Record<string, number>;  // 域风险调节，key=domain name。推荐值：
      //   file_operation: 1.0      — 文件操作，退化慢，长周期
      //   database_read: 1.0       — 数据库读，只读查询，无副作用风险
      //   database_write: 0.75     — 数据库写，中等退化速度
      //   external_api: 0.5        — 外部 API 调用，退化快（接口变更、凭证过期等）
      //   security_compliance: 0.5 — 安全合规，规则密集，退化最快
      //   customer_privacy: 0.5    — 客户隐私，合规要求高
      //   financial: 0.5           — 金额操作，零容忍退化

    observedDegradation: {         // 实况退化调节
      // 从 GuidanceRecord 提取近期违规率
      // 每 1pp 违规率超出 baseline → TTL −1 天（上限减半）
      recentViolationRate: number;
      baselineViolationRate: number;
      // penaltyPerPoint: 1 （默认，可配置）
    };
  };

  // 计算规则：
  // effectiveTTL = baseTTL × proficiencyModifier × domainRiskModifier − degradationPenalty
  // degradationPenalty = max(0, (recentViolationRate − baselineViolationRate) × 100 × penaltyPerPoint)
  // 保底下限：max(baseTTL × 0.25, 7) 天（至少 7 天，防止退化→立即过期→回炉的振荡）
  // 硬上限：90 天（防止 senior + 低风险 domain 堆积过长，规则集最多一季度必更新一次）
}

export interface CompetencyCertificate {
  agentId: string;
  ruleSetVersion: string;

  // ═══ 证书阶段 ═══
  // sandbox_certified: 沙盒考核通过
  // live_calibration: 实况观察期
  // fully_certified: 全面持证
  phase: 'sandbox_certified' | 'live_calibration' | 'fully_certified';

  issuedAt: Date;
  // expiresAt 改名为 earliestExpiresAt：所有 domain 中最早到期的时间，用于快速检查
  // 真正的 multi-domain 过期时间存储在 competencies[domain].expiresAt 中
  // 详见 §2.2.3 — 每个 competency domain 有独立的 TTL
  earliestExpiresAt: Date;

  // key = domain name (如 "file_operation")。JSON 序列化时自动转为 Record<string, {...}>
  competencies: Map<string, {
    level: 'junior' | 'mid' | 'senior';
    assessmentChannel: 'structured' | 'review';
    passedVectors: string[];

    // 每个 competency domain 的独立过期时间（由 CertificateTTL 动态计算）
    expiresAt: Date;

    // TTL 计算快照（追溯用——记录当时用了什么因子算出这个 expiresAt）
    ttlSnapshot?: {
      baseTTL: number;
      proficiencyModifier: number;
      domainRiskModifier: number;
      degradationPenalty: number;
      effectiveTTL: number;
      calculatedAt: Date;
    };

    // AdoptionRecord 聚合后的采纳统计（供 recency/frequency 截断使用）
    adoptionStats?: {
      totalSignals: number;
      adoptedRatio: number;          // 0-1
      lastAdoptedAt: Date;           // 最近一次 adopted 的时间
      consecutiveIgnored: number;    // 连续 ignored 次数
    };

    muscleMemory: {
      // 结构化 patterns——每个 pattern 携带截断算法所需的 per-item 元数据
      stablePatterns: Array<{
        pattern: string;             // 原字符串内容（供 System Prompt 注入）
        ruleId: string;              // 来源规则 ID（触发此行为的 ERDL rule）
        lastAdoptedAt: Date;         // 供 discardByRecency 按最近使用时间排序
        totalSignals: number;        // 供 discardByFrequency 按出现频率排序
        adoptionRate: number;        // 0-1，供 CapabilityProfile 蒸馏使用
      }>;
      failurePatterns: Array<{
        pattern: string;
        ruleId: string;
        lastIgnoredAt: Date;         // 最近一次被 ignored 的时间
        ignoredCount: number;        // 累计被 ignored 次数
        ignoredRate: number;         // 0-1
      }>;

      // 标记数据来源——沙盒 or 实况
      source: 'sandbox_measured' | 'live_calibrated';

      // 模拟器退化度量
      simToRealDegradation?: number;  // 沙盒 FPR - 实况 FPR（>0 表示退化）
    };

    metrics: {
      firstPassRate: number;
      selfCorrectionRate: number;
      avgTokensPerStep: number;
    };
  }>;

  signature: string;           // JCS+SHA-256 防篡改
  hash: string;
}

// ═══ 实况校准协议 ═══
// 沙盒考核通过后，Agent 不直接持证上岗，而是进入 7 天实况观察期
export interface CalibrationProtocol {
  phase: 'sandbox_certified' | 'live_calibration' | 'fully_certified';

  liveCalibration: {
    durationDays: number;  // 默认 7 天

    // Guard 严格模式——不降低触发率（保持拦截基线）
    guardIntensity: 'strict';

    // Guidance 记录但不注入——收集实况基线数据，不干预 LLM 行为
    // 这确保实况数据的「纯净」——没有被 Guidance 影响的行为基线
    guidanceMode: 'observe_only';

    // 前 3 天 100% 人工复核，后 4 天降为高风险操作复核
    // 默认值：first3Days=1.0 (100%), remainingDays=0.3 (30%)
    humanReviewRate: { first3Days: number; remainingDays: number };

    // 每个 ReAct 步骤生成校准记录：
    // { sandbox_expected_action, live_actual_action, discrepancy, severity }
    generateCalibrationRecord: boolean;  // 全量记录
  };

  graduationCriteria: {
    // 实况首次通过率 vs 沙盒首次通过率 —— 下降不超过 10pp
    // 默认值：-0.10（≥ -10%）
    firstPassRateDelta: number;

    // 实况 Guard 触发率 vs 沙盒触发率 —— 上升不超过 15pp
    // 默认值：0.15（≤ 沙盒 + 15%）
    guardTriggerRateMax: number;

    // 无 Ring 0-1 触发（EMERGENCY_HALT, QUARANTINE）
    noCriticalIncidents: boolean;

    // 人工复核无严重不符合项
    // 默认值：0
    maxCriticalReviewFlags: number;
  };

  // 不通过的处理：延长观察期 or 回炉（沙盒补训 + 增加对应场景的 Mock 错误模式）
  onFailure: 'extend_calibration' | 'retrain';
}

export interface HighFidelityMock {
  // 延迟注入（采自真实 API 的延迟分布）
  latencyDistribution: {
    mean: number;     // e.g. 120ms
    stdDev: number;   // e.g. 40ms
    p99: number;      // e.g. 350ms
  };

  // 错误模式库（≥20 种预设错误）
  errorScenarios: Array<{
    triggerProbability: number;  // 触发概率
    errorType: 'timeout' | 'permission_denied' | 'conflict' | 'quota_exceeded' | 'rate_limited' | 'network_error' | 'auth_expired' | 'validation_error';
    errorMessage: string;
    retryable: boolean;
    expectedRecoveryAction: string;  // Agent 应该采取的恢复动作
  }>;

  // 副作用模拟
  sideEffects: {
    diskQuotaImpact: boolean;
    fileWatcherTrigger: boolean;
    concurrentAccessConflict: boolean;

    // 并发压力测试
    concurrentSessions: number;  // 同时运行的虚拟会话数
  };
}

export interface ReTrainProtocol {
  // ═══ 触发条件（多因子，非单一的证书过期） ═══
  trigger:
    | 'certificate_expired'          // 证书到期（基于动态 TTL，非固定 30 天）
    | 'failure_rate_exceeded'        // 实况失败率超阈值
    | 'rule_set_updated'             // 规则集版本变更
    | 'sim_to_real_gap_exceeded'     // 沙盒/实况差距扩大
    | 'domain_degradation_detected'   // 特定 domain 退化（见 CertificateTTL.observedDegradation）
    ;

  // 触发时的上下文数据
  triggerContext?: {
    // certificate_expired 时：哪个 competency 的 TTL 最先到期
    expiredCompetency?: string;
    effectiveTTL?: number;  // 实际生效的 TTL（追溯用）

    // domain_degradation_detected 时：退化的 domain
    degradedDomain?: string;
    degradationDelta?: number;  // 违规率超出 baseline 的 pp 值
  };

  // 回炉内容：增量补训（基于实况 GuidanceRecord 识别退步点）
  differentialTraining: boolean;

  // 实况 GuidanceRecord 回传（识别退步的数据来源）
  requiresLiveFeedback: boolean;

  // 特定场景针对性训练
  targetedScenarios?: string[];  // 实况中暴露的薄弱场景

  tokenBudget: number;  // 默认值见 DEFAULT_RETRAIN_TOKEN_BUDGET
}

/** 回炉训练的默认 Token 预算（2000 tokens） */
export const DEFAULT_RETRAIN_TOKEN_BUDGET = 2000;

/** GuidanceRecord 滑动窗口大小（最近 N 轮），供蒸馏期消费 */
export const GUIDANCE_RECORD_WINDOW = 20;

// ═══════════════════════════════════════════════════════════════════════════
// Module: Training Ground — 沙盒培训场
// ═══════════════════════════════════════════════════════════════════════════

/** TrainingGround — 沙盒培训场 (ATCF V2.0 §2.2)
 *  工具层: HighFidelityMock 高保真仿真
 *  规则层: CompiledRuleSet 编译产物
 *  考核层: erdl-vectors 作为认证考试题库
 *  评估: 结构化通道 + 审查通道 (L1 Guard + L2 模板比对 + L3 人工审核)
 */
export interface TrainingGround {
  /** 运行沙盒考核：给定规则集 + 向量集 + Agent → 生成考核报告 */
  runCertification(
    agentId: string,
    compiledRules: CompiledRuleSet,
    vectors: VectorSet,
    mock: HighFidelityMock
  ): Promise<CertificationReport>;

  /** 结构化通道：直接比对 tool_call 与 Vector 期望答案 */
  evaluateStructured(
    agentOutput: ToolCall[],
    expectedVectors: TestVector[]
  ): StructuredAssessment;

  /** 审查通道：L1 Guard + L2 模板比对 + L3 人工审核 */
  evaluateReview(
    agentOutput: ToolCall[],
    compiledRules: CompiledRuleSet,
    reviewConfidence: 'high' | 'medium' | 'low'
  ): ReviewAssessment;

  /** 获取高保真 Mock 实例 */
  getMock(): HighFidelityMock;
}

/** CertificationReport — 沙盒考核报告 */
export interface CertificationReport {
  agentId: string;
  completedAt: Date;

  /** 结构化通道评估结果 */
  structured: StructuredAssessment;

  /** 审查通道评估结果 */
  review: ReviewAssessment;

  /** 综合评级 */
  overallGrade: 'pass' | 'conditional_pass' | 'fail';

  /** 生成的证书（如果通过） */
  certificate?: CompetencyCertificate;

  /** 未通过的薄弱场景列表（供回炉使用） */
  weakScenarios: string[];
}

/** StructuredAssessment — 结构化评估结果 */
export interface StructuredAssessment {
  totalVectors: number;
  passed: number;
  failed: number;
  skipped: number;
  details: Array<{
    vectorId: string;
    passed: boolean;
    expectedDecision: string;
    actualDecision: string;
    diff?: string;
  }>;
}

/** ReviewAssessment — 审查通道评估结果 (三层渐进: L1 Guard + L2 模板 + L3 人工) */
export interface ReviewAssessment {
  totalCases: number;
  l1GuardResolved: number;     // L1: Guard 可判定
  l2TemplateResolved: number;  // L2: 模板比对准入
  l3HumanRequired: number;     // L3: 需人工审核
  humanSamplingRate: number;   // 人工审核采样率 0-1
  reviewConfidence: 'high' | 'medium' | 'low';
  details: Array<{
    caseId: string;
    level: 'L1' | 'L2' | 'L3';
    verdict: 'pass' | 'fail' | 'pending_review';
    note?: string;
  }>;
}

/** CertificateManager — 证书管理器 (ATCF V2.0 §2.2.2) */
export interface CertificateManager {
  /** 签发证书：沙盒考核通过后签发 */
  issue(
    agentId: string,
    report: CertificationReport,
    ttl: CertificateTTL
  ): CompetencyCertificate;

  /** 续签证书：实况校准通过后升级阶段 */
  renew(
    cert: CompetencyCertificate,
    calibration: CalibrationProtocol
  ): CompetencyCertificate;

  /** 撤销证书：严重违规或退化超限 */
  revoke(agentId: string, reason: string): void;

  /** 验证证书有效性（含动态 TTL 检查 + 退化检测） */
  validate(cert: CompetencyCertificate): {
    valid: boolean;
    reason?: string;
    degradedDomains?: string[];
  };

  /** 获取 Agent 当前证书 */
  get(agentId: string): CompetencyCertificate | null;

  /** JCS+SHA-256 签名证书（防篡改） */
  sign(cert: CompetencyCertificate): string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Tool Registry
// ═══════════════════════════════════════════════════════════════════════════

// 工具注册中心——本地工具 + MCP 工具 + 第三方工具的统一入口
export interface ToolRegistry {
  // 从 rulsynor ToolRegistry entity 加载本地工具
  loadLocalTools(): ToolDefinition[];

  // 从 MCP Server 连接加载 MCP 工具（动态，随时有新 MCP Server 连入）
  loadMcpTools(): ToolDefinition[];

  // 第三方工具通过 Plugin 接口注册
  registerPlugin(plugin: ToolPlugin): void;

  // 获取当前全部可用工具
  getAllTools(): ToolDefinition[];

  // 按 category / securityLevel / domain 过滤
  filter(filters: ToolFilter): ToolDefinition[];

  // 热更新：MCP 工具变更时通知 PreFlightAssembler
  onToolsChanged(callback: (tools: ToolDefinition[]) => void): void;
}

export interface ToolDefinition {
  name: string;
  displayName?: string;
  description: string;
  category: string;               // 工具分类（如 'file_operation', 'database_write', 'external_api'）
  securityLevel: 'safe' | 'sensitive' | 'dangerous';

  // 关联的 domain——用于 retain_essential 时的匹配权重
  domains: string[];               // 如 ['file_operation', 'general']
  // domainRelevance 由 domains 派生：声明顺序决定权重衰减（第一个 domain=1.0, 递减 0.1，保底 0.1）。
  // JSON 序列化时转为 Record<string, number>；反序列化时重建 Map。
  domainRelevance: Map<string, number>;  // domain → 关联度权重 0-1

  // 工具的参数 Schema（用于 ComplianceSchema 注入）
  parameters: JSONSchema;

  // 是否需要 Guard 评估
  requireGuard: boolean;

  // 来源（审计追溯）
  source: 'local' | 'mcp' | 'plugin';
  sourceId: string;                // MCP Server ID 或 plugin ID

  // ═══ Capability Architecture V2.3 扩展（全部 optional，向后兼容） ═══
  occupations?: string[];          // Occupation[] — undefined=全员可见，[]=全员不可见（MCP 默认）
  entityType?: string;             // 业务实体类型，如 'Order' | 'Refund' | 'Customer'
  operation?: 'read' | 'write';   // 读/写操作
  action?: 'query' | 'list' | 'search' | 'create' | 'update' | 'delete' | 'changeState';
  relatedKnowledge?: string[];     // knowledgeId[] — 连接件①锚（tool→knowledge）
  enhancement?: Record<string, unknown>;  // ToolEnhancement JSONB（Layer 2+3 整体，optional）
}

// PreFlightAssembler 的工具过滤不再"猜测"什么工具需要——
// 而是基于 TaskGoal.domain 从 ToolRegistry 获取关联工具
export interface ToolFilter {
  // 必选：当前任务域的工具（domainRelevance 最高的前 N 个）
  // 过滤逻辑：取 domainRelevance[toolFilter.domain] 的值，
  // 若 toolFilter.domain 不在 domains[] 中 → relevance = 0（过滤掉）。
  domain?: string;
  minRelevance?: number;           // 最低关联度阈值，默认 0.3
  // 可选：安全级别
  securityLevel?: ToolDefinition['securityLevel'];
  // 可选：来源
  source?: ToolDefinition['source'];
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Token Budget
// ═══════════════════════════════════════════════════════════════════════════

// ═══ Token 预算优先级与截断策略 ═══
// 2000 tokens 硬上限。超出时按优先级降级截断，而非随机丢弃或直接触发 EXHAUSTED。
// 详见 §2.3.1a Token 预算截断协议详解

export enum TokenPriority {
  RING_0_IMMUTABLE    = 0,  // 永不截断：安全/合规规则
  RING_1_CRITICAL     = 1,  // 最后截断：当前任务域惯例（SOP 文本）
  RING_2_IMPORTANT    = 2,  // 次后截断：肌肉记忆（稳定模式）
  RING_3_ADAPTIVE     = 3,  // 优先截断：失败模式（低频先丢）
  RING_4_BEST_EFFORT  = 4,  // 最先截断：可用工具列表
  RING_K_KNOWLEDGE    = 10, // RAG知识片段——SOP后、肌肉记忆前（sentinel值，不在0-4序列中）
}

// Ring aliases for global scope usage
export const RING_0 = TokenPriority.RING_0_IMMUTABLE;
export const RING_1 = TokenPriority.RING_1_CRITICAL;
export const RING_2 = TokenPriority.RING_2_IMPORTANT;
export const RING_3 = TokenPriority.RING_3_ADAPTIVE;
export const RING_4 = TokenPriority.RING_4_BEST_EFFORT;
export const RING_K = TokenPriority.RING_K_KNOWLEDGE;

/** Budget profiles per certLevel (B2 revision) */
export const BUDGET_PROFILES: Record<string, number> = {
  L0: 2000, L1: 2000, L2: 2500, L3: 3000,
};

export interface TokenBudgetConfig {
  totalBudget: number;         // 2000 tokens

  // 各层硬上限（5 层固定，每层的 priority 由其层名称决定）
  layers: {
    immutable: {
      budget: number;          // ≤ 200 tokens（安全规则极少超支）
      priority: TokenPriority; // 此层固定为 RING_0_IMMUTABLE
      truncation: 'never';     // 永不截断——超限则触发 EXHAUSTED
    };
    critical: {
      budget: number;          // ≤ 400 tokens
      priority: TokenPriority; // 此层固定为 RING_1_CRITICAL
      truncation: 'compress';  // 截断方式：先压缩文本（去冗余词），仍超限则按 recency 倒序丢弃最早的
    };
    important: {
      budget: number;          // ≤ 800 tokens
      priority: TokenPriority; // 此层固定为 RING_2_IMPORTANT
      truncation: 'discard_oldest'; // 按 recency 倒序丢弃（最早的先丢）
    };
    adaptive: {
      budget: number;          // ≤ 400 tokens
      priority: TokenPriority; // 此层固定为 RING_3_ADAPTIVE
      truncation: 'discard_least_frequent'; // 按 frequency 正序丢弃（最少见的先丢）
    };
    bestEffort: {
      budget: number;          // ≤ 200 tokens（剩余）
      priority: TokenPriority; // 此层固定为 RING_4_BEST_EFFORT
      truncation: 'retain_essential'; // 工具列表优先 retain_essential：保留核心工具而非整车丢弃
    };
  };

  // 总预算超限时，按层优先级倒序：RING_4 → RING_3 → RING_2 → RING_1
  // RING_0 永不参与截断
  overflowStrategy: 'cascade_truncate';  // or 'EXHAUSTED' when RING_0 alone exceeds budget
}

export interface TruncationRecord {
  layer: string;               // 被截断的层
  originalTokens: number;      // 截断前 token 数
  afterTokens: number;         // 截断后 token 数
  itemsRemoved: number;        // 丢弃的条目数
  strategy: 'compress' | 'discard_oldest' | 'discard_least_frequent' | 'retain_essential' | 'discard_all' | 'discard_lowest_score';
  discardedItemIds?: string[]; // 被丢弃条目 ID（审计追溯）
}

// ═══ ExecutionContext — 统一执行上下文 ═══
// 贯穿 PreFlightAssembler / GuidanceEngine / GuardEvaluator 的共享上下文

export interface ExecutionContext {
  sessionId: string;
  agentId: string;
  task: TaskGoal;

  // 当前持有的证书（含肌肉记忆和 per-domain 过期时间）
  cert: CompetencyCertificate;

  // RuleCompiler 编译产物
  compiledRules: CompiledRuleSet;

  // Guidance 编译产物（GuidanceArtifact[] —— 供 formatDomainConventions 等函数消费）
  guidanceArtifacts: GuidanceArtifact[];

  // 当前可用的工具定义
  availableTools: ToolDefinition[];

  // 最近 N 轮的 GuidanceRecord 累积（供蒸馏期消费）
  // 窗口大小由 GUIDANCE_RECORD_WINDOW 常量定义，默认 20 轮。
  recentGuidanceRecords: GuidanceRecord[];

  // ═══ Capability Architecture V2.3 扩展（optional） ═══
  ragFragments?: unknown[];        // ScoredFragment[] — RAG 检索结果（D9 RING_K 注入）
  certLevel?: string;              // 'L0' | 'L1' | 'L2' | 'L3' — B2 预算分级

  // 请求元数据
  metadata: {
    requestId: string;
    timestamp: Date;
    traceId?: string;
  };
}

export interface PreFlightAssembler {
  assemble(context: ExecutionContext): LLMContext;

  // 工具过滤：仅暴露任务相关的工具，减少 Agent 动作空间
  filterTools(
    allTools: ToolDefinition[],
    taskDomain: string,
    cert: CompetencyCertificate
  ): ToolDefinition[];
}

// ═══ System Prompt 格式化函数签名 ═══
// 将结构化数据（证书、规则）翻译为 LLM 可理解的 Markdown 文本
// 每个函数的输出为纯字符串，嵌入 System Prompt 的对应段落
// 各层的 token 预算在 §2.3.1 TokenBudgetConfig 中定义

/** 从 CompetencyCertificate 中提取指定 domain 的稳定行为模式 */
export declare function formatStablePatterns(cert: CompetencyCertificate, domain: string): string;
// 数据来源：cert.competencies[domain].muscleMemory.stablePatterns
// 输出格式：Markdown 无序列表，每项 ≤ 50 字，正向表述
// 示例：
//   - 你习惯在修改订单前先查询订单状态
//   - 金额字段总是使用两位小数的 decimal 格式

/** 从 ERDL 规则集获取当前任务域的 SOP 文本 */
export declare function formatDomainConventions(domain: string): string;
// 数据来源：ERDL 规则中 task.domain 匹配的 SOP guide 文本（GuidanceArtifact.preventiveGuide + bestPractice）
// 输出格式：Markdown 段落 + 列表
// 示例：
//   在当前域中，订单管理的标准流程：先查询 → 确认状态 → 修改或取消

/** 从 CompetencyCertificate 中提取指定 domain 的反复失败模式 */
export declare function formatFailurePatterns(cert: CompetencyCertificate, domain: string): string;
// 数据来源：cert.competencies[domain].muscleMemory.failurePatterns
// 输出格式：Markdown 列表，正向表述（“你最近在这里容易出错”而非“不要在这里犯错”）
// 示例：
//   - 创建订单时，备注字段经常超过 200 字符限制
//   - 修改客户信息时，有时忘记验证手机号格式

/** 格式化工具列表为 Markdown */
export declare function formatTools(toolDefs: ToolDefinition[]): string;
// 数据来源：PreFlightAssembler.filterTools() 过滤后的工具定义
// 输出格式：Markdown 表格或列表，含工具名 + 简短描述
// 示例：
//   - queryOrder — 查询订单详情（参数：orderId）
//   - modifyOrder — 修改订单（参数：orderId, amount?, status?）

/** 格式化安全/合规规则为不可违反的底线陈述 */
export declare function formatSafetyRules(cert: CompetencyCertificate, taskDomain: string): string;
// 数据来源：ERDL 规则中 category='security_compliance' 的全部规则
// ⚠️ 不过滤 domain — 安全规则是全局的（“禁止删除生产数据”适用所有域，
//    不限于 file_operation 或 database_write）。按 task.domain 过滤会导致全局安全规则丢失
// 注入策略：全部注入 RING_0（≤200 tokens）。若安全规则集超过 200 tokens →
//    按 severity 优先级截断（critical > high > medium），而非按 domain 过滤
// 输出格式：编号列表，正向指令（“始终…”“必须…”而非“禁止…”）
// 示例：
//   1. 始终通过 __gateway.encrypt() 加密敏感数据后再写入
//   2. 所有删除操作必须先归档，再软删除（设置 deleted_at）
//   3. 禁止在日志中输出客户 PII（适用于所有域）

// System Message 结构
// 分层注入策略（SPEC §11.1: 200 条规则占~28KB/22%窗口）
// ATCF 的 2000 tokens 预算 = ~3KB / 2.5% 的 128K 窗口——充裕
// 超限时按 TokenPriority 级联截断（详见 §2.3.1a）
//
// ═══ Lost-in-Middle 缓解策略（详见 §2.3.1b） ═══
// LLM 注意力分布：开头（首因效应）> 末尾（近因效应）> 中间（遗忘区）
// 注入顺序有意与 TokenPriority 相反：
//   - 肌肉记忆 → 开头（角色定义，首因效应）
//   - SOP 惯例 → 中间上部
//   - 失败模式 → 中间下部
//   - 工具列表 → 中间底部
//   - 安全/合规 → 末尾（紧挨用户消息，近因效应 + 最高注意力权重）
// 禁止使用否定/disabled/ignore 等词 → 全部用正向指令
// 使用 Markdown ### 标题层级增强结构感（帮助 LLM 定位关键段落）
export declare function buildSystemMessage(cert: CompetencyCertificate, task: TaskGoal, exposedTools: ToolDefinition[]): {
  content: string;
  budget: {
    total: number;
    used: number;
    remaining: number;
    truncations: TruncationRecord[];
  };
};

// ═══ Truncation Functions (signatures only) ═══

export declare function assembleWithBudget(
  layers: Map<TokenPriority, string>,
  totalBudget: number
): { content: string; budget: { total: number; used: number; remaining: number; truncations: TruncationRecord[] } };

/** 压缩文本：去冗余词，保留语义 */
export declare function compressText(content: string): string;
// 策略：去掉填充词（“请注意，在创建订单时” → “创建订单”）、
//      合并重复结构（多段相同前缀 → 共享前缀 + 差异列表）
// 示例：
//   输入: “请注意，在创建订单时，金额字段请始终使用两位小数格式”
//   输出: “创建订单：金额使用 decimal(10,2)”

/** 按最近使用时间倒序丢弃（最早使用的先丢弃） */
export declare function discardByRecency(
  content: string,
  budget: number
): { content: string; tokens: number; record: TruncationRecord };
// 数据来源：competency.muscleMemory.stablePatterns[].lastAdoptedAt（per-pattern 字段）
// 策略：逐条丢弃 lastAdoptedAt 最早的条目，直到 content 的 token 数 ≤ budget
//       丢弃的条目 ID → TruncationRecord.discardedItemIds

/** 按使用频率正序丢弃（最低频的先丢弃） */
export declare function discardByFrequency(
  content: string,
  budget: number
): { content: string; tokens: number; record: TruncationRecord };
// 数据来源：competency.muscleMemory.stablePatterns[].totalSignals（per-pattern 字段）
// 策略：逐条丢弃 totalSignals 最小的条目

/** 按关联度保留核心工具 */
export declare function retainEssential(
  content: string,
  budget: number,
  taskDomain: string
): { content: string; tokens: number; record: TruncationRecord };
// 策略：解析 content 为工具定义列表，按 ToolDefinition.domainRelevance[taskDomain] 降序排列
//       taskDomain 为显式入参（由调用方指定当前任务域，如 'database_write'），非隐式推断
//       保留 top 1-3 个高于 minRelevance 阈值的工具
// 关联度来源：ToolRegistry 注册时声明 → ToolDefinition.domainRelevance
// 示例：taskDomain='database_write'
//         → queryOrder(0.95), modifyOrder(0.90), createOrder(0.85) → 保留
//         → web_search(0.15), parse_csv(0.1) → 丢弃
// 输出末尾标注：「以上仅为核心工具（${taskDomain} 域）。
//                  如需完整工具列表，回复 "展开工具"即可。」
// 注意：保留的 tool.name 必须与 ToolRegistry 完全一致——LLM 调用时靠 name 匹配
//       不能改 tool name，只能裁减列表

/** 对指定层的内容应用截断策略
 *  若 priority = RING_0_IMMUTABLE: 原样返回，不截断（RING_0 永不参与截断）。
 *  若单层超限且 priority = RING_0: 触发 TokenBudgetExhaustedError（全局预算耗尽）。
 */
export declare function applyTruncation(
  content: string,
  priority: TokenPriority,
  budget: number
): { content: string; tokens: number; record: TruncationRecord };

export enum BudgetStatus {
  HEALTHY  = 'healthy',   // 无截断或仅 RING_4 轻微截断
  DEGRADED = 'degraded',  // RING_2/RING_3 被截断 → 记录审计，继续运行
  EXHAUSTED = 'exhausted' // RING_0 超预算 → 唯一触发 REQUEST_HUMAN 的情况
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Guidance
// ═══════════════════════════════════════════════════════════════════════════

export interface GuidanceEngine {
  evaluate(toolCall: ToolCall, context: ExecutionContext): GuidanceReport;

  /** 计算规则成熟度（0-1），用于压制冷启动新规则的 confidence。
   *  随 GuidanceRecord 积累逐步释放：
   *    0 条记录 → 0.3（冷启动）
   *    1-4 条   → 0.5
   *    5-9 条   → 0.7
   *    ≥ 10 条  → 1.0（完全成熟）
   */
  getRuleMaturity(ruleId: string, records: GuidanceRecord[]): number;
}

// ═══ 采纳检测规则 ═══

// 每条 Guidance signal 注入 System Prompt 后，在下一轮 LLM 生成的 tool_call 中
// 通过行为模式匹配检测 LLM 是否采纳了建议。详见 §2.3.3a 采纳检测协议。
export interface AdoptionDetectionRule {
  ruleId: string;              // 关联的 Guidance signal.ruleId（与 GuidanceReport.signals[].ruleId 对齐）
  matchType:
    | 'exact_parameter'          // 精确参数匹配：建议的字段值是否出现在 tool_call.arguments 中
    | 'tool_selection'           // 工具选择匹配：LLM 是否调用了建议的工具
    | 'behavioral_pattern'       // 行为模式匹配：LLM 是否表现出建议的行为序列
    | 'negative_absence';         // 负向检测：建议「不要做X」→ tool_call 中是否没有出现 X

  matchTarget: {
    // exact_parameter: 目标字段和期望值
    field?: string;               // tool_call.arguments 中的字段路径，如 "amount"
    expectedPattern?: string;     // 正则 or 精确值（decimal(10,2) = /^\d{1,8}\.\d{2}$/）

    // tool_selection: 目标工具名
    expectedTool?: string;        // 建议使用的工具，如 "queryOrder"

    // behavioral_pattern: 行为序列签名
    expectedSequence?: string[];  // 期望的工具调用序列，如 ["queryOrder", "modifyOrder"]
    sequenceConfig?: {
      // 松散匹配：允许中间插入无关步骤（处理多任务穿插场景）
      mode: 'strict' | 'loose';   // strict=必须连续出现, loose=允许间隔
      maxGap: number;              // loose 模式下，允许的最大间隔步数，默认 5
      contextId?: string;          // 任务上下文 ID（空 = 全局匹配）
    };

    // negative_absence: 禁止的模式
    forbiddenPattern?: string;    // 不应出现的参数值模式，如 "DELETE"
    forbiddenTool?: string;       // 不应调用的工具，如 "drop_table"
  };

  // 检测窗口：在 signal 注入后的 N 轮 tool_call 内检测
  detectionWindow: {
    maxSteps: number;             // 默认 3 轮（超过视为无效检测）
    // 全局超时熔断：窗口 + 超时双重约束
    maxTimeMs?: number;            // 默认 600000 (10min)。超时未匹配 → status=timeout_ignored
  };

  // 采纳后的持续验证窗口（仅 negative_absence 类型使用）
  // negative_absence 类型在窗口内未发现违规 → adopted
  // 但在后续步骤中可能延迟出现违规 → 需轻量级负向扫描
  adoptionValidityWindow?: {
    enabled: boolean;             // 默认 true（仅 matchType='negative_absence' 时启用）
    scanSteps: number;            // 采纳后继续扫描 N 步，默认 5 步
    scanInterval: 'every_step';   // 每步扫描一次（轻量级：仅检查 forbiddenPattern / forbiddenTool）
    onViolation: 'revoke';        // 发现违规 → 将 status 从 adopted 迁移为 revoked
  };
}

// ═══ 采纳记录 ═══
// 取代模糊的 ignoredSignals[]，每个 signal 的采纳状态独立记录。
export interface AdoptionRecord {
  ruleId: string;              // 关联的 Guidance signal.ruleId（与 GuidanceReport.signals[].ruleId 对齐）
  signalType: 'suggestion' | 'warning' | 'best_practice';
  injectedAt: Date;              // signal 注入 System Prompt 的时间

  // Guidance 来源（区分信号来源用于蒸馏统计）
  guidanceSource:
    | 'guidance_signal'          // GuidanceEngine 预注入的 signal
    | 'guardian_block'           // Guardian IAGP 消息
    | 'correction'               // 导航层协商纠正成功（rulsynor chat-negotiation.service）
    ;

  // 采纳状态
  status:
    | 'adopted'                  // LLM 生成了符合建议的 tool_call
    | 'partially_adopted'        // 部分符合（如建议了 3 个字段，只采用了 2 个）
    | 'ignored'                  // 检测窗口内未发现匹配行为
    | 'revoked'                  // 反采纳：adopted 后，adoptionValidityWindow 内检测到延迟违规（仅 negative_absence 类型）
    | 'superseded'               // 被后续 signal 取代（同一 ruleId 的新 signal 注入）
    | 'inapplicable'             // 环境变化导致建议不再适用（如任务已切换）
    | 'timeout_ignored'          // 窗口超时（10min 全局熔断）仍未匹配 → 低优先级审计
    ;

  // adopted / partially_adopted 时的匹配明细
  adoptionDetail?: {
    matchedAt: Date;             // 检测到采纳的 tool_call 时间
    matchedInStep: number;       // 在注入后第几步检测到
    matchConfidence: number;     // 匹配置信度 0-1
    // 评分策略（按 matchType）：
    //   exact_parameter: 精确匹配=1.0, 不匹配=0（二元评分）
    //   tool_selection: 精确匹配=1.0, 不匹配=0
    //   behavioral_pattern: 匹配步数 / 期望序列长度
    //   negative_absence: 未出现违禁模式=1.0, 出现=0
    // adopted: 建议字段值 vs 实际值的一致性分数
    // partially_adopted: 采纳字段数 / 总建议字段数
  };

  // ignored 时的未采纳原因（从 LLM 行为推断）
  ignoreReason?:
    | 'agent_chose_alternative'  // LLM 选择了不同但合法的路径
    | 'suggestion_not_relevant'  // 建议与当前上下文不相关
    | 'suggestion_conflict'      // 与另一条建议冲突
    | 'no_detection_in_window'   // 检测窗口内未出现相关 tool_call
    ;

  // 采纳行为的结构化锚——供行为模式匹配器使用
  adoptionAnchor?: {
    // 实际的 tool_call 参数（脱敏后）
    actualValue?: string;
    // 实际的工具名
    actualTool?: string;
    // 实际的行为序列
    actualSequence?: string[];
  };
}

// ═══ GuidanceRecord — 聚合类型 ═══
// 蒸馏/回炉/度量的统一输入。聚合单个 ReAct Step 的 GuidanceReport + 全部 AdoptionRecord
// 文档中所有提到 "GuidanceRecord" 的地方均指此类型
export interface GuidanceRecord {
  stepId: string;                        // ReAct Step ID
  timestamp: Date;

  // 该步注入的 Guidance 建议（from GuidanceReport）
  guidanceReport: GuidanceReport;

  // 该步检测到的采纳结果（from GuidanceReport.guidanceAudit.adoptionRecords）
  adoptionRecords: AdoptionRecord[];

  // 聚合统计（便捷访问）
  summary: {
    totalSignals: number;                // 该步注入的总 signals 数
    adoptedCount: number;                 // adopted 数量
    partiallyAdoptedCount: number;        // partially_adopted 数量
    ignoredCount: number;                 // ignored 数量
    adoptionRate: number;                 // 0-1
    // 违规率 = ignoredCount / totalSignals（如果 signal 是 Guard 关联的规则）
    violationRate?: number;
  };

  // Guardian IAGP 消息（如果有跨 Agent 交互）
  iagpMessages?: IAGPMessage[];
}

// ═══ Distiller — 蒸馏引擎 ═══
// 从 GuidanceRecord 积累中凝练能力画像。纯确定性引擎，不调 LLM。
// 蒸馏→证书 字段映射：
//   CapabilityProfile.stablePatterns[] → CompetencyCertificate.muscleMemory.stablePatterns[]
//     (保留 ruleId/adoptionRate/totalSignals/lastAdoptedAt — 结构化传递，不退化)
//   CapabilityProfile.failurePatterns[] → CompetencyCertificate.muscleMemory.failurePatterns[]
//     (保留 ruleId/ignoredRate/ignoredCount/lastIgnoredAt)

export interface Distiller {
  distill(records: GuidanceRecord[]): CapabilityProfile;
  updateMuscleMemory(cert: CompetencyCertificate, records: GuidanceRecord[]): CompetencyCertificate;
}

export interface CapabilityProfile {
  agentId: string;
  generatedAt: Date;
  domains: Map<string, {
    stablePatterns: Array<{ ruleId: string; description: string; adoptionRate: number; sampleCount: number; pattern: string; guidanceSource?: 'guidance_signal' | 'guardian_block' | 'correction' }>;
    failurePatterns: Array<{ ruleId: string; description: string; ignoredRate: number; consecutiveIgnored: number; pattern: string; guidanceSource?: 'guidance_signal' | 'guardian_block' | 'correction' }>;
    summary: { totalSignals: number; overallAdoptionRate: number; trendDirection: 'improving' | 'stable' | 'degrading'; trendDelta: number };
  }>;
  immutableRules: Array<{ ruleId: string; reason: 'security' | 'compliance' }>;
}

// stablePattern: adopted >= 0.9 且 sample >= 5
//   ⚠️ 若 guidanceSource='correction'（导航层协商纠正）→ 权重 ×0.8
//   理由：从纠正中学到的行为不如预注入 Guidance 稳定——被动服从 ≠ 主动习惯
// failurePattern: ignored >= 0.3 且 consecutiveIgnored >= 3
//   ⚠️ 若 guidanceSource='correction' 且 3 轮才通过 → 仍然计入 failurePattern
//   理由：需要 3 轮协商才纠正 = Agent 抵抗建议，与 ignored 等效
// trendDirection: 近10轮 vs 前10轮 adoptionRate delta
// 安全/合规规则永不蒸馏

export interface GuidanceReport {
  signals: Array<{
    type: 'suggestion' | 'warning' | 'best_practice';
    ruleId: string;
    message: string;              // 给 LLM 的建议文本（SPEC §3.2.3）
    confidence: number;           // 0-1
    // confidence = rule_match_score × adoption_weight × getRuleMaturity()
    //   rule_match_score: when 条件精确匹配度 (1.0=全部精确匹配, 0.5=部分模糊匹配)
    //   adoption_weight: 该规则历史采纳率 (冷启动=0.5, 随 AdoptionRecord 累积渐近 1.0)
    //   getRuleMaturity(): 规则成熟度（见 GuidanceEngine 接口）
    // 阈值策略（分级，避免冷启动死锁）：
    //   信号数 < 5：  effectiveThreshold = 0.3（强制注入，数据收集模式）
    //   信号数 5-9：   effectiveThreshold = 0.5（放松阈值）
    //   信号数 ≥ 10：  effectiveThreshold = 0.8（标准阈值）
    //   30 轮仍无信号：forceInject = true（安全阀，单次强制注入）
    //   注入时标注复杂度衰减：「基于新规则，未经充分验证」
    // 校准方法（Phase 1 影子模式）：
    //   收集 Guidance 建议 + Agent 实际 tool_call 数据
    //   → 找到“Guidance 建议错误导致 Guard 拦截”的 confidence 分布
    //   → 设定阈值为 误引导率 < 1% 的分位点
    relatedToolArg?: string;      // 关联的参数路径

    // 每个 signal 预挂载其采纳检测规则
    adoptionRule?: AdoptionDetectionRule;
  }>;

  // 注：autoTransform 不在此处——已移到 Guard PreValidation
  guidanceAudit: {
    timestamp: Date;
    signalsCount: number;
    // 不再用模糊的 ignoredSignals[]——每个 signal 的采纳状态独立记录
    adoptionRecords: AdoptionRecord[];
  };
}

// ═══ 规则成熟度 ═══
// 新规则未经实况验证，高 confidence 注入 = 高风险误引导。
// getRuleMaturity() 已归入 GuidanceEngine 接口，便于测试和 mock。

// 冷启动阶段的额外保护：
// 1. signalCount < 5 的规则 → 强制注入（降级阈值 0.3），注入时标注「基于新规则，未经充分验证」
// 2. signalCount 5-9 的规则 → 放松阈值 0.5，注入时标注「基于有限验证数据」
// 3. signalCount ≥ 10 的规则 → 标准阈值 0.8，无需标注
// 4. 30 轮仍无任何 signal 的规则 → 安全阀强制注入一次（forceInject=true），
//    打破冷启动僵局，产生至少一个 AdoptionRecord 数据点

// ═══════════════════════════════════════════════════════════════════════════
// Module: Guard
// ═══════════════════════════════════════════════════════════════════════════

export interface GuardEvaluator {
  /** 评估 tool_call，返回 GuardDecision。
   *
   *  ? 架构红线：guidanceReport 仅供审计/调试参考，
   *     Guard 的决策逻辑（决策树 / DFA / SafeExpr）不得依赖 guidanceReport。
   *     Guidance 失败 ≠ 安全性受损——Guard 是唯一的阻断点。
   *     任何让 Guidance 影响 Guard 决策的代码变更需经 Henry 审批。
   */
  evaluate(
    toolCall: ToolCall,
    context: ExecutionContext,
    guardDirectives: GuardDirective[],
    guidanceReport?: GuidanceReport
  ): GuardDecision;
}

export interface GuardDecision {
  decision: DecisionType;       // SPEC §12.3 决策类型
  severity: Severity;
  reason: string;
  actionTaken: 'allowed' | 'blocked' | 'corrected' | 'paused' | 'halted' | string;

  // 预验证自动修正结果（如果有）
  preValidationApplied?: {
    originalField: string;
    originalValue: string;
    correctedValue: string;
  };

  // Decision Object（SPEC §12 完整格式）
  decisionObject: DecisionObject;
}

export interface StateMigrationPolicy {
  // 热更新时 within/rate 计数器不清空——保守冻结，防止安全规则窗口期漏洞

  // 攻击场景示例：
  //   规则 within(tool.name='api_call', 1m, 5) → DENY
  //   Agent 在热更新前 30s 内已调用 4 次
  //   热更新计数器清空 → Agent 第 5 次调用 = 计数器显示 1（实际应 5）→ 错误 ALLOW
  //   → 安全规则在热更新后产生 60s 窗口期漏洞

  // 方案 A：保守冻结（推荐）
  strategy: 'conservative_freeze';

  // 热更新后 1 个完整窗口期内，有状态规则按保守策略评估：
  //   within/window → 默认视为“已接近限值”（count = limit × 0.8）直到新窗口完整
  //   即：旧窗口 60s 内未过期的时间戳保留 + 新请求按保守计数叠加
  freezeWindowMs: number;  // 冻结窗口 = 最长 within 窗口

  // 冻结期内的行为：
  //   1. 旧 withinTracker 中未过期的时间戳全部保留，不丢失
  //   2. 新请求的时间戳追加到计数器
  //   3. 窗口过期后自动解除冻结
  //   4. 冻结期间 NOTIFY 消息通知 Agent 会话

  // 审计锚点：热更新计数器快照写入 AuditRecord
  snapshotBeforeMigration: boolean;
  snapshotHash: string;
}

// GuardStateManager defined above in Engine module.

// ═══════════════════════════════════════════════════════════════════════════
// Module: Audit
// ═══════════════════════════════════════════════════════════════════════════

export interface NotifyMessage {
  type: 'rule_set_updated' | 'comboDFA_reset' | 'certificate_expiring' | 'guidance_profile_updated';
  timestamp: Date;
  sessionId: string;

  payload: {
    summary: string;             // 人类可读摘要，如 "规则集已更新至 v2.4.1"
    detail?: string;             // 可选的详细说明
    affectedRules?: string[];    // 受影响的 ruleId 列表
    actionRequired?: 'none' | 'acknowledge' | 'retrain';
  };

  // 投递保证：at-least-once（通过 session 内的消息队列）
  // 重复投递时 NOTIFY 幂等：messageId 去重
  messageId: string;             // UUID v7，幂等键
}

// NOTIFY 投递方式：通过现有 SSE 管道投递为 chat:notify 事件
// 消费方式：Agent 的 GuidanceEngine 在下一轮 LLM 调用前处理 NOTIFY
//   如 actionRequired='retrain' → GuidanceEngine 触发 ReTrainProtocol
//   如 actionRequired='acknowledge' → 记录已确认（审计追溯）

// ═══════════════════════════════════════════════════════════════════════════
// Module: Multi-Agent & DFA Debugging
// ═══════════════════════════════════════════════════════════════════════════

// RuleCompiler 编译 comboDFA 后，随机生成 1000 个虚拟输入流运行仿真
export interface DFAVerification {
  status: 'verified' | 'fallback_to_counter';
  simulatedStates: number;       // 实际遍历到的状态数
  unreachableStates: string[];   // 不可达状态（可能有 bug，也可能是正常死状态）
  deadLoops: string[];           // 死循环路径
  exceededStateLimit: boolean;   // 超过 256 状态 → 自动 fallback_to_counter
  verifiedAt: Date;
}

// 检测逻辑：
// 1. 随机生成 1000 个符合 when 条件的虚拟输入流
// 2. 在 DFA 中运行，记录每个状态被访问的次数
// 3. 状态数 > 256 → 自动降级为运行时计数器模式
// 4. 发现死循环（连续 100 步在同一状态迁移）→ 降级
// 5. 存在编译期不可达状态 → 记录 WARNING 但继续（可能是合法的 guard state）

// GuardEvaluator 评估 comboDFA 时记录每次状态迁移
export interface StateTransitionLog {
  stepId: string;
  timestamp: Date;
  fromState: string;             // 迁出状态 ID
  toState: string;               // 迁入状态 ID
  trigger: string;               // 触发条件（如 "rate exceeded for tool.name=api_call"）
  dfaDecision: Decision;         // DFA 返回的决策
  counterDecision: Decision;     // 运行时计数器返回的决策（影子对照）
  divergence: boolean;           // 两者是否分歧
}

// 分歧时冻结当前 DFA 状态快照
export interface DFAStateSnapshot {
  snapshotId: string;
  frozenAt: Date;
  agentId: string;
  sessionId: string;
  comboDFAId: string;
  currentStates: string[];       // 冻结时 DFA 各子自动机的当前状态
  transitionLog: StateTransitionLog[];  // 分歧点前后的迁移日志（context window ±50 步）
  runtimeCounters: Map<string, number>; // 影子对照的运行时计数器状态
}

// ═══ Audit — Merkle Tree ═══

export interface AuditMerkleTree {
  // ═══ 根哈希 = 整个 ReAct Step 的密码学承诺 ═══
  rootHash: string;  // SHA-256(coreLeafHash + extensionRootHash)

  // ═══ 核心叶子: DO v1.3 平面哈希的部分（不变）═══
  coreLeaf: {
    stepId: string;
    toolCallHash: string;
    decisionHash: string;    // Guard Decision Object 的 audit.hash
    prevHash: string;
    timestamp: number;
  };

  // ═══ 扩展子树: Guidance + 证书 + 上下文 ═══
  extensionSubtree: {
    extensionRootHash: string;  // Merkle Root of all extension leaves

    leaves: {
      // System Prompt 中注入的 Guidance 片段的哈希（脱敏后）
      // 每次 LLM 调用前记录——证明「当时 System Prompt 中包含了什么」
      systemPromptFragmentHash: string;

      // GuidanceReport 全文的结构化哈希（含 AdoptionRecord[]）
      guidanceReportHash: string;

      // 采纳记录的结构化哈希（AdoptionRecord[] → JCS+SHA-256）
      // 可独立验证——审计方不需要读 guidanceReportHash 全文
      adoptionRecordHash: string;

      // 注入 System Prompt 的证书片段哈希
      certFragmentHash: string;

      // 完整 System Prompt 的哈希（脱敏后，用于事后验证）
      // 敏感信息（API key 等）在哈希前已移除
      sanitizedSystemPromptHash: string;

      // 工具暴露列表哈希
      exposedToolsHash: string;

      // 预算截断报告的结构化哈希（TruncationRecord[] → JCS+SHA-256）
      // 审计方可验证「什么被丢弃了、为什么」
      truncationReportHash: string;

      // IAGP 消息的链式哈希（IAGPMessage.messageHash → chainLinkId）
      // 用于跨 Agent 审计链验证：Guardian DO ↔ Observed DO
      // 当且仅当本步涉及跨 Agent 交互（Guardian 拦截 / IAGP 消息投递）时存在。
      iagpMessageHash?: string;
      iagpChainLinkId?: string;  // 同步写入 Guardian 和 Observed 的 audit 链
    };

    // getLeafList — 获取叶子名称数组，供索引和遍历
    getLeafList(): string[];

    // Merkle Proof: 允许审计方独立验证某个 leaf
    // 无需访问完整 extensionSubtree
    generateProof(leafName: string): MerkleProof;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Module: Multi-Agent — IAGP Protocol
// ═══════════════════════════════════════════════════════════════════════════

// ═══ 跨 Agent Guidance 消息 ═══
// Guardian Agent 拦截 Observed Agent 后，通过 IAGP 消息向 Observed 传播：
//   1. 为什么被拦截（block_reason）
//   2. 可以怎么做（alternative_suggestion）
//   3. 审计锚点（decision_object_hash）

export interface IAGPMessage {
  // ═══ 消息元数据 ═══
  messageId: string;             // UUID v7（时间排序）
  timestamp: Date;

  // ═══ 通信双方 ═══
  fromAgent: {
    agentId: string;             // Guardian Agent ID
    ring: 0;                     // Guardian 始终在 Ring 0
    ruleSetVersion: string;      // Guardian 使用的规则集版本
    // Guardian 信誉分 — Observed 根据此决定是信任还是申诉
    // 公式：f(ruleFreshness, historicalAdoptionRate)
    //   ruleFreshness: 规则距离上次更新的天数（越新 ≈ 1.0，0-30 天）
    //   historicalAdoptionRate: 所有受监管 Agent 对此 Guardian 建议的历史采纳率
    // 阈值：< 0.6 → Observed 可选择“申诉优先”（走 REQUEST_HUMAN 而非盲目重试）
    credibility?: number;         // 0-1
  };
  toAgent: {
    agentId: string;             // Observed Agent ID
    ring: number;                // Observed 当前 Ring (1-3)
  };

  // ═══ Guidance 类型 ═══
  guidanceType:
    | 'block_reason'             // 被动响应：Guardian 拦截 → 解释为什么
    | 'alternative_suggestion'   // 主动建议：Guardian 未拦截但建议更好路径
    | 'context_warning'          // 上下文警告：Guardian 检测到环境异常（非操作本身）
    | 'policy_reminder'          // 策略提醒：Guardian 周期性注入策略（如数据保留到期）
    ;

  // ═══ 决策上下文 ═══
  originalDecision: {
    // 仅 block_reason / context_warning 时存在
    verdict: 'DENY' | 'CORRECT' | 'REQUEST_HUMAN' | 'THROTTLE' | null;
    decisionHash: string;        // Guardian Decision Object 的 audit.hash

    // 为什么拦截——人类可读的原因
    reason: string;              // 如 "客户数据删除操作不允许，应使用 archive 归档"

    // 违反了哪条规则
    violatedRules: Array<{
      ruleId: string;            // 如 "CMP-004-archive-not-delete"
      ruleCategory: string;      // 如 "security_compliance"
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    }>;

    // 被拦截的 tool_call 摘要（脱敏后）
    blockedToolCall: {
      toolName: string;          // 如 "deleteCustomer"
      keyArguments: Record<string, unknown>;  // 脱敏后的关键参数
    };
  } | null;

  // ═══ 建议路径 ═══
  suggestedApproach: {
    // 给 Observed Agent 的建议——Natural Language + 结构化
    naturalLanguage: string;     // 如 "请使用 archiveCustomer 代替 deleteCustomer，归档后可设置 90 天保留期"

    // 推荐的工具调用路径
    recommendedPath?: Array<{
      toolName: string;
      description: string;       // 这一步做什么
      example?: string;          // 示例参数（脱敏）
    }>;

    // 推荐的替代工具
    alternativeTools?: string[]; // 如 ["archiveCustomer", "notifyAdmin"]

    // 如果 Observed 坚持原操作，需要什么授权
    escalationPath?: {
      requiredApproval: 'human_admin' | 'supervisor_agent' | 'not_allowed';
      justificationRequired: boolean;  // 是否需要附理由
    };
  };

  // ═══ 审计锚点 ═══
  auditAnchor: {
    // Guardian Decision Object 的完整 hash——Observed 可将此写入自己的 audit 链
    guardianDecisionHash: string;

    // 消息自身哈希（JCS+SHA-256）
    messageHash: string;

    // 用于跨 Agent 审计链链接
    chainLinkId: string;         // UUID v7，同步写入 Guardian 和 Observed 的审计链
  };

  // ═══ 来源声明 ═══
  guidanceSource: 'guardian_block';  // NOTE: always guardian_block for IAGP messages. For guidance_signal and correction, see AdoptionRecord.guidanceSource.
}

// ═══ 反馈回路 — Observed → Guardian 双向闭环 ═══
// Guardian 错了却不知道 = 系统性阻滞。单向指令 → 双向闭环
// Observed 采纳建议后失败 → 回传 IAGPFeedback → Guardian 调低信誉分

export interface IAGPFeedback {
  messageId: string;
  originalMessageId: string;     // 关联的原始 IAGP 消息

  feedbackType:
    | 'adoption_failed'          // 采纳建议后操作失败
    | 'suggestion_ineffective'   // 建议已执行但未解决问题
    | 'credibility_challenge';    // 质疑 Guardian 权威性（信誉分低）

  failureContext: {
    adoptedAction: string;
    failureReason: string;
    consequence: 'error' | 'timeout' | 'task_failure';
  };

  guardianResponse: {
    action: 'adjust_credibility' | 'refine_rule_weight' | 'notify_admin';
    credibilityDelta?: number;   // 信誉分调整（如 -0.1）
  };
}

export interface IAGPRouting {
  // Observed 收到的 IAGP 消息按来源 Guardian 分组
  // JSON 序列化时转为 Record<string, IAGPMessage[]>；反序列化时重建 Map。
  guardianMessages: Map<string, IAGPMessage[]>;

  // 优先级：Guardian Ring → message timestamp
  // 同一 Ring 内的 Guardian 冲突时，Observed 的 GuidanceEngine 负责合并
  mergeStrategy: 'priority_by_ring' | 'chronological' | 'concatenate';

  // 冲突时的默认行为
  onConflict: 'defer_to_smallest_ring' | 'defer_to_most_recent' | 'report_ambiguity';
  // 默认：'defer_to_smallest_ring' — Ring 编号最小的 Guardian 优先（Ring 0 > Ring 1 > ...）
  // 符合安全域权威层级：Ring 0（安全环）的决策覆盖 Ring 1..3
  // 'report_ambiguity' 仅在审计和调试时使用，生产环境不建议默认启用

  // 建议冲突时的提示
  // "Guardian-A 建议 archiveCustomer，Guardian-B 建议 softDeleteCustomer。
  //  两者都符合合规要求。请根据业务上下文选择。"
}

/** CredibilityCalculator — Guardian 信誉分计算器
 *  公式：credibility = ruleFreshness(×0.4) + historicalAdoptionRate(×0.6)
 *    ruleFreshness: 1.0 - min(规则距上次更新天数 / 30, 1.0)（越新越可信）
 *    historicalAdoptionRate: 所有受监管 Agent 对此 Guardian 建议的历史采纳率
 *  阈值：< 0.6 → Observed 可选择"申诉优先"（走 REQUEST_HUMAN 而非盲目重试）
 */
export interface CredibilityCalculator {
  /** 计算 Guardian 的信誉分（0-1） */
  calculate(guardianId: string, records: GuidanceRecord[]): number;

  /** 处理 Observed 反馈，调整信誉分 */
  applyFeedback(guardianId: string, feedback: IAGPFeedback): number;
}