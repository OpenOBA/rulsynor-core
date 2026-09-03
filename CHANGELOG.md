# Changelog

本项目的所有重要变更记录于此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
版本生命周期见 [`VERSIONING.md`](./VERSIONING.md)。

## [Unreleased]

### Added
- `VERSIONING.md`：软件版本全生命周期规范（SemVer + 阶段 + 兼容承诺 + 废弃政策）
- `RELEASING.md`：发布流程与门禁清单
- **开箱即用 CLI**：`rulsynor chat`（7 步工作法）/ `setup`（model 配置，key 只进 env 不落库）/ `rules list` / `audit list|show`（只读无导出）/ `mcp`（stdio JSON-RPC）/ `demo`（无 key 守卫演示）
- **配置底座**：`RULSYNOR_HOME` / `RULSYNOR_RULES_DIR` / `RULSYNOR_API_KEY`（env-only）
- **审计持久化**：SQLite `audit_records` 表（写入 + 只读查看，哈希幂等）
- **用户规则目录加载**：`loadRulesFromDir`（drop-in 生效）
- **LLM 结构化工具回环**：function calling（tool_call id + tool role）
- **业务上下文注入**：runtime `context` 选项 + MCP `rulsynor_guard_evaluate` 的 `context` 参数（`context.*` 规则由宿主确定性注入，非 LLM 猜）

### Changed
- 许可证：运行时 MIT → BSL 1.1（Change Date 2030-06-09，Change License GPL 3.0；非生产使用免费，见 LICENSE）
- **Decision Object v1.3 → v1.5 扁平哈希**（`erdl-do-v1.5-hash-flat`）；签名模式（ECDSA P-256）待 RFC-002 §10
- **预设规则 30 → 34**（跨工具安全规则按工具拆分：新增 SEC-025/026/027/028）
- 规则质量门禁 `no-tool-constraint`：仅对引用 `tool.*` 字段的 coding/security 规则告警，纯 `context.*` 事件规则豁免

### Fixed
- **P0 字段路径**：规范规则字段路径是 `tool.name`/`tool.args.*`（Entity 命名空间），非 `context.tool.name`——此前 30 条预设规则因上下文形状错误而静默 ALLOW，Guard 形同虚设
- **11 条跨工具安全规则缺 `tool.name` 约束**：补 tool.name / 按工具拆分（含 SEC-011 `logic:OR→AND` 语义修复）
- **`context.*` 规则休眠**：SEC-023 / CMP-001/002/003 因 runtime 不注入 `context` 而永不命中
- **ETH-001 言行一致失效**：`previous_promise` 未从计划派生，且 PlanParser 无法解析运行时 prompt 的 `op:` 标签
- 质量门禁 34 条 0 warning（原 11 warning / 30 条）

### Security
- 跨工具内容匹配规则显式 `tool.name` 约束（消除“匹配所有工具调用”的隐性越界）

## [0.1.0-alpha] - 2026-09-01

> 版本线由 `1.0.0` 重启为 `0.1.0-alpha`：引擎已对齐 Spec v2.0，但 Decision Object 仍为 v1.3 口径、待迁移 v1.5，属早期 alpha，非稳定发布。

### Added
- **确定性内核单一事实源 `erdl-schema`**：对外导出运算符/决策/节点/分类枚举
  - 运算符：`CONDITION_OPERATORS`(28) · `CONDITION_MODIFIERS`(2) · `ALL_OPERATORS`(30) · 九族分组常量
  - 决策：`DO_DECISIONS`(13) · `ALL_DECISIONS`(21) · `WORKFLOW_SUBSTATES`/`INTERNAL_REASONING`/`INTERNAL_STATES`/`RULSYNOR_EXTENSIONS` · `isDODecision()`/`isDecision()`
  - 节点：`SEMANTIC_NODES`(10 组 34 节点) · `EXPR_NODE_TYPES`(20)
  - 分类：`RULE_CATEGORIES`(11) · `RULE_NAME_PREFIXES`(14) · `OCCUPATION_CATEGORIES`(1)
  - 自证常量：`SCHEMA_COUNTS`（`.length` 派生）· `SPEC_BASELINE`（SPEC 锚点）
- **表达式树内核 `expr-tree`**：单一求值核心（Spec E7），34 节点全量编码
- **定点小数 `fixed-point`**：有理数定点求值（scale=14 half-even），替代浮点
- **V-ENGINE 201 + V-GLOSS/V-PROJ 22 = 223 条引擎向量**（S2，双实现生成制）
- **门禁**：`erdl-schema.spec.ts` 24 条一致性断言 + 上游工作空间守门器 46 项
- **eslint flat config**（eslint@9 + typescript-eslint@8）

### Changed
- **规则名前缀白名单真执行**（Breaking）：未登记前缀一律 `NON_STANDARD_NAME_FULL` 拒载
- **校验器放行域 13 → 28 条件运算符**（放宽，不破坏既有合法规则）
- **规则分类 10 → 11**（新增 `observability`）
- `getOperatorLabels()` 仅返回 28 条件运算符，修饰符改由 `getModifierLabels()` 提供
- 引擎重构：去框架依赖（仅 json-canonicalize + js-yaml）、单求值核心
- 时间节点统一 UTC 语义
- 合规：去掉默认法域/行业/风险等级（未配置即「未选择」）
- 测试 458 → 555；覆盖率语句 68% → 76%、分支 58.6% → 67.5%

### Fixed
- **4 个上线前 🔴 Blocker**：R1 dist 陈旧 / R2 number→Rational 崩溃面 / R3 runtime 决策直通 + 审计链断裂 / R4 tsconfig 悬空 import
- **QWEN 第三方审计**：1 P0 + 7 P1 + 7 P2 全修复
- **SafeRegExp 加固**：相邻量词原子检测 + 输入长度上限 10k
- 33 处编码损坏字符复原（em-dash 与中文字）

### Security
- Guard fail-close（E12 tier 折叠）
- runtime 决策穷尽分发（ESCALATE/DEFER/DELEGATE/WORKFLOW/QUARANTINE/ROLLBACK 一律不执行工具）
- 审计链锚定（previousAuditHash 落链）
- 风险条件层：risk_level=critical 强制激活 signature

## [1.0.0] - 2026-08-07

> **⚠️ 已废弃（superseded）**：过早发布，引擎未对齐 Spec v2.0，已从版本线撤回。见 [`VERSIONING.md`](./VERSIONING.md) §6。

### Added
- 首次公开发布：ERDL 规则引擎 + 25 字段 Decision Object（JCS+SHA-256）+ Guard + Compliance + Preflight + Runtime
- GB/Z 185 AID 生成、导航引导、CORRECT 纠偏环、REQUEST_HUMAN 解析
- Playground CLI、Minimal Chat Runtime、29 条预置规则
- 中英双语 README、完整法务套件（MIT/SECURITY/CODE_OF_CONDUCT/GOVERNANCE/PRIVACY/TRADEMARK）
