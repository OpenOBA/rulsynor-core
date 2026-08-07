# RFC 001 — ERDL Decision Object v1.3 · 企业 AI Agent 审计决策记录标准

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **RFC 编号**：OPENOBA-DOBJ-RFC-001
>
> **文档名称**：ERDL Decision Object v1.3 — Enterprise AI Agent Audit Decision Record Standard
>
> **版本**：Draft 4 · 2026-07-29
> **作者**：唐浩然（OpenOBA AI 执行官）
> **维护方**：OpenOBA (https://openoba.com)
> **语言**：中文（English version: OPENOBA-DOBJ-RFC-001-EN.md）
>
> **征集意见对象**：Erik Newton (Concordia)、Christopher Hopley (chopmob-cloud / AlgoVoi)、监管合规专家、联合审计委员会
> **状态**：征求意见稿 (Request for Comments) — 非最终版本。所有设计细节均可能在收到反馈后调整。
> **反馈截止日期**：2026-08-29（30 天征求意见期）
>
> **v1.3 变更摘要**：修复 Erik Newton 发现的三个问题（E1: 白皮书与代码对齐、E2: 链位置篡改检测恢复、E3: canonical_hex 从向量移入独立答案文件）+ 修复 Chris Hopley 发现的安全问题（S2: 双哈希降级修复、S3: schema_ref SSRF 防护）+ 白皮书内部一致性修复（C3: §3.3 覆盖措辞）+ 新增 LGPD/DPDP 辖区覆盖 + 异步审计队列可靠性约束 + 中小企业最小部署模式 + 实测性能基准 + 附录 C 威胁模型
>
> **关键字解释**：本文档中的 "MUST"、"MUST NOT"、"REQUIRED"、"SHALL"、"SHALL NOT"、"SHOULD"、"SHOULD NOT"、"RECOMMENDED"、"MAY" 和 "OPTIONAL" 等关键字遵循 [RFC 2119](https://datatracker.ietf.org/doc/rfc2119/) 和 [RFC 8174](https://datatracker.ietf.org/doc/rfc8174/) 的语义解释。
>
> **修订记录**：
> - Draft 1（2026-07-27）：初始版本，23 字段设计
> - Draft 2（2026-07-27）：联合审计委员会意见修订，扩展至 24 字段，增加 JCS 数值约束、冷热分离隐私方案、跨版本审计链锚定
> - Draft 3（2026-07-27）：引入平面哈希架构——extensions 直接参与主 JCS，消除中间层完整性缺口，强化扩展区防篡改保证
> - Draft 4（2026-07-29）：v1.3 第三方审计修复 + RFC 正式编号（OPENOBA-DOBJ-RFC-001），14 监管框架覆盖，威胁模型附录，实测性能基准
>
> **摘要**：本 RFC 提出 ERDL Decision Object v1.3 设计方案——一个面向企业 AI Agent 的跨实现、防篡改、多辖区兼容的审计决策记录标准。方案基于 JCS (RFC 8785) + SHA-256 密码学基础，与 IETF Agent Audit Trail (draft-sharif-agent-audit-trail-00) 技术对齐，覆盖 EU AI Act、GB/Z 185、NIST AI RMF、COSO 2026、LGPD、DPDP 等 14 个全球主要监管框架的审计要求。DO 包含 24 个顶层字段（CORE 14 + JURISDICTION 10），通过辖区激活机制实现按需适配，通过平面哈希架构确保完整性依赖密码学而非验证流程——所有字段统一参与 JCS，任何篡改直接改变 audit.hash。

---


## 目录

**第一部分：架构与设计**
1. 背景与动机（含 v1.0/v1.1 兼容声明）
2. 设计哲学：通用事实证据容器
3. 密码学基础：全链路 JCS (RFC 8785) + 平面哈希
4. Decision Object Schema：24 字段设计（CORE 14 + JURISDICTION 10）

**第二部分：合规与适配**
5. 全向兼容 × 按需适配：辖区激活机制
6. 14 监管框架兼容性
7. 生态兼容性（三方审计视角 / IETF AAT / MCP / A2A / Agent 框架 / OpenTelemetry / 审计报告输出）
8. 隐私与数据最小化设计（GDPR / LGPD / DPDP）
9. 法规版本化与升级路径

**第三部分：治理与演进**
10. 长期维护与合规演进
11. 扩展区自描述设计
12. 字段治理原则

**第四部分：验证与附录**
13. 向量集与跨实现验证
14. 征求意见事项
附录 B：参考标准
附录 C：威胁模型与安全声明

---

## 第一部分：架构与设计

---

## 1. 背景与动机

### 1.1 AI Agent 进入高监管领域

2026 年，AI Agent 已进入企业的财务、医疗、招聘、保险、关键基础设施等**高监管领域**。全球监管机构正在关闭"黑箱决策"的窗口：

- **EU AI Act**：Article 12 要求高风险 AI 系统自动记录事件日志，Article 14 要求有效人类监督
- **GB/Z 185-2026**：中国首套智能体互联国家标准，要求 28 位 AID 身份码、工具调用安全五机制、审计日志留存 ≥36 个月
- **COSO 2026**：生成式 AI 内部控制指导，要求日志/可追溯性覆盖模型版本、提示词、输入输出、审批记录
- **Colorado SB 205**：AI 决策须可解释，消费者有权申诉

企业合规团队面临一个共同的技术障碍：**不同厂商的 Agent 用不同的格式输出决策。** 审计员拿到的是 Prompt 日志 + 对话截图，不是结构化、可验证的决策记录。

### 1.2 ERDL Decision Object 的定位

ERDL Decision Object（DO）为 Agent 决策提供一个**机器可读、跨实现验证、防篡改、多辖区兼容**的标准输出格式。

它的核心承诺：

> **给定相同的规则集和上下文，任何兼容的 ERDL 实现必须产生逐字节一致的 Decision Object。**

### 1.3 为什么需要 v1.3

v1.0 和 v1.1 已被三个独立实现验证通过（Rulsynor/TypeScript [OpenOBA]、Concordia/Python [Erik Newton]、chopmob-cloud/Python [Christopher Hopley]）。但工程实践中暴露出若干需要修正的问题：

| 事项 | 来源 | v1.3 解决方案 |
|------|------|----------|
| `policies[].hash` 使用 `JSON.stringify`（非确定性） | 2026-07-27 独立审计报告 CQ-3 | 全链路 JCS (RFC 8785) |
| v1.1 DO 覆盖 7/10 决策类型，AV 覆盖 6/10（NOTIFY/ROLLBACK/QUARANTINE 的审计哈希向量缺失；DELEGATE 在 SPEC v1.2 中已定义，向量集 v1.3 预留） | 内部审计 | DO+AV 覆盖 13 种外部决策类型（10+3 WORKFLOW），DELEGATE 预留 v1.3 |
| `expected_sha256` 作为答案密钥被移除，但没有替代机制确保验证完整性 | Erik Newton, A2A #2031 | AV-008 陈旧回归向量（已被 AV-013 替代）+ 五步验证法 |
| 缺少法规版本化与辖区适配机制 | ERDL v1.3 设计 | `compliance_profile` + CORE × JURISDICTION 分层 |
| 缺少 Schema 冻结与合规演进的长期架构保障 | ERDL v1.3 设计 | 平面哈希 + content-addressable schema reference |
| v1.0/v1.1 → v1.3 迁移路径 | ERDL v1.3 设计 | 破坏性变更范围声明 + 跨版本审计链锚定（见 §1.4） |

### 1.4 v1.0/v1.1 向后兼容声明

**v1.3 是一个破坏性版本变更。** 以下变动导致 v1.3 DO 的 `audit.hash` 与 v1.0/v1.1 完全不兼容：

1. `policies[].hash` 计算方式变更（JSON.stringify → JCS canonicalize）
2. `rule_set_version` 参与 JCS 序列化（v1.1 无此字段）
3. 平面哈希架构——extensions 直接参与主 JCS，消除分层间接性带来的完整性缺口

**v1.0 和 v1.1 文件保持冻结（frozen）状态。** 现有三方验证结果作为历史档案保留。

**v1.3 发布后，所有新实现应针对 v1.3 的 101 条向量集进行验证。** Erik Newton (Concordia) 和 Christopher Hopley (chopmob-cloud) 已受邀对 v1.3 向量进行独立重新验证。验证通过后，v1.0/v1.1 向量集将被标注为"已由 v1.3 替代"。

### 1.5 征求意见的目的

本白皮书为**征求意见稿 (RFC)**，发送给：
- **Erik Newton (Concordia)**：ERDL Decision Object 的第二个独立 runner（Python 实现）。Concordia 在 v1.1 冻结期独立发现了 `expected_sha256` 答案密钥的结构性风险
- **Christopher Hopley (chopmob-cloud / AlgoVoi)**：合规 substrate 模型与跨验证愿景的提出者。独立审计了 v1.1 的 c3f22df 事故（em-dash 空格修复导致 3/7 向量 audit.hash 不匹配，commit c3f22df → 5cff368）
- **监管合规专家与联合审计委员会**：对 DO 字段设计与 14 监管框架的兼容性、平面哈希架构的长期可维护性进行审查

所有收到的反馈将在 v1.3 正式发布前公开记录并逐条回应。

---

## 2. 设计哲学：通用事实证据容器

### 2.1 核心原则

**ERDL Decision Object 定位为通用事实证据容器（Universal Fact Container），而非特定法规的申报表。**

DO 记录的是决策过程中产生的**不可变物理/数字事实**：

- Agent 使用了哪个模型（`model_id`）
- 评估了哪些规则（`policies[]`）
- 匹配了哪些条件（`evaluation.matched_rules[]`）
- 输出了什么决策（`result.decision`）
- 谁参与了监督（`human_oversight`）
- 耗时多少（`evaluation_duration_ms`）

这些"事实"在不同辖区和法规框架下保持稳定——不论法规如何演进，一条"Agent 在 2026-07-27 14:00 UTC 被拒绝执行 sudo 命令"的记录永远是一条事实。

**合规定性（这条决策是否符合某法规）由外部合规评估引擎（Policy as Code，如 OPA/Rego）读取 DO 中的事实后动态计算。** 法规对"高风险 AI"的定义变了？更新外部引擎的规则库即可，不修改 DO Schema。

### 2.2 设计原则

1. **一条 DO 自包含**：监管者打开任何一条 DO，能在 JSON 内找到所有合规所需信息，不需要跳转到外部系统。自包含的边界：DO 包含"决策元数据与哈希证据"。对于超大型 Context（如 >4KB 的文件内容），MUST 使用 `context_snapshot_hash` + `context_ref` 的引用模式，不得内联存储大文件
2. **事实与合规分离**：DO 记录事实，外部引擎判定合规。法规演进通过更新外部规则吸收，核心字段永久冻结
3. **CORE × JURISDICTION × EXTENSIONS**：14 个 CORE 字段永久不变，10 个 JURISDICTION 字段按辖区激活，extensions 层承载未来法规扩展
4. **密码学完整性**：平面哈希保护——CORE+JURISDICTION+EXTENSIONS 统一参与主 JCS
5. **只增不删（Append-Only Schema）**：字段一旦发布，只能标记为 deprecated，绝不物理删除。所有历史 DO 可被任意版本的验证器验证

---

## 3. 密码学基础：全链路 JCS (RFC 8785) + 平面哈希

### 3.1 JCS 数值类型约束

JCS (RFC 8785 §3.2.2.3) 基于 IEEE 754 双精度规范序列化 JSON number。不同语言的 IEEE 754 实现存在差异，在未加约束的情况下可能导致跨语言 JCS 序列化结果不一致：

| 语言 | 风险 |
|------|------|
| Python | 支持任意精度整数/Decimal。`12` 可能被序列化为 `12` 或 `12.0` |
| JavaScript | 仅支持双精度浮点。大整数（>2^53）精度丢失 |
| Go | `json.Marshal` 默认将整数序列化为不含小数点的形式 |

**v1.3 强制约束**：

1. **整数类型**（`evaluation.total_evaluated`、`total_matched`、`evaluation_duration_ms`、`policies[].version`、`ring` 等）MUST 由各实现保证输出为不带小数点的整数形式，且值域 MUST 在 JavaScript 安全整数范围（-(2^53-1) 至 2^53-1）内
2. **浮点/金额类型**（如 extensions 中的财务相关字段）MUST 使用字符串表达（如 `"100.50"`），禁止使用原生 number 类型
3. **禁止 NaN/Infinity**：任何参与 JCS 序列化的数值 MUST NOT 为 NaN 或 Infinity（RFC 8785 强制要求）
4. **字符串格式约束**：参与 JCS 的字符串数值 MUST 使用规范表示——禁止前后空格（`" 0.95"`）、禁止科学计数法（`"1e-3"`）、禁止前导零（`"00.95"`）
5. **Omit over Null**：所有值为 `null`、`undefined` 或空数组 `[]` 的可选字段，在传入 JCS 序列化器之前 MUST 从 JSON 树中物理删除（Omit），不得保留键名。`{"a": null}` 和 `{}` 在 JCS 下产生不同的 canonical bytes

6. ⚠️ **原始数据原样加载（extensions 专用约束）**：ERDL 不执行财务计算——不进行金额加法、汇率换算、舍入或精度规范化。extensions 中的字符串数值（如金额、税率、数量）MUST 保留业务层输出的**完整精度和原始形式**。此约束仅适用于 extensions 区域——CORE/JURISDICTION 字段遵循约束 8 的规范化规则。

7. ⚠️ **资源边界（DoS 防护）**：为防止恶意构造的 DO 耗尽验证器资源，规定以下硬性上限：(a) 单个 DO JSON 序列化后不超过 **1 MB**（含 extensions）；(b) extensions 数组不超过 **100 个条目**；(c) JSON 嵌套深度不超过 **10 层**。验证器 MUST 在解析前检查这些边界。超出任一上限的 DO MUST 被拒绝并标记为 `resource_limit_exceeded`

8. ⚠️ **CORE/JURISDICTION 数值规范化**：参与 JCS 序列化的 CORE 和 JURISDICTION 字段中的数值 MUST 遵循以下规则：(a) 整数（`evaluation_duration_ms`、`policies[].version`、`ring`、`confidence_score` 等）MUST 使用不包含小数点的原生整数序列化；(b) 任何需要小数精度的值（如规范化比例）MUST 使用最小表示法的字符串形式（`"0.95"` 而非 `"0.950"`，`"1"` 而非 `"1.0"`）；(c) 禁止 NaN、Infinity、科学计数法表示、前后空格、前导零。此约束独立于约束 6——约束 6 管理 extensions 区域的业务数据保真度，约束 8 管理参与 JCS 哈希的 CORE/JURISDICTION 字段的确定性序列化。

> 各语言实现 JCS 的具体预处理指南（Python 整数精度、Go `json.Marshal` 尾部 `.0`、Java `BigDecimal`、Rust `serde_json` 等）详见 [Runner's Guide](docs/RUNNERS-GUIDE.md) §9 "语言绑定注意事项"。

### 3.2 全链路 JCS

v1.1 中 `policies[].hash` 使用了 `JSON.stringify`。`JSON.stringify` 不保证 key 顺序——ES2015+ 在实际实现中按插入顺序序列化，但该行为不在规范中保证。不同 Node.js 版本或不同语言实现可能产生不同的字节序列。v1.3 将全部哈希统一为 JCS：

```
policies[].hash = SHA-256(JCS(policy))
```

**自引用排除约定**：计算 `policies[].hash` 时，`hash` 键 MUST 在 JCS 之前从 policy 对象中临时移除。即实际计算为 `SHA-256(JCS(policy_without_hash_key))`，计算完成后 hash 值写回。此约定适用于 Decision Object 内所有依赖自身 JCS 的哈希字段——包括 `policies[].hash` 和 `compliance_profile.profile_hash`——确保哈希不形成自引用循环。`audit.hash` 同理，通过五步验证法 Step 2 物理删除实现。

### 3.3 平面哈希架构

v1.3 的 `audit.hash` 采用平面哈希架构——Decision Object 的所有字段（CORE + JURISDICTION + EXTENSIONS）统一参与 JCS 序列化，形成单一的密码学摘要。任何字段的篡改都会直接改变 `audit.hash`，完整性保障在密码学层面而非流程层面。

> **extensions 空数组保留**：§3.1 约束 5（Omit over Null）规定空数组 `[]` MUST 在 JCS 前物理删除。**extensions 字段不适用此规则**——当 DO 无扩展数据时，extensions MUST 保留为 `[]` 并参与后续 JCS 序列化。§3.3 对 extensions 字段的规定优先于 §3.1(5)。

```
audit.hash 计算公式（五步验证法）：

  Step 1: Deep clone the decision_object
  Step 2: 物理删除自引用/外部字段
          DELETE audit.hash + DELETE signature + DELETE signing_key_id
          （extensions 保留在对象中，参与后续 JCS）
  Step 3: JCS(CORE + JURISDICTION + EXTENSIONS + audit.previous_hash + audit.commitment) → canonical_full
  Step 4: SHA-256(canonical_full) → recomputed hash
  Step 5: Compare recomputed hash with stored audit.hash
```

**设计原则**：平面架构确保完整性依赖密码学而非流程。extensions 直接参与主 JCS，篡改任何字段（包括 extensions 内部数据）都会改变 `audit.hash`。签名同理——signature 在 Step 2 被剥离，但 extensions 仍参与签名原像，确保 HIPAA/PCI DSS 要求的非否认性覆盖全部决策数据。



### 3.4 链式锚定

每条 DO 通过 `audit.previous_hash` 链接到上一条 DO 的 `audit.hash`，形成一条单向递增的审计哈希链（类似区块链的轻量链接——仅存储哈希引用，不冗余存储前序内容）。任何对链中任意记录的篡改都会破坏后续所有记录的哈希一致性。

**链断裂检测**：当验证器发现以下任一情况时，判定审计链在该位置断裂——
1. 某条 DO 的 `audit.hash` 与独立重算结果不匹配（单条篡改）
2. 某条 DO 的 `audit.previous_hash` 与上一条 DO 的 `audit.hash` 不一致（链间断裂）
3. 链中某条 DO 缺失（审计记录被物理删除）

**链断裂后的行为**：验证器 MUST 标记断裂位置（DO ID + 断裂类型），定位被篡改/删除的记录，并将断点前与断点后的 DO 分组报告。断裂点之前的链段审计完整性保持有效（篡改不向前传播），断裂点之后的链段 MUST 标记为 `chain_invalid` 且不可用于合规举证。

> 链断裂不等于全链失效。单点篡改应被精确定位而非导致整条审计链作废——这是轻量链接的核心优势：允许审计员独立验证断裂点两侧各自的完整性。

### 3.5 与 IETF AAT 的技术对齐

IETF draft-sharif-agent-audit-trail-00 使用完全相同的密码学原语：

| 对齐项 | ERDL DO v1.3 | IETF AAT |
|---------|-------------|----------|
| 规范化 | JCS (RFC 8785) | JCS (RFC 8785) ✅ 一致 |
| 摘要 | SHA-256 (FIPS 180-4) | SHA-256 (FIPS 180-4) ✅ 一致 |
| 链字段 | `audit.previous_hash` | `prev_hash` ✅ 语义一致 |
| 签名 | ECDSA P-256 (FIPS 186-5) | ECDSA P-256 (FIPS 186-5) ✅ 一致 |

---

## 4. Decision Object Schema：24 字段设计（CORE 14 + JURISDICTION 10）

### 4.1 CORE 字段（14 个 — 所有 DO 必须具备，永久冻结）

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | `spec` | const `"decision-object-v1.0"` | DO 格式标识 |
| 2 | `decision_id` | UUID v7 | 本条决策唯一标识 |
| 3 | `compliance_profile` | object | 辖区激活配置（见 §5） |
| 4 | `execution_trace_id` | UUID v7 | 跨 DO+AAT 的全局关联 ID |
| 5 | `timestamp` | ISO 8601 UTC ms | 决策时间戳 |
| 6 | `evaluation_duration_ms` | integer | 决策耗时（毫秒，整数） |
| 7 | `agent` | object | Agent 身份（id/role/version + 扩展子字段） |
| 8 | `context` | object | 评估上下文（tool.name/args 等） |
| 9 | `rule_set_version` | object | 规则集版本标识（参与 JCS） |
| 10 | `policies` | array | 激活的策略集（含 JCS 哈希 + author_id） |
| 11 | `evaluation` | object | 规则评估详情（matched_rules/totals） |
| 12 | `result` | object | 最终决策（decision/severity/reason/action_taken） |
| 13 | `human_oversight` | object | 人工监督（含 override_reason 子字段） |
| 14 | `audit` | object | 防篡改审计（hash/previous_hash/commitment） |


### 4.2 JURISDICTION 字段（10 个 — 由 compliance_profile 按需激活）

| # | 字段 | 类型 | 激活条件 |
|---|------|------|----------|
| 15 | `model_id` | string | NIST / COSO / Colorado 合规 |
| 16 | `fairness_assessment` | string | NIST / Colorado（高风险决策） |
| 17 | `impact_assessment_id` | UUID | Colorado / ISO 42001 合规 |
| 18 | `autonomy_level` | string | 新加坡 MGF / COSO 合规 |
| 19 | `data_modification_expected` | boolean | HIPAA / PCI DSS / 信通院合规 |
| 20 | `context_snapshot_hash` | string | 含 PII 场景 / 跨 Agent 验证 |
| 21 | `sanitized_context` | string | 含 PII 场景 / GDPR 合规 |
| 22 | `confidence_score` | integer | NIST AI RMF 合规（0~100，整数，表示百分比；如 95 表示 95%） |
| 23 | `signature` | string (Base64url) | HIPAA / PCI DSS（critical 决策）。ECDSA P-256 签名，覆盖除 audit/signature/signing_key_id 外的全部 DO 内容 |
| 24 | `signing_key_id` | string | 配套 `signature` 字段，标识用于验证签名的公钥版本。审计员通过此 ID 从 KMS 拉取对应公钥。不参与 JCS 序列化，不参与签名原像（签名原像 = JCS 原像，两者使用完全相同的字段集——均排除 audit.hash、signature、signing_key_id 三个字段）。其角色纯粹为密钥元数据，更换 key_id 不影响签名值 |

> **编号规则**：CORE #1–#14（永久冻结），JURISDICTION #15–#24（按需激活），EXTENSIONS 为开放式扩展区不编号。

### 4.3 extensions 字段（开放式扩展区 — 直接参与主 JCS）

每个扩展条目的自描述结构：

```json
{
  "extensions": [
    {
      "id": "unique-extension-entry-id",
      "regulatory_ref": {
        "framework": "Framework-Name",
        "version": "Version-Identifier",
        "effective_date": "YYYY-MM-DD"
      },
      "schema_ref": "sha256:...（该字段 schema 定义文档的 JCS+SHA-256，用作 content-addressable reference）",
      "field": {
        "name": "field_name",
        "type": "number:string",
        "description": "Human-readable description"
      },
      "value": "actual data"
    }
  ]
}
```

**`schema_ref` 的作用**：指向扩展字段的完整 schema 定义文档（类型、值域、来源、示例），通过哈希进行 content-addressable 检索。即使 ERDL 委员会已解散，只要该哈希值可以在内容寻址网络中检索到对应的 schema 文档，审计员就能完整理解扩展字段的语义。

### 4.4 子对象扩展字段

**agent 对象**：

| 子字段 | 类型 | 说明 |
|--------|------|------|
| `agent.id` | string | Agent 唯一标识（DID:ERDL 或 AID 格式） |
| `agent.role` | string | guardian / operator / observed |
| `agent.version` | string | Agent 软件版本号 |
| `agent.aid` | string | GB/Z 185 合规（28 位 AID 身份码） |
| `agent.known_limitations` | string[] | EU AI Act Art.13 合规 |
| `agent.tool_registry_hash` | string | GB/Z 185.7 合规 |
| `agent.algorithm_filing_no` | string | 中国算法备案号 |
| `agent.model_registration_id` | string | 中国模型上线备案号 |

**policies 对象**：

| 子字段 | 类型 | 说明 |
|--------|------|------|
| `policies[].id` | string | 策略唯一标识 |
| `policies[].name` | string | 人类可读名称 |
| `policies[].author_id` | string | 该策略的制定者 ID（COSO SoD 合规） |
| `policies[].version` | integer | 策略版本号 |
| `policies[].hash` | string | 策略完整内容的 JCS+SHA-256 哈希 |

**evaluation 对象**：

| 子字段 | 类型 | 说明 |
|--------|------|------|
| `evaluation.proposal_id` | UUID or null | 规则提案 ID |
| `evaluation.matched_rules[]` | array | 命中的规则列表 |
| `evaluation.matched_rules[].rule_id` | string | 规则 ID |
| `evaluation.matched_rules[].decision` | string | 该规则的决策 |
| `evaluation.matched_rules[].reason` | string | 原因/说明 |
| `evaluation.matched_rules[].correction` | string | 纠正内容（CORRECT 时） |
| `evaluation.matched_rules[].instruction` | string | 建议（ALLOW 时） |
| `evaluation.matched_rules[].ring` | integer | 执行环级别（0-3） |
| `evaluation.total_evaluated` | integer | 评估的规则总数 |
| `evaluation.total_matched` | integer | 命中的规则总数 |
| `evaluation.llm_raw_confidence` | integer | LLM 提供的原始置信度（整数，0~100，表示百分比；如 95 表示 95%） | 

> ⚠️ **与顶层 `confidence_score` 的区别**：`evaluation.llm_raw_confidence` 是 LLM 在本次评估中返回的原始置信度值（每次评估可能不同），属于规则引擎执行记录。顶层 JURISDICTION 的 `confidence_score` 是 NIST AI RMF 要求的可配置置信度基准（可在 JURISDICTION 中激活/配置），属于合规声明。两者独立填充，互不替代。

**human_oversight 对象**：

| 子字段 | 类型 | 必需 | 说明 |
|--------|------|:---:|------|
| `human_oversight.required` | boolean | ✅ | 该决策是否法定要求人类介入 |
| `human_oversight.status` | string | ✅ | approved / rejected / overridden / pending / not_applicable |
| `human_oversight.human_actor_id` | string | 条件 | 介入的人类操作员 ID |
| `human_oversight.timestamp` | string | 条件 | 人类操作时间（ISO 8601 UTC ms）。MUST ≥ `timestamp`——人类监督行为必须发生在 Agent 决策之后。若 status 为 not_applicable，此字段 MUST 被物理省略（Omit） |
| `human_oversight.reason` | string | 可选 | 人类操作理由 |
| `human_oversight.override_reason` | string | 条件 | 当 status 为 overridden 时 MUST — 人类推翻 Agent 决策的具体理由（EU AI Act Art.14 "有效监督" 合规） |

### 4.5 字段膨胀对比

| 部署场景 | 激活字段数 | DO 大小 |
|----------|:---:|------|
| 基础（无辖区要求，仅 CORE 14 字段） | 14 | ~1050 bytes |
| 中国（GB/Z 185 + 信通院） | 18（+ agent.aid, agent.tool_registry_hash, agent.algorithm_filing_no, agent.model_registration_id） | ~1120 bytes |
| 欧盟高风险（EU AI Act） | 17（+ agent.known_limitations, confidence_score） | ~1080 bytes |
| 美国医疗（HIPAA） | 18（+ data_modification_expected, context_snapshot_hash, sanitized_context, signature, fairness_assessment） | ~1150 bytes |
| 全球全激活（向量集） | 24 | ~1400 bytes |

---

## 第二部分：合规与适配

---

## 5. 全向兼容 × 按需适配：辖区激活机制

### 5.1 设计动机

全球部署的 Agent 可能受多个辖区法规同时约束——各辖区的法规适用范围独立，不能要求每条 DO 携带所有辖区的特有字段。

### 5.2 `compliance_profile`：声明式辖区激活

```json
{
  "compliance_profile": {
    "profile_id": "erdl-compliance-v1.3",
    "profile_hash": "sha256:a1b2c3...",
    "jurisdictions": ["EU", "CN"],
    "industries": ["financial-services"],
    "risk_level": "high",
    "activated_fields": [
      "model_id", "impact_assessment_id", "agent.known_limitations",
      "agent.aid", "agent.tool_registry_hash",
      "confidence_score", "fairness_assessment",
      "data_modification_expected", "autonomy_level",
      "context_snapshot_hash", "sanitized_context", "signature"
    ],
    "regulatory_references": [
      {
        "framework": "EU-AI-Act",
        "version": "Regulation-2024-1689",
        "amended_by": "Digital-Omnibus-2026",
        "jurisdiction": "EU",
        "effective_date": "2027-12-02",
        "requires_fields": ["evaluation_duration_ms", "human_oversight", "agent.known_limitations"]
      },
      {
        "framework": "GB-Z-185-2026",
        "version": "2026-05-22",
        "jurisdiction": "CN",
        "requires_fields": ["agent.aid", "agent.tool_registry_hash"]
      }
    ]
  }
}
```

### 5.3 三层声明

| 层级 | 字段 | 作用 |
|------|------|------|
| **辖区** | `jurisdictions` | 约束法规适用范围（CN/EU/US/SG/ALL） |
| **行业** | `industries` | 激活行业特有字段（healthcare → HIPAA, financial → SOX） |
| **风险** | `risk_level` | 激活风险相关字段（critical → signature 强制） |

### 5.4 `activated_fields` 与 Schema 裁剪规则

- 显式声明本条 DO 中哪些 JURISDICTION 字段被激活了
- 审计员打开 DO → 立即知道覆盖了哪些额外合规要求
- 字段在 `activated_fields` 中但 DO 中缺失 → 合规失败
- 字段不在 `activated_fields` 中但 DO 中有 → 冗余但不违规
- 参与 JCS 序列化 → 任何对激活字段集的篡改都会破坏 `audit.hash`

**Schema 裁剪规则（强制）**：在计算 `audit.hash` 前，DO 必须经过"序列化前裁剪"——不在 `activated_fields` 声明中的 JURISDICTION 字段 MUST 从 JSON 对象中物理移除（Omit），不得设为 null、空字符串或其他占位值。Omit 与 null 在 JCS 下产生不同的 canonical byte sequence（同 v1.1 中 delete-vs-blank 的设计理由）。各语言 SDK 必须提供"序列化前裁剪"工具函数，在 JCS canonicalize 之前执行。向量集使用全激活模式，因此裁剪规则不改变向量验证结果。

### 5.5 配置方式

`compliance_profile` 支持通过 API、CLI、配置文件、管理面板多种方式配置。企业可以手动指定 `activated_fields` 以实现自定义覆盖（如在中国部署但额外需要 NIST 的 `fairness_assessment` 字段）。

---

## 6. 14 监管框架兼容性

### 6.1 覆盖框架

| 框架 | 辖区 | 约束力 |
|------|:---:|:---:|
| EU AI Act (Regulation 2024/1689) | EU | 强制 |
| NIST AI RMF 1.0 | US | 自愿 |
| COSO GenAI 2026 | Global | 行业标准 |
| ISO/IEC 42001:2023 | Global | 可认证 |
| GB/Z 185-2026 | CN | 国家标准 |
| OWASP Agentic Top 10 2026 | Global | 行业标准 |
| IEEE P3395 | Global | 制定中 |
| HIPAA | US | 强制 |
| PCI DSS v4.0.1 | Global | 合同强制 |
| Colorado SB 205 | US-CO | 强制 |
| 新加坡 MGF for Agentic AI | SG | 最佳实践 |
| LGPD (Lei Geral de Proteção de Dados) | BR | 强制 |
| DPDP (Digital Personal Data Protection Act) 2023 | IN | 强制 |
| 中国信通院评估 2.0 | CN | 行业权威 |

### 6.2 逐框架关键要求覆盖

| 要求 | EU AI Act | NIST | COSO | ISO | GB/Z | OWASP | HIPAA | PCI | CO-SB205 | SG-MGF | CAICT |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 自动事件记录 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 防篡改 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agent 身份 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 决策可解释 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| 人工监督 | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | ✅ | ✅ |
| 规则版本追溯 | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ |
| 上下文审查 | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| 数字签名 | — | — | — | — | — | ✅ | ✅ | ✅ | — | — | — |
| 跨系统关联 | — | — | ✅ | — | ✅ | ✅ | — | — | — | — | ✅ |
| 模型版本 | — | ✅ | ✅ | — | — | — | — | — | ✅ | — | — |
| 公平性评估 | — | ✅ | — | — | — | — | — | — | ✅ | — | — |
| 影响评估 | — | — | — | ✅ | — | — | — | — | ✅ | — | — |
| 自主程度 | — | — | ✅ | — | — | — | — | — | — | ✅ | — |
| 决策耗时 | ✅ | — | — | — | — | — | — | — | — | — | — |
| 系统限制声明 | ✅ | — | — | — | — | — | — | — | — | — | — |
| 工具注册 | — | — | — | — | ✅ | — | — | — | — | — | — |
| 数据变更追踪 | — | — | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| 工作流编排 (WORKFLOW) | — | — | ✅ | — | — | — | — | — | — | — | — |
| 工作流等待 (WORKFLOW_WAITING) | — | — | ✅ | — | — | — | — | — | — | — | — |
| 工作流推进 (WORKFLOW_PROGRESS) | — | — | ✅ | — | — | — | — | — | — | — | — |
| 置信度/风险量化 | — | ✅ | — | — | — | — | — | — | — | — | — |
| 职责分离 (SoD) | — | — | ✅ | — | — | — | — | — | — | — | — |
| 算法备案 | — | — | — | — | ✅ | — | — | — | — | — | — |
| 隐私/被遗忘权 | ✅ (GDPR) | — | — | — | ✅ (PIPL) | — | ✅ | — | — | — | — |

**注**：DELEGATE 在 SPEC v1.2 中已定义，向量集 v1.3 预留。

**全部 24 项跨框架要求通过 DO 的 24 字段 + 冷热分离架构完整覆盖。**

---

## 7. 生态兼容性

### 7.1 三方审计视角总览

ERDL Decision Object 服务于三类审计用户，各自有不同的审查需求：

| 审计类型 | 角色 | 核心问题 | 审查方式 | 频率 |
|------|------|---------|---------|:---:|
| **企业内审** | 内审部门 / 合规团队 | "AI 决策是否按照既定规则执行？控制措施是否有效？" | 穿行测试、控制测试、抽样审查 | 季度/半年 |
| **第三方审计** | 外部审计师（如四大会计师事务所） | "DO 记录是否完整、不可篡改？审计链是否可独立验证？" | 实质性测试、哈希链完整性验证、独立重算 | 年度 |
| **监管审查** | 监管机构（如 EU AI Office、中国网信办） | "是否满足法规要求？" | 逐字段合规映射、高风险事件抽查 | 随时 |

三类审计共享同一套 DO 作为证据源，但使用不同的审查路径。以下各节定义了 ERDL DO 对每类审计的具体支持。

### 7.2 企业内审支持

#### 7.2.1 穿行测试（Walkthrough Test）

内审员追踪一条 DO 的完整证据链，验证"规则引擎按设计运行"：

1. **规则版本确认**：`rule_set_version.id` 与部署记录中的规则集哈希对比 → 确认使用了正确的规则版本
2. **规则触发溯源**：`evaluation.matched_rules[].rule_id` → 定位到具体规则文件中的具体规则行
3. **条件逐项验证**：`context` 中的字段值 → 与 when 条件逐项对照 → 确认匹配逻辑正确
4. **决策后果确认**：`result.decision` + `result.action_taken` → 确认 Agent 实际执行了该决策
5. **人工监督确认**：`human_oversight.status` → 确认需要人工介入的决策确实经过了审批

一条 DO 提供了一次穿行测试所需的所有证据——不需要切换到其他系统查看日志或代码。

#### 7.2.2 控制测试（Test of Controls）

COSO 五要素要求定期测试内部控制的有效性。DO 通过以下方式支持控制测试：

| COSO 控制测试 | DO 字段 | 测试方法 |
|------|---------|----------|
| 访问控制是否有效 | `result.decision` = DENY + `matched_rules[]` | 统计拦截率、抽查被拦截操作的规则触发是否合理 |
| 职责分离（SoD） | `agent.id` vs `policies[].author_id` | 确认规则制定者 ≠ 规则执行者 |
| 变更管理是否合规 | `rule_set_version.id` + `timestamp` | 追溯规则变更时间线与审批记录 |
| 人工监督是否到位 | `human_oversight.status` + `override_reason` | 统计人工介入率、审查 override 理由是否充分 |
| 系统限制是否被遵守 | `agent.known_limitations` | 确认 DO 始终在系统能力边界内运行 |

#### 7.2.3 抽样审查（Sampling）

内审员从 DO 流中按统计方法抽样：
- **按决策类型分层抽样**：如从 10,000 条 DO 中抽取 100 条 DENY、50 条 ALLOW、20 条 REQUEST_HUMAN
- **按风险加权抽样**：critical/high severity 的 DO 全量审查，medium/low 按比例抽样
- **按时间窗口抽样**：随机选择审计期内的 N 个时间窗口，每个窗口全量审查

抽样后对每条 DO 执行穿行测试。DO 的五步验证法确保样本未被筛选或篡改。

### 7.3 第三方审计支持

#### 7.3.1 独立验证

第三方审计师不依赖 Agent 运行时环境——只需要 DO 的 JSON 文件和公开的向量集：

1. **哈希链完整性验证**：遍历审计链上每条 DO，验证 `audit.previous_hash` → `audit.hash` 链接完整
2. **JCS+SHA-256 独立重算**：使用审计师自己的 canonicalizer 实现（Python/Go/Rust），重算任意 DO 的 `audit.hash` 并对比
3. **向量集验证**：使用公开的 101 条验证向量确认审计师的 canonicalizer 实现正确
4. **签名验证**：对包含 `signature` 的 DO，使用 Agent 的公钥验证 ECDSA P-256 签名

所有验证均不需要访问 Agent 运行时、规则引擎代码或企业内部系统。审计师只需 DO 的 JSON 文件即可完成全部密码学验证。

#### 7.3.2 审计工作底稿

DO 本身即为审计工作底稿（Audit Working Paper）。第三方审计师的审计程序可以引用 DO 的字段作为直接证据：

| 审计程序 | 引用的 DO 证据 |
|---------|---------------|
| "获取并检查审计期内所有高严重性决策记录" | 查询 `severity=high,critical` 的 DO 列表 |
| "验证审计链完整性" | `audit.previous_hash` 链 + 独立重算 |
| "测试关键拦截规则的有效性" | 抽取 100 条 `decision=DENY` 的 DO，逐条验证 `matched_rules` |
| "确认人类监督机制的运作" | 检查 `human_oversight` 的填充率和 override 理由 |
| "验证规则集版本与部署记录一致" | `rule_set_version.id` 与变更管理系统的记录比对 |

#### 7.3.3 跨实现可验证性

第三方审计师可以使用与 Agent 运行环境**完全不同的技术栈**验证 DO。这一性质通过公开的 101 条向量集保障——审计师先用向量集验证自己的 JCS+SHA-256 实现正确，再用同一实现对生产 DO 进行验证。这消除了"审计师必须依赖 Agent 提供商的验证工具"的信任风险。

### 7.4 与 IETF AAT 的互补定位

| 维度 | ERDL Decision Object | IETF AAT |
|------|---------------------|----------|
| **层级** | 决策评估结果 | 全操作日志 |
| **粒度** | 每次 Tool Call 的 when/then 评估 | 每次 Agent 操作 |
| **场景** | "为什么这个操作被拦截/放行？" | "Agent 做了什么操作？" |
| **深度** | 深度（policies/matched_rules/evaluation 细节） | 广度（tool_call/delegation/error/lifecycle） |
| **监管映射** | 14 框架逐字段映射 | EU AI Act + SOC 2 + ISO/PCI |

两者使用完全相同的密码学原语（JCS + SHA-256 + ECDSA P-256），通过 `execution_trace_id` 串联。

**职责边界**：ERDL DO 记录的是规则引擎的确定性评估结果（13 种决策类型）。以下运行时异常类型不属于 ERDL 规则评估的范畴，不在 DO 覆盖范围内：
- **ERROR**（Agent 运行时错误，如 LLM 调用失败、工具超时）
- **TIMEOUT**（操作超出时间预算）
- **FALLBACK**（降级/兜底决策）

这些事件可由传输层或运维层的审计协议（如 IETF AAT、OpenTelemetry span 等）独立记录。

**桥接预留**：DO 的 extensions 支持一个可选条目 `referenced_transport_events`，用于在两条连续 DO 之间记录传输层发生的关键事件（错误、超时等）的引用标识。条目格式：

```json
{
  "type": "referenced_transport_events",
  "events": [
    {
      "event_type": "ERROR",
      "event_id": "evt-xxxx",
      "timestamp": "2026-07-28T12:00:01.000Z",
      "summary": "LLM call to model X timed out after 30s"
    }
  ]
}
```

该条目为可选——不引用任何特定的传输层审计协议，仅提供通用的事件引用容器。审计员可通过 `event_id` 在对应传输层审计系统中检索详细记录，确保决策链的时间连续性不被非决策事件打断。

```
┌─────────────────────────────────────────┐
│         Agent 运行时                    │
│                                         │
│  Tool Call 发生                         │
│       ↓                                 │
│  ERDL 规则评估 → Decision Object        │  ← "为什么放行/拦截？"
│       ↓                                 │
│  Agent 执行/拒绝 Tool Call              │
│       ↓                                 │
│  IETF AAT 记录 → Audit Record           │  ← "Agent 做了什么？"
│                                         │
│  DO.execution_trace_id  ←→  AAT         │
└─────────────────────────────────────────┘
```

### 7.5 与 MCP (Model Context Protocol) 的关系

MCP 是模型与外部工具/数据源之间的开放连接标准（Anthropic 主导，2026-07-28 修订为无状态架构）。ERDL DO 与 MCP 通过以下路径集成：

**代理模式（协议层拦截）**：将危险 Tool 的 MCP 端点指向 ERDL 代理。Agent 调用 MCP Tool → ERDL Guard 拦截 → 规则评估（when/then）→ 生成 Decision Object → 放行或拦截。所有经过代理的 MCP 调用都会被 Guard 裁决；Agent 通过此路径无法到达原始 MCP Tool 端点。

**`execution_trace_id` 生成规则**：`execution_trace_id` 由 ERDL Engine 独立生成（UUID v7），作为本次决策的全局唯一标识。MCP 2026-07-28 修订已废弃 session ID，请求级标识由 Agent 客户端自行管理。DO 的 `context` 字段中可记录 `mcp_request_id` 等辅助标识，与 `execution_trace_id` 并存以支持双向追溯。`execution_trace_id` 始终为权威主键——所有外部标识符仅作为辅助索引，不参与 JCS 完整性计算。

**MCP Tool 声明**：ERDL 规则文件通过 MCP Server 暴露为 MCP Tool。Agent 在 MCP 工具列表中看到 ERDL 规则验证能力，通过标准 MCP 协议调用。

### 7.6 与 A2A (Agent-to-Agent Protocol) 的关系

A2A 是 Google 推动的 Agent 间通信标准。ERDL DO 的集成路径：

**Agent Card 扩展**：Agent 的 A2A Agent Card 中声明 `erdl` 扩展，携带合规配置文件和可接受的决策类型列表。对端 Agent 在委派任务前可通过该扩展了解目标 Agent 的规则约束。

`erdl` 扩展的标准 JSON 结构：
```json
{
  "extensions": {
    "erdl": {
      "spec_version": "v1.3",
      "compliance_profile": {
        "profile_id": "erdl-compliance-v1.3",
        "jurisdictions": ["EU"],
        "industries": ["financial-services"]
      },
      "supported_decisions": ["ALLOW", "DENY", "CORRECT", "REQUEST_HUMAN", "ESCALATE", "NOTIFY", "EMERGENCY_HALT", "QUARANTINE", "ROLLBACK", "WORKFLOW"],
      "guard_enabled": true,
      "verification_endpoint": "https://agent.example.com/.well-known/erdl/verify",
      "rules_hash": "sha256:a1b2c3..."
    }
  }
}
```

**跨 Agent 审计链**：DO 的 `decision_id` 被 A2A Task 消息引用，DO 的 `execution_trace_id` 串联整个 A2A 委派链。多 Agent 场景中的每个决策节点都生成独立的 DO，通过 `audit.previous_hash` 形成跨 Agent 审计链。

### 7.7 与主流 Agent 框架的关系

ERDL DO 不绑定任何特定 Agent 框架。以下集成模式适用于所有主流框架：

| 框架 | 集成模式 | DO 生成时机 |
|------|---------|------------|
| **OpenClaw** | NATIVE — ERDL Guard 内置在工具调用管道中 | Agent 每次 tool call 前自动生成 DO |
| **LangChain / LangGraph** | MIDDLEWARE — 通过 ToolMiddleware 插入 ERDL Guard | 每次 Tool 调用前拦截 + 生成 DO |
| **CrewAI** | MIDDLEWARE — 通过 Crew 的 before_tool_call hook | 同上 |
| **AutoGen** | MIDDLEWARE — 通过 AssistantAgent 的工具拦截机制 | 同上 |
| **任何支持 MCP 的框架** | MCP MODE — 通过 MCP 代理模式 | 同上 |
| **自定义 Agent** | SDK — 导入 ERDL Engine + DO Builder 库 | 应用程序代码调用 |

**集成原则**：ERDL DO 不要求 Agent 框架修改其核心架构。只要求框架在 Tool Call 执行前提供一个拦截点（hook / middleware / proxy），ERDL Engine 在拦截点进行规则评估并生成 DO。

**性能考虑**：MIDDLEWARE 和 MCP MODE 集成模式下，每次 Tool Call 需要一次外部 RPC 调用到 ERDL Engine（单次调用延迟约 2-5ms，取决于部署拓扑）。对于延迟敏感的场景（如高频 Agent），建议采用 NATIVE 模式（同进程内嵌 ERDL Engine）或异步审计架构（§9.4）。

### 7.8 与 OpenTelemetry 的关系

ERDL 审计记录输出为 OTLP Span。每个规则触发生成一个 Span：

```
Span: ERDL-Rule-Evaluation
  ├── decision_id: "018c4a3e-..."
  ├── result.decision: "DENY"
  ├── total_evaluated: 1
  ├── total_matched: 1
  └── parentSpanId: ← execution_trace_id 映射
```

跨 Agent 审计链通过 `execution_trace_id` → OTLP `parentSpanId` 映射。兼容现有 APM 和可观测性基础设施。

### 7.9 审计报告输出格式

ERDL Decision Object 的审计生命周期分为三个阶段：**生成 → 存储 → 报告**。DO 是链上原始证据，审计报告是对 DO 流的结构化查询结果。

#### 7.9.1 审计查询接口

合规审计员通过标准 REST API 查询 DO 存储库，获取结构化的审计报告：

```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &jurisdiction=EU
  &decision=DENY,REQUEST_HUMAN
  &severity=high,critical
  &agent_id=agent-001
```

支持的查询维度：

| 维度 | 字段 | 审计用途 |
|------|------|----------|
| 时间范围 | `timestamp` | 审计期界定 |
| 辖区 | `compliance_profile.jurisdictions` | 法规覆盖确认 |
| 决策类型 | `result.decision` | 拦截/放行统计 |
| 严重性 | `result.severity` | 风险事件定位 |
| 执行动作 | `result.action_taken` | 操作后果统计（blocked/halted/escalated） |
| Agent | `agent.id` | 行为归因 |
| 工具 | `context.tool.name` | 操作审计 |
| 规则 | `evaluation.matched_rules[].rule_id` | 规则触发溯源 |
| 人工监督 | `human_oversight.status` | 人工介入确认 |

语义查询示例——"查询所有被拦截的操作"：
```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &action_taken=blocked,halted,quarantined,rolled_back
```

语义查询示例——"查询所有需要人工介入但未处理的操作"：
```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &human_oversight_status=pending
```

#### 7.9.2 标准审计报告格式

```json
{
  "report_type": "ERDL-Audit-Report-v1.3",
  "report_id": "018c4a3e-0000-7000-8000-000000000099",
  "generated_at": "2026-07-27T15:00:00.000Z",
  "query": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-27T23:59:59.999Z",
    "jurisdiction": "EU",
    "decisions": ["DENY", "REQUEST_HUMAN"]
  },
  "summary": {
    "total_decisions": 1247,
    "by_decision": {
      "ALLOW": 892,
      "DENY": 203,
      "CORRECT": 87,
      "REQUEST_HUMAN": 42,
      "NOTIFY": 15,
      "ESCALATE": 5,
      "EMERGENCY_HALT": 2,
      "WORKFLOW": 1
    },
    "by_severity": {
      "none": 892,
      "low": 15,
      "medium": 134,
      "high": 203,
      "critical": 3
    },
    "by_agent": {
      "agent-001": 623,
      "agent-002": 624
    },
    "by_tool": {
      "exec": 312,
      "write_file": 285,
      "read_file": 410,
      "web_search": 240
    },
    "human_oversight_events": 42,
    "chain_integrity_alerts": 0,
    "first_decision_timestamp": "2026-07-01T00:03:12.000Z",
    "last_decision_timestamp": "2026-07-27T23:58:45.000Z",
    "chain_verified": true
  },
  "compliance_profile_applied": {
    "profile_id": "erdl-compliance-v1.3",
    "jurisdictions": ["EU"],
    "industries": ["financial-services"],
    "activated_fields": ["model_id", "impact_assessment_id", "agent.known_limitations", "human_oversight"]
  },
  "high_severity_decisions": [
    {
      "decision_id": "018c4a3e-0001-7000-8000-000000000001",
      "timestamp": "2026-07-27T14:00:00.000Z",
      "agent_id": "agent-001",
      "decision": "DENY",
      "severity": "high",
      "tool": "exec",
      "rule_triggered": "FIN-SEC-001",
      "reason": "exec blocked by financial security policy"
    }
  ],
  "chain_integrity": {
    "verified": true,
    "total_records_checked": 1247,
    "chain_breaks": 0,
    "first_hash": "sha256:abc...",
    "last_hash": "sha256:xyz..."
  }
}
```

#### 7.9.3 合规就绪声明

审计报告可作为监管审查的直接输入。报告本身通过 `report_id` + `generated_at` + `chain_integrity` 三元组自证完整性。

**`chain_verified` 的验证方式**：审计系统遍历链上每条 DO 的 `audit.previous_hash` → `audit.hash` 链接，全部匹配后标记为 `true`。监管者可通过以下方式独立验证：
1. 要求提供链上任意一条 DO 的完整 JSON
2. 使用五步验证法（§13.3）重算该 DO 的 `audit.hash`
3. 对比重算结果与链上存储值
4. 逐条回溯 `previous_hash` 链至 `first_hash`

任何单条 DO 的篡改都会导致后续所有 DO 的 `audit.hash` 不匹配，`chain_verified` 变为 `false` 并标记断裂位置。

报告支持以下格式输出：
- **JSON** — 机器可读取（API / CI/CD 集成）
- **CSV** — 表格审计（Excel / 审计工具导入）
- **SARIF** — 静态分析结果交换格式（GitHub Code Scanning 兼容）
- **PDF** — 盖章交付（通过模板引擎渲染）

#### 7.9.4 与 SIEM/SOAR 的集成

审计报告支持导出为 OCSF (Open Cybersecurity Schema Framework) 格式，兼容 Splunk、Elastic、Microsoft Sentinel 等 SIEM 系统。核心字段映射：

| DO 字段 | OCSF 字段 | OCSF 类型 |
|---------|----------|----------|
| `decision_id` | `metadata.uid` | string |
| `timestamp` | `time` | timestamp_t |
| `result.decision` | `finding_info.title` | string |
| `result.severity` | `severity_id` | integer (0-5) |
| `result.reason` | `finding_info.desc` | string |
| `agent.id` | `device.uid` | string |
| `context.tool.name` | `unmapped.action_name` | string |
| `evaluation.matched_rules[].rule_id` | `finding_info.uid` | string |
| `human_oversight.status` | `status_detail` | string |
| `audit.hash` | `metadata.correlation_uid` | string |

当 `result.decision` 为 `DENY`/`EMERGENCY_HALT`/`QUARANTINE` 时，自动触发 SOAR playbook。OCSF 的 `activity_id` 映射为 `3`（Deny）或 `5`（Block）以触发 SIEM 告警规则。

---

## 8. 隐私与数据最小化设计（GDPR / LGPD / DPDP）

**场景：数据被遗忘权（GDPR Art.17 / LGPD Art.18 / DPDP §12）与防篡改 Hash 链的共存**

GDPR Article 17 赋予数据主体删除其个人数据的权利。但 Decision Object 通过 Hash 链固化——如果 DO 的 `context` 包含用户 PII，直接删除会导致整条哈希链断裂。

**v1.3 冷热分离方案**：

```
┌─────────────────────────────────────────────────┐
│ 审计链（不可变）                                  │
│                                                 │
│  DO: { context_snapshot_hash: "sha256:abc..." }  │  ← 只存 Hash
│  DO: { context_snapshot_hash: "sha256:def..." }  │
│  DO: { sanitized_context: "tool=exec, args=<PII>" }│ ← 脱敏版本
│                                                 │
└──────────────┬──────────────────────────────────┘
               │ 通过 context_snapshot_hash 索引
               ▼
┌─────────────────────────────────────────────────┐
│ 冷存储（可物理删除）                              │
│                                                 │
│  DO-001.context.raw → 用户张三, 信用卡 1234...    │  ← 原始 PII
│                                                 │
│  GDPR/LGPD/DPDP 删除请求 → 删除冷存储中的原始记录       │
│  审计链不变 → context_snapshot_hash 仍可验证      │
│  监管审查 → 通过 sanitized_context 获取关键语义     │
└─────────────────────────────────────────────────┘
```

**核心原则**：
1. 审计链只存 Hash — 不存储原始 PII
2. 原始 Context 落入冷存储 — 支持物理删除
3. GDPR/LGPD/DPDP 删除 = 删除冷存储中的原始记录
4. 冷存储保留策略遵循各辖区法定最短保留期
5. 热/冷存储的分界线由 `context_snapshot_hash` 与 `sanitized_context` 字段划定

**存储层行为契约（面向冷存储实现者）**：

ERDL 不规定冷存储的具体实现（S3 Glacier、Azure Cool Blob、本地磁带等均可），但要求冷存储层满足以下行为契约以确保审计链完整性：

1. **写入不可变性**：冷存储中的记录一旦写入即不可修改。任何"更新"操作 MUST 生成为新版本记录，通过 `previous_hash` 链式引用原记录。
2. **读取校验**：冷存储 SHOULD 支持通过 `audit.hash` 检索对应的完整 DO 记录，并 SHOULD 在返回时附上存储时的 SHA-256 校验和以检测静默数据损坏。
3. **保留期治理**：冷存储 MUST 维护每条记录的 `retention_until` 时间戳（基于辖区法定最短保留期计算），到期前禁止物理删除。已删除的记录 MUST 在存储层保留删除日志（记录 ID + 删除时间 + 操作者）。
4. **存储位置可追溯**：每条冷记录 SHOULD 记录其存储位置（URI、ARN 或物理存档编号），以便审计员在 DO 的 `context` 或 extensions 中定位对应的原始数据。

> 上述契约不规定具体的 CRUD API——各存储厂商可在满足行为约束的前提下自由实现。核心要求是：写入后不可篡改、读取时可校验、到期前不可删、删除有日志。

---

## 9. 法规版本化与升级路径（含异步审计架构、双哈希过渡方案、存储优化）

### 9.1 增量升级（法规更新，不改字段）

以 EU AI Act 合规截止日从 2026-08-02 推迟到 2027-12-02 为例：

1. 更新 `compliance_profile.regulatory_references` 中 EU AI Act 条目的 `effective_date` 和 `amended_by`
2. 重新计算 `compliance_profile.profile_hash`（计算时 MUST 先临时移除 `profile_hash` 键自身，按 §3.2 自引用排除约定）
3. `profile_hash` 参与 JCS 序列化 → `audit.hash` 改变
4. 审计链上所有后续 DO 的 `audit.previous_hash` 指向新的 `audit.hash`

审计价值：监管者可以精确追溯到"合规配置何时发生变更"。

### 9.2 结构性升级（新法规要求新字段）

不在 CORE 或 JURISDICTION 中新增字段。通过 extensions 区的自描述条目承载：

```jsonc
"extensions": [
  {
    "id": "eu-ai-act-2027-amendment-carbon",
    "regulatory_ref": { "framework": "EU-AI-Act", "version": "2027-Amendment-Art-12b", "effective_date": "2027-12-02" },
    "schema_ref": "sha256:...",
    "field": { "name": "carbon_footprint_kg", "type": "number:string", "description": "..." },
    "value": "0.042"
  }
]
```

**核心优势**：extensions 条目直接参与主 JCS 序列化。任何合规要求的变更——无论是新增字段还是修改现有字段——都会直接反映在 `audit.hash` 中，确保审计链的完整性由密码学保证。

### 9.3 跨版本审计链锚定（v1.1 → v1.3）

`audit.previous_hash` 仅是一个指向上一条 DO 最终 `audit.hash` 值的字符串引用——它不参与"被引用记录的 JCS 序列化"。v1.3 的第一条 DO 的 `audit.previous_hash` 可以直接填入 v1.1 最后一条 DO 的 `audit.hash` 值，证据链不因此断裂。

### 9.4 异步审计架构（性能工程指南）

v1.3 DO 生成需要执行：1x extensions JCS + SHA-256、1x 主对象 JCS + SHA-256、可选的 1x ECDSA P-256 签名。整套密码学操作耗时约 2-5ms（Node.js，V8 优化后）到 25ms（Python/GIL）。对于每秒处理 100+ Tool Call 的高频 Agent，建议采用异步审计架构：

```
Agent 主线程                    审计 Worker 集群
    │                               │
    ├─ 生成 DO 明文 JSON ──────────→ 推入消息队列 (Kafka/Redis Stream)
    │  (<1ms)                        │
    │                          ┌────┴────┐
    │                          │ Deep Clone│
    │                          │ JCS ext  │
    │                          │ SHA-256  │
    │                          │ JCS core │
    │                          │ SHA-256  │
    │                          │ ECDSA P-256│
    │                          └────┬────┘
    │                               │
    │                          ┌────┴────┐
    │                          │ 写入不可变│
    │                          │ 存储(WORM)│
    │                          └─────────┘
```

Agent 主线程只负责生成 DO 明文 JSON 并推送到内存队列，旁路审计 Worker 集群异步执行密码学操作和持久化。此架构将 DO 生成对 Agent 主流程的延迟影响降至 <1ms。

> ⚠️ **队列可靠性约束**：异步架构的性能优势依赖于消息队列不丢失 DO。队列丢失 = DO 缺失 = 审计链断裂 = 合规举证能力丧失。为此规定以下可靠性要求：
>
> 1. **持久化写入**：消息队列 MUST 支持磁盘持久化写入（如 Kafka `acks=all`、Redis Stream `XADD ... MAXLEN` 同步刷盘）。禁止使用纯内存暂存后异步刷盘的模式——进程崩溃时未落盘 DO 永久丢失
> 2. **至少一次投递**：Worker 处理 MUST 支持幂等去重，队列 MUST 保证至少一次投递（at-least-once）语义。使用 `decision_id` 作为幂等键
> 3. **预写日志（WAL）兜底**：DO 明文 JSON 在入队前 SHOULD 写入本地预写日志（简化为追加模式的 CSV 或 JSONL 文件），作为消息队列不可用时的最后防线
> 4. **Worker 崩溃恢复**：Worker 崩溃后重启 MUST 重放未完成的批次。可基于消息队列的 consumer group offset 或 WAL 中的完成标记实现
> 5. **完整 DO 丢失告警**：当检测到连续 DO 缺失（如 `audit.previous_hash` 链断裂）时 MUST 触发告警——丢失的证据可能已被恶意删除而非队列故障

> **性能基准参考**（Node.js v24.18.0 · Intel i7-9700 @ 3.0GHz · 2026-07-29 实测）：
>
> | 部署模式 | 单 DO 验证延迟 | 75 DO 全量验证 | 适用规模 |
> |---------|:---:|:---:|------|
> | NATIVE 同进程（最小部署） | **~110 µs** | ~8 ms | < 50 Tool Call/s |
> | NATIVE + 本地 JSONL | ~120 µs（含写盘） | ~9 ms | < 50 Tool Call/s |
> | 异步 Worker 集群 | 主线程 <1ms（入队） + Worker ~110µs | — | > 50 Tool Call/s |
>
> 单 DO ~3KB JSON，验证路径：深拷贝 → JCS → SHA-256 → 比对。延迟瓶颈是 JSON 深拷贝（`JSON.parse(JSON.stringify(...))`，约占 60%），JCS 序列化占 25%，SHA-256 占 15%。不同语言实现的延迟差异见 §7.7 集成性能说明。

### 9.5 存储优化指南

#### 最小部署模式（SMB / 中小企业）

异步 Worker 集群架构（§9.4）是可选的性能优化路径，不是部署前提。对于 Tool Call < 50 次/秒的场景（大多数中小企业），推荐以下最小部署模式：

1. **NATIVE 同进程模式**：ERDL Engine 内嵌在 Agent 进程中，DO 生成在主线程完成。Node.js v24 实测：单个 DO（~3KB）完整验证（深拷贝 → JCS → SHA-256 → 比对）耗时 **~110 µs**——即使 10 次 Tool Call/秒，DO 生成仅占总 CPU 的 0.1%
2. **本地 JSONL 存储**：DO 以追加模式写入单文件（`erdl_audit.jsonl`），每行一条 DO——无需 Kafka、Redis、Worker 集群
3. **渐进式升级路径**：当 Tool Call 达到 50 次/秒 → 引入本地消息队列（Redis Stream）；达到 500 次/秒 → 引入独立 Worker 集群 + WORM 存储
4. **最低硬件配置**：NATIVE + JSONL 模式可在 1 vCPU / 512MB RAM 的轻量容器中运行

> **原则**：从单进程 JSONL 开始。只有当你到达瓶颈时才添加基础设施——不要在第一天就设计企业级部署架构。

#### 企业部署模式

- **在线热查询**：使用 Elasticsearch/ClickHouse 存储解析后的结构化字段（如 decision、severity、timestamp），用于实时监控和快速检索
- **冷归档存储**：用于防篡改校验的 DO JSON 可经 Brotli 或 Zstandard 压缩后归档（节省 60%+ 存储成本）。压缩不影响 JCS 验证——验证时先解压再重算 `audit.hash`
- **合规留存**：各辖区最短保留期见 §8（冷热分离架构）

### 9.6 双哈希过渡方案（密码学演进）

当 SHA-256 在未来（如 2035 年）被标记为 Legacy 时，过渡期 DO 的 `audit` 对象应同时包含旧哈希和新哈希：

```jsonc
"audit": {
  "hash_sha256": "sha256:...",
  "hash_sha512": "sha512:...",
  "previous_hash": null,
  "commitment": "..."
}
```

- **过渡期间**：验证器 MUST 验证**所有存在的哈希值**。验证器支持的最强算法 MUST 包含在内。单一算法验证通过而忽略其他哈希值（"至少一个"策略）构成算法降级（CWE-757），禁止使用。
- **SHA-256 彻底废弃后**：移除 `hash_sha256` 字段（作为 deprecated 字段遵循 §12 的 Deprecation 治理原则）

---

---

## 第三部分：治理与演进

## 10. 长期维护与合规演进

### 10.1 CORE 字段冻结保证

```
┌──────────────────────────────────────────────────────────┐
│                    Decision Object                       │
│                                                          │
│  ┌─────────────────────────────┐                         │
│  │      CORE (14 fields)       │  ← 永久冻结               │
│  │      永不修改                │  参与主 JCS 序列化         │
│  └─────────────┬───────────────┘                         │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │   JURISDICTION (10 fields)  │  ← 按辖区激活               │
│  │     由 activated_fields 控制  │  参与主 JCS 序列化         │
│  │     Omit 规则适用            │                         │
│  └─────────────┬───────────────┘                         │
│                │                                          │
│           JCS(core + jurisdiction)                        │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │   EXTENSIONS (open-ended)   │  ← 独立自描述               │
│  │     每条携带 schema_ref      │  直接参与主 JCS，保留全部语义 │
│  │     直接参与主 JCS           │  不可由 ERDL 自身修改        │
│  └─────────────┬───────────────┘                         │
│                │                                          │
│           JCS(core + jurisdiction + extensions + previous_hash + commitment)           │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │  audit.hash = SHA-256(      │                         │
│  │    JCS(core + jurisdiction  │                         │
│  │      + extensions           │                         │
│  │      + previous_hash        │                         │
│  │      + commitment)          │                         │
│  │        )                    │                         │
│  │    ↑ extensions、previous_hash、│                         │
│  │      commitment 直接参与         │                         │
│  │      主 JCS 序列化               │                         │
│  │  )                          │                         │
│  └─────────────────────────────┘                         │
└──────────────────────────────────────────────────────────┘
```

### 10.2 长期演进保障

| 年份 | 事件 | 对 DO 的影响 | 验证器行为 |
|------|------|------------|-----------|
| 2026 | v1.3 发布 | CORE 14 + JURISDICTION 10 发布 | 全量验证 |
| 2028 | 新 EU AI Act Amendment 要求碳排放记录 | extensions 区追加条目 | audit.hash 自动覆盖新字段 |
| 2030 | 量子计算威胁 SHA-256 | 启动双哈希过渡方案 | 参见 §9.6 |
| 2032 | 新国际条约要求 Agent 决策记录包含人权影响评估 | extensions 区追加条目 | audit.hash 自动覆盖全部字段 |

---

## 11. 扩展区自描述设计

### 11.1 条目结构

```json
{
  "extensions": [
    {
      "id": "eu-ai-act-2027-amendment-carbon",
      "regulatory_ref": {
        "framework": "EU-AI-Act",
        "version": "2027-Amendment-Art-12b",
        "effective_date": "2027-12-02"
      },
      "schema_ref": "sha256:e3f5a7b9c1d2...",
      "field": {
        "name": "carbon_footprint_kg",
        "type": "number:string",
        "description": "One-time carbon footprint of this AI decision in kg CO2e"
      },
      "value": "0.042"
    }
  ]
}
```

### 11.2 `schema_ref` 的 content-addressable 机制

`schema_ref` 是一个 JCS+SHA-256 哈希，指向该字段的完整 schema 定义文档：

```json
{
  "id": "eu-ai-act-2027-amendment-carbon",
  "schema_version": "2027-03-15",
  "field_name": "carbon_footprint_kg",
  "type": "number:string",
  "format": "Decimal string with up to 6 decimal places",
  "value_domain": ">= 0",
  "source": "EU AI Act 2027 Amendment, Article 12b",
  "contact": "eu-ai-office@ec.europa.eu",
  "example": "0.042"
}
```

**长期适用性**：审计员不需要依赖 ERDL 委员会仍在维护。只要 `sha256:e3f5a7b9c1d2...` 这个哈希值可以在任意的 content-addressable 网络（IPFS、Git、对象存储、法规存档系统）中检索到对应的 schema 文档，就能完整理解 `carbon_footprint_kg` 字段的语义。

> ⚠️ **安全性约束**：验证器/审计工具 MUST NOT 在验证过程中自动发起对外部网络的 schema 检索。解析 schema_ref 必须遵循离线优先原则：(1) 使用本地预置白名单 schema 库；(2) 若需外部检索，目标地址必须在配置白名单内；(3) 响应体积不得超过 1MB 上限。自动 fetch 任意 URL 是 SSRF 攻击面，禁止在生产验证路径中启用。
>
> **本地缓存与过期策略**：content-addressable 网络（IPFS、Git 等）的可用性不构成密码学保证。为确保 schema 在法定期限内可解析，建议：(a) 验证器部署时预置完整的 schema 缓存副本（包括所有已知 schema_ref 的映射）；(b) 缓存条目附带 `last_fetched` 时间戳和 `valid_until` 有效期——过期条目触发后台刷新而非阻塞验证；(c) 若某个 `schema_ref` 在缓存中缺失且外部网络不可达，验证器 SHOULD 标记该扩展字段为 `semantics_unresolved` 但不阻断整个 DO 的哈希验证——哈希正确性不依赖 schema 解析。

---

## 12. 字段治理原则

### 12.1 只增不删（Append-Only Schema）

- **CORE 字段**：永久冻结。除非发现密码学安全漏洞，否则永远不会修改、删除或重排
- **JURISDICTION 字段**：可以新增（随着新法规），但绝不删除已有字段
- **废弃（Deprecation）**：当某字段不再被任何法规要求时，标记为 `deprecated`。验证器的宽容模式：deprecated 字段存在 → 正常验证；不存在 → 不报错
- **extensions**：开放式，随时可追加新条目

### 12.2 不变量

以下不变量在任何未来版本中保持不变，确保所有历史 DO 可被任意版本的验证器验证：

1. `spec` 始终为 `"decision-object-v1.0"`（版本区分通过 `compliance_profile.profile_id` 完成，如 `"erdl-compliance-v1.3"`）
2. `audit.hash` 始终使用平面哈希公式（JCS(core+jurisdiction+extensions+previous_hash+commitment) → SHA-256）
3. 密码学原语：JCS (RFC 8785) + SHA-256 (FIPS 180-4)（参数化：未来可配置更强的哈希算法，但 SHA-256 作为默认仍被支持）
4. 五步验证法的基本流程（删除 audit.hash/signature/signing_key_id、JCS+SHA-256 全部字段、比对存储哈希）

### 12.3 治理生命周期

```
[Proposal] → [RFC] → [Community Review ≥ 30 days] → [Adoption] → [Stable] → [Deprecated]
                                                                               ↓
                                                                       [Retained Forever]
```

---

## 第四部分：验证与附录

---

## 13. 向量集与跨实现验证

### 13.1 验证原则

> **给定相同的规则集和上下文，任何兼容的 ERDL 实现必须产生逐字节一致的 Decision Object。**

中立性是被测出来的，不是宣称出来的。

### 13.2 向量集规模

| 类别 | 数量 | 说明 |
|------|:---:|------|
| 静态决策向量 | 63 | 13 种外部决策类型 + 13 运算符全覆盖 + 空值传播/类型安全/速率限制边缘情况穷尽 |
| 动态决策向量 | 26 | 时间戳(10) + 种子(8) + 状态(8) |
| 审计哈希向量 | 12 | AV-001~AV-007 + AV-009~AV-013（含 AV-013 链完整性金丝雀，AV-008 已被 AV-013 替代） |
| **总计** | **101** | |

**注**：v1.3.1 从向量文件中完全移除了 `canonical_hex`（JCS 直接输出的十六进制编码）。AV 向量改用 `diag_hash`（`audit.hash` 前 14 字符，即 `"sha256:" + 8 位十六进制）作为调试锚点——SHA-256 是单向函数，`diag_hash` 不能反推 JCS 输出，无法用于绕过 JCS 实现的作弊。完整 `canonical_hex` 答案集保存在独立答案文件 `decision-object-answers-v1.3.json` 中，仅供开发诊断使用。合规运行 MUST NOT 读取答案文件。

### 13.3 五步验证法

**前置原则**：验证器在提取 `claimed_hash` 后，MUST 对 DO 进行深拷贝。后续所有物理删除操作 MUST 在克隆体上进行。

> **Schema 裁剪已由 DO 生成器完成**：DO 在构建时已完成 Schema 裁剪——未在 `activated_fields` 中声明的 JURISDICTION 字段已从 DO 对象中物理移除。五步验证法接收的是已裁剪的 DO，不重复执行裁剪操作。

```
Step 1: Deep clone the decision_object
Step 2: 物理删除自引用/签名字段（保留 previous_hash 和 commitment）
        DELETE audit.hash
        DELETE signature
        DELETE signing_key_id
        （extensions 保留，audit.previous_hash 保留，audit.commitment 保留——全部参与 JCS）
Step 3: JCS(CORE + JURISDICTION + EXTENSIONS + audit.previous_hash + audit.commitment) → canonical bytes
Step 4: SHA-256 (FIPS 180-4) → recomputed hash
Step 5: Compare recomputed hash with stored audit.hash
```

**关键变动（v1.3 vs v1.2（v1.2 是未发布的中间设计版））**：v1.2 错误地删除了整个 `audit` 对象（`DELETE clone.audit`），导致 `audit.previous_hash` 和 `audit.commitment` 被排除在 JCS 原像之外。v1.3 修正为仅删除 `audit.hash`，确保链完整性检测覆盖 `previous_hash`——任何篡改链中记录位置的行为都会改变 `audit.hash`。

### 13.4 链完整性金丝雀（AV-013）

向量集包含一条**链位置篡改金丝雀**：AV-013 的 `audit.previous_hash` 被篡改为 `sha256:ffff...`（指向链外），`audit.hash` 则是一个 regressed runner（删除整个 audit 对象，不含 `previous_hash` 在 JCS 原像中）对该篡改 body 计算出的摘要。

- **正确 runner**（只删 `audit.hash`，含 `previous_hash` 在 JCS 原像中）：MISMATCH——因为 body 中携带的篡改 `previous_hash` 与计算 `audit.hash` 时所用的不同
- **Regressed runner**（删整个 `audit` 对象，不含 `previous_hash` 在 JCS 原像中）：MATCH——因为 `previous_hash` 被忽略，两个 body 产生相同的摘要。金丝雀**捕获此回归**。

此设计延续 v1.1 AV-008 的模式（v1.3 中 AV-008 已被 AV-013 替代作为链完整性金丝雀）：stored hash = regressed runner 会算出的值，使包含和不包含 `previous_hash` 的实现在金丝雀上产生可区分的不同结果。

> 验证器不得通过硬编码向量 ID 来特殊处理此向量。所有 12 条审计向量 MUST 经过相同的五步验证流程。

### 13.5 兼容等级

| 等级 | 要求 | 向量数 |
|:---:|------|:---:|
| L1 Basic | v1.0 全部 28 条 | 28 |
| L2 Verified | v1.1 全部 45 条 | 45 |
| L3 Full | v1.3 全部 101 条（含 AV-013 链完整性金丝雀） | 101 |

### 13.6 答案文件与诊断锚点

**答案文件**：`decision-object-answers-v1.3.json` 包含所有 75 条向量的完整 `canonical_hex` 预计算值，用于开发调试。**合规运行 MUST NOT 读取答案文件**——读取正确答案绕过 JCS 实现，违反独立验证承诺。

- 答案文件与向量文件分离管理
- CI/CD 合规管道应配置答案文件为不可访问
- 建议的获取流程：开发者提交初步实现 → 通过邮件/工单申请 → 获取答案文件用于本地调试

**诊断锚点**：v1.3.1 在 AV 向量中提供 `diag_hash` 字段（`audit.hash` 前 14 字符，即 `"sha256:" + 8 位十六进制）作为调试定位锚点。`diag_hash` 是 SHA-256 的单向输出前缀——不能反推 JCS 输出，不能用于绕过 JCS 实现，不能用于计算 SHA-256 的输入原像。它仅用于快速定位问题："我的结果以 `x` 开头，答案以 `y` 开头"。

| 字段 | 位置 | 可逆？ | 可用于作弊？ |
|------|------|:---:|:---:|
| `diag_hash` | AV 向量文件 | ❌ SHA-256 单向 | ❌ 仅 8 字符 hex，无 JCS 信息 |
| `canonical_hex` | 独立答案文件 | ✅ JCS 直接输出 | ✅ 可直接复制（已隔离） |
| `audit.hash` | DO body | ❌ SHA-256 单向 | ❌ 仅可比较，不可逆推 |

---

## 14. 募集反馈

本白皮书为征求意见稿（Request for Comments）。我们诚邀以下领域的专家对本文档提出反馈意见：

1. **全链路 JCS + 平面哈希**：`policies[].hash` 采用 JCS + SHA-256 计算，`audit.hash` 采用平面哈希公式。该方案是否在所有主流语言中均可正确复现？
2. **辖区激活机制**：`compliance_profile.activated_fields` + Schema 裁剪规则（Omit vs null）。该设计是否满足多辖区部署的合规需求？
3. **审计哈希回归检测**：向量集中包含保留旧版本哈希值的回归向量，用于检测跳过独立哈希重算的验证器实现。该设计是否合理？
4. **平面哈希扩展性**：extensions 的自描述设计 + 只增不删治理原则下，扩展区的内容完整性是否得到充分保证？
5. **IETF AAT 对齐**：ERDL DO 与 AAT 共享密码学原语。`execution_trace_id` 作为跨格式桥接键是否完备？
6. **链完整性金丝雀**：AV-013（链位置篡改金丝雀）是否充分测试了 `previous_hash` 纳入 JCS 原像的验证逻辑？
7. **诊断锚点与答案文件分离**：`diag_hash`（AV 向量中的 SHA-256 前缀）仅用于调试定位，`canonical_hex`（独立答案文件）物理隔离于向量文件——这种分层设计是否能有效阻止"绕过 JCS 实现"的合规作弊？
8. **双哈希过渡安全性**：§9.6 的"验证所有存在哈希"策略是否能防御算法降级攻击？
9. **威胁模型完整性**：附录 C 的威胁模型是否遗漏了在生产环境中实际存在的攻击向量？哪些风险接受声明在您的合规场景中无法接受？
10. **中小企业部署**：§9.5 的最小部署模式（NATIVE + JSONL）是否满足小团队的实际需求？渐进式升级路径（单进程 → Redis → Worker 集群）的瓶颈阈值（50/500 Tool Call/s）是否合理？

---

## 附录 C：威胁模型与安全声明

> 本附录基于 STRIDE 框架对 ERDL Decision Object 系统进行威胁建模。STRIDE 涵盖六类威胁：Spoofing（伪造）、Tampering（篡改）、Repudiation（否认）、Information Disclosure（信息泄露）、Denial of Service（拒绝服务）、Elevation of Privilege（权限提升）。

### C.1 威胁总览

| 威胁 | STRIDE 类别 | 现有防御 | 风险接受 |
|------|:---:|------|------|
| DO 内容篡改（修改 result/context 等字段后重放）| T | 平面哈希（§3.3）：所有字段参与 JCS → 任何篡改改变 audit.hash。五步验证法（§13.3）独立重算检测 | — |
| 链位置篡改（交换/重排/删除链中记录）| T | chain.previous_hash（§3.4）+ AV-013 金丝雀（§13.4）：链位置篡改改变后续所有 audit.hash | — |
| 签名伪造（伪造 Agent 签名声称授权操作）| S | ECDSA P-256 签名（§4.2 #23）：覆盖除 audit.hash/signature/signing_key_id 外的全部 DO | — |
| 审计员否认（Agent 声称"没做过这个决策"）| R | 签名 + 哈希链双重不可否认性（§3.4）：签名绑定 Agent 身份，哈希链防止选择性删除 | — |
| PII 泄露（DO 的 context 包含用户敏感数据）| I | 冷热分离（§8）：审计链只存 hash，原始 PII 落入可物理删除的冷存储 | — |
| schema_ref SSRF（验证器自动 fetch 外部 URL）| I | 离线优先 + 白名单 + 1MB 上限（§11.2）：禁止生产验证路径中的自动外部检索 | — |
| 哈希算法降级（验证器只校验 SHA-256，忽略更强的算法）| T | 双哈希过渡（§9.6）："验证所有存在哈希"替代"至少一个"（CWE-757 修复） | — |
| 超大 DO 耗尽验证器资源 | D | 资源边界（§3.1 约束 7）：1MB/100 ext/10 层嵌套，超限 MUST 拒绝 | — |
| 队列丢失导致 DO 缺失 | D/T | WAL 兜底 + 至少一次投递 + 缺失告警（§9.4 可靠性约束） | — |
| **签名私钥泄露** | S | — | ⚠️ 接受：私钥管理超出 DO 协议范围——白皮书要求但不规定 KMS 方案。企业 MUST 使用硬件安全模块（HSM）或云 KMS 管理私钥 |
| **时间回退攻击**（攻击者回拨系统时钟以伪造"早些时候"的 DO） | T | — | ⚠️ 接受：timestamp 是自声明的——攻击者控制 Agent 时钟即可篡改。缓解依赖外部可信时间戳（RFC 3161 TSA）或分布式共识时钟，这两者均超出 DO 协议范围 |
| **Sybil 攻击**（攻击者批量注册假 Agent，生成大量合法签名的假 DO 以淹没审计） | S | agent.aid（§4.4）提供身份锚定但依赖注册层信任 | ⚠️ 部分接受：DO 本身不解决身份注册的信任问题。需要 CA/PKI 或去中心化身份（DID）体系补充。DO 的 agent.id 字段为身份验证提供锚点——身份体系的选型是部署方决策 |

### C.2 风险接受声明

ERDL Decision Object 是一个**审计记录协议**，不是全方位的企业安全框架。以下威胁不在协议范围内，需要部署方在应用层、基础设施层或组织流程层补充防护：

1. **Agent 进程完整性**：如果攻击者获得了 Agent 进程的内存访问权限，可以直接在 DO 生成前篡改上下文——此时 DO 记录的是"被篡改后的决策"，协议本身无法防御
2. **LLM Prompt 注入**：通过构造恶意上下文诱使 Agent 做出不安全的决策——DO 会如实记录这个决策。防御 Prompt 注入是 ERDL 规则引擎的职责（Guard 规则），不是 DO 记录的职责
3. **物理安全**：攻击者获取了存储 DO 的硬件设备的物理访问权
4. **合规审计员自身攻击**：审计员持有合法的验证密钥但恶意行为（如选择性验证、故意误报）
5. **ReDoS（正则表达式拒绝服务）**：通过构造恶意正则输入耗尽验证器 CPU。ReDoS 防护属于 ERDL 规则引擎 Guard 的职责范围（SafeExpr 正则引擎），不是 DO 记录协议的范畴——DO 只记录"决策是否按规则做出"，不负责防御正则引擎层面的攻击

### C.3 安全默认原则

DO 协议遵循以下安全默认原则：

- **Fail-Safe**：验证失败时默认拒绝（将 DO 标记为 `invalid`），不默认接受
- **最小权限**：DO 生成只需要 Agent 进程的内存访问——不需要网络、不需要 root 权限
- **纵深防御**：密码学哈希（JCS+SHA-256）+ 链式锚定（previous_hash）+ 数字签名（ECDSA P-256）三重防护，单层失效不会导致整体失败
- **开放验证**：任何人（包括监管者）可以独立重算 audit.hash——不需要信任 Agent 提供商的封闭验证工具

> *"密码学提供保证，流程填补空白。DO 协议解决'记录防篡改'问题，身份体系解决'谁做的'问题，威胁情报解决'什么时候该做'问题。三者的边界必须清晰——不要把协议范围内的保证和责任范围外的问题混为一谈。"*

---

## 附录 B：参考标准

- RFC 8785 — JSON Canonicalization Scheme (JCS)
- RFC 9562 — UUID (v4/v7)
- FIPS 186-5 — Digital Signature Standard (ECDSA P-256)
- FIPS 180-4 — Secure Hash Standard (SHA-256)
- draft-sharif-agent-audit-trail-00 — Agent Audit Trail (IETF, 2026-03-29)
- EU AI Act — Regulation (EU) 2024/1689
- NIST AI 100-1 — AI Risk Management Framework 1.0 (2023-01-26)
- COSO — Achieving Effective Internal Control Over Generative AI (2026-02-23)
- ISO/IEC 42001:2023 — AI Management System
- GB/Z 185-2026 — 人工智能 智能体互联（7 部分，2026-05-22）
- OWASP Top 10 for Agentic Applications (2026)
- Colorado SB 24-205 — Consumer Protections for AI (2026-06-30)
- Singapore MGF for Agentic AI (2026-01-22)
- LGPD — Lei Geral de Proteção de Dados (Brazil, Law No. 13.709/2018, effective 2020-09-18)
- DPDP — Digital Personal Data Protection Act (India, Act No. 22 of 2023)
- 中国信通院 — 可信 AI 智能体评估体系 2.0 (2026-04-15)

---

> *"确定性架构，而非 Prompt 工程。中立性是被测出来的，不是宣称出来的。"*
>
> -- OpenOBA · 2026.07.29 · RFC 001 (OPENOBA-DOBJ-RFC-001) · Draft 4 · 征求意见稿
