# API 参考

> **最后更新：2026-09-04 — 从 README.zh-CN.md 抽出（P1 重构）；内容未改动。**

`@openoba/rulsynor-core` 的完整公开 API：核心导出、子路径、Decision Object 字段、环境变量。快速上手与 7 步工作法见 [README](../README.zh-CN.md)。

### 核心导出（`@openoba/rulsynor-core`）

| 导出 | 说明 |
|------|------|
| `Evaluator` | 规则引擎——按环排序，first-match-wins |
| `GuardStateManager` | `within`/`rate` 有状态计数器管理 |
| `ExprTreeEvaluator` | 表达式树求值器（34 节点 / 30 运算符） |
| `safeRegExp()` | ReDoS 防护的正则构造器 |
| `buildDecisionObject(opts)` | 构建 JCS+SHA-256 决策对象（14 CORE + 15 JURISDICTION 字段，返回类型：`DecisionObject`） |
| `generateAID()` | 生成 Agent 身份标识码（OID 1.2.156.3088） |
| `getComplianceProfile()` | 辖区感知的合规自动配置 |
| `loadPresetRules()` | 加载 34 条内置 ERDL YAML 规则 |
| `toCompiledRules(rules)` | 预设规则 → `CompiledRule[]` |
| `toERDLRuleSet(rules)` | 预设规则 → ERDLRuleSet 格式 |
| `extractNavigationGuide(opts)` | Guard 决策 → 结构化 LLM 引导 |
| `advanceCorrectLoop(ctx, decision)` | CORRECT 纠偏循环状态机（3 轮重试） |
| `runReActLoop(opts)` | 最小化 ReAct 循环，内含 Guard 评估 |
| `createToolExecutor(fn)` | 将函数包装为 ToolExecutor |
| `PROVENANCE` | 版本、厂商、OID 前缀、已知限制 |
| `SystemClock` / `VirtualClock` | 时钟抽象，用于时序规则测试 |
| `OpSemRegistry` | 操作语义分类器 |
| `PlanParser` | LLM 自然语言执行计划解析器 |

### 子路径

| 路径 | 内容 |
|------|------|
| `@openoba/rulsynor-core/engine` | Evaluator, ExprTreeEvaluator, ERDLFnRegistry, PlanParser, safeRegExp, 类型 |
| `@openoba/rulsynor-core/guard` | buildDecisionObject, generateAID, DecisionObject 类型 |
| `@openoba/rulsynor-core/compliance` | getComplianceProfile, ComplianceProfile 类型, 6 框架合规 |
| `@openoba/rulsynor-core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet, PresetRule 类型 |
| `@openoba/rulsynor-core/guidance` | extractNavigationGuide — 告诉 LLM 怎么恢复 |
| `@openoba/rulsynor-core/runtime` | runReActLoop, createToolExecutor |
| `@openoba/rulsynor-core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object — CORE 14 + JURISDICTION 15 字段

**CORE 字段**（永久产出，`[FREEZE-1]` 冻结）：

```
spec · decision_id · compliance_profile · execution_trace_id · timestamp
evaluation_duration_ms · agent { id, role, version } · context { tool.name, tool.args }
rule_set_version · policies [{ name, version, hash }] · evaluation { total_evaluated,
total_matched, matched_rules } · result { decision, decision_type, reason, rules_matched }
human_oversight · audit { previous_hash, commitment, hash }
```

**JURISDICTION 字段**（仅当路径在合规画像 `activated_fields` 中才产出，否则物理省略——RFC-002 §1.1 / SPEC §5.3）：

```
model_id · agent.known_limitations · fairness_assessment · impact_assessment_id
autonomy_level · data_modification_expected · context_snapshot_hash · sanitized_context
confidence_score · signature · signing_key_id · agent.aid · agent.tool_registry_hash
agent.algorithm_filing_no · agent.model_registration_id
```

### 环境变量

| 变量 | 用途 | 默认值 |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | 合规辖区，逗号分隔：CN,EU,US,SG,BR,IN | （无 —— 未选择） |
| `RULSYNOR_INDUSTRY` | 合规行业 | （无 —— 未选择） |
| `RULSYNOR_RISK_LEVEL` | 风险等级 | （无 —— 未选择） |
| `RULSYNOR_AUTONOMY_LEVEL` | 自主权 L1-L5 | `L2` |
| `RULSYNOR_MODEL_ID` | DO 中记录的 LLM 模型 | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | AID 中的企业注册码 | `000001` |
| `RULSYNOR_AID_REQUESTER` | AID 中的部门码 | `000001` |
