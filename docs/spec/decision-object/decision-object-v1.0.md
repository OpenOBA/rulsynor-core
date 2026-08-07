<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# ERDL Decision Object v1.0

> **面向企业 Agent 治理的标准化、可审计、跨实现验证的开放规范**
>
> 版本：1.0.0 · 冻结日期：2026-08-02 · 首次发布：2026-08-02
> 维护方：OpenOBA (openoba.com)
> 许可证：MIT
>
> **⚠️ DRAFT FREEZE** — 本文档已冻结。1.0.0 版的审计向量集（AV-001 ~ AV-005）已经三方独立实现验证，
> 任何后续修订须通过规范修订提案（Spec Change Proposal，SCP）流程，并附带更新的审计向量集。

---

## 0. 动机：为什么企业需要决策对象标准

### 0.1 监管压力

2026 年，AI Agent 已进入企业的财务、医疗、招聘、保险、关键基础设施等**高监管领域**。全球监管机构正在关闭"黑箱决策"的窗口：

| 监管框架 | 关键要求 | 企业责任 |
|---------|---------|---------|
| **EU AI Act** (2026-08-02 生效) | Article 12: 每条高风险决策须自动记录（决策 + 结果 + 风险情景 + 监控数据）。Article 14: 人类监督须为**外部约束**，系统提示不可视为合规。 | €35M / 7% 全球营收 |
| **中国 GB/Z 185-2026** | 28 位智能体身份码 (AID)、工具调用安全五机制、数据流转权限审计、决策追溯 | 生成式 AI 服务合规框架 + 算法备案义务 |
| **US COSO 2026** | 生成式 AI 内部控制须捕获完整审计轨迹：prompt、输入、输出、模型版本、配置版本、人类审查证据 | PCAOB AS 2201 合规 + SOX 内控要求 |
| **NIST AI RMF 1.0** | Map / Measure / Manage / Govern 四功能治理框架 | 自愿，但影响美国联邦采购资格 |
| **OWASP Top 10 for Agentic 2026** | 10 项 Agentic 风险：Prompt Injection、Tool Manipulation、Supply Chain、Autonomy Abuse 等，每项需技术控制 | 行业最佳实践（影响保险/审计） |
| **IEEE P3395** (制定中) | Agentic AI 实践的推荐标准 | 未来合规预期 |
| **ISO/IEC 42001:2023** | AI 管理系统（AIMS）— Plan-Do-Check-Act 循环、内部审计、管理评审 | 认证要求（影响政府采购） |
| **信通院八大维度** (2026-04-15) | 企业级 AI Agent 全链·评估：核心组件 / 关键能力 / 平台支撑 / 运营管理 | 中国政企招标资质要求 |
| **Colorado SB 205** (2026-06-30 生效) | AI 决策须可解释，消费者有权申诉 | $20,000 / 违规 |
| **新加坡 Agentic AI 治理框架** (2026-01-22) | 全球首个专属 Agent AI 治理框架：界定风险、人负全责、技术控制、用户责任 | 自愿，但企业承担最终法律责任 |

### 0.2 企业痛点

企业合规团队面临一个共同的技术障碍：**不同厂商的 Agent 用不同的格式输出决策。** 审计员拿到的是 Prompt 日志 + 对话截图，不是结构化、可验证的决策记录。

以金融服务为例——COSO 2026 已明确要求 AI 审计轨迹必须展示 "控制功能按设计运作"（control functioned as designed）。一条对话截图无法满足这个要求。

ERDL Decision Object 解决这个问题：为 Agent 决策提供一个**机器可读、跨实现验证、防篡改**的标准输出格式。

### 0.3 跨实现中立性

一个开放标准的中立性**不是宣称出来的，是靠独立实现验证出来的。** 本规范的设计原则：

> **给定相同的规则集和上下文，任何兼容的 ERDL 实现必须产生逐字节一致的 Decision Object。**

三个独立实现、同一份规范、同一个向量集、没有单一控制者——这是去中心化基础设施的经典·径（参见 RFC 2026、IETF 标准流程）。

---

## 1. 范围与受众

### 1.1 本标准面向

| 受众 | 角色 | 关注点 |
|------|------|--------|
| **企业合规团队** | 审计 Agent 决策、满足监管要求 | "这条决策能不能提交给监管机构作为证据？" |
| **Agent 平台开发者** | 实现 ERDL 兼容的规则引擎 | "我的引擎输出能不能通过跨实现验证？" |
| **监管科技 (RegTech) 厂商** | 构建 AI 审计产品 | "我能用这个格式自动解析任何 ERDL Agent 的决策吗？" |
| **标准化组织** | 评估协议中立性 | "存在独立实现吗？向量集是否能复现？" |

### 1.2 本标准不面向

- ❌ 个人开发者日常使用（见 MCP Server Free 层）
- ❌ Agent 行为的最佳实践建议
- ❌ LLM 模型的评估或基准测试

---

## 2. 规范

### 2.1 Decision Object 格式

每条 Agent 决策输出以下 JSON 结构：

```json
{
  "spec": "decision-object-v1.0",
  "decision_id": "018c4a3e-...",
  "timestamp": "2026-08-02T08:30:00.000Z",
  "agent": {
    "id": "agent-001",
    "role": "operator",
    "version": "v1.5.0"
  },
  "context": {
    "tool.name": "exec",
    "tool.args": { "command": "ls" }
  },
  "policies": [
    {
      "id": "SEC-001",
      "name": "block_exec_tool",
      "version": 1,
      "hash": "sha256:abc123..."
    }
  ],
  "evaluation": {
    "proposal_id": null,
    "matched_rules": [],
    "total_evaluated": 0,
    "total_matched": 0
  },
  "result": {
    "decision": "PASS",
    "severity": "none",
    "reason": "no rules matched",
    "action_taken": "allowed"
  },
  "audit": {
    "hash": "sha256:...",
    "previous_hash": null,
    "commitment": "2026-08-02T08:30:00.000Z|agent-001|exec|PASS"
  }
}
```

### 2.2 字段定义

#### 顶层字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `spec` | string | ✅ | 固定值 `"decision-object-v1.0"` |
| `decision_id` | string | ✅ | UUID v7（时间有序，recommended），全局唯一。实现可降级使用 UUID v4 作为兼容方案。 |
| `timestamp` | string | ✅ | ISO 8601 UTC，NTP 同步 |
| `agent` | object | ✅ | 决策 Agent 的身份信息 |
| `context` | object | ✅ | 触发决策的上下文 |
| `policies` | array | ✅ | 本次评估中激活的策略集 |
| `evaluation` | object | ✅ | 规则评估的详细结果 |
| `result` | object | ✅ | 最终决策 |
| `audit` | object | ✅ | 防篡改审计证据 |

#### agent 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `agent.id` | string | ✅ | Agent 唯一标识（建议 GB/Z 185 AID 或 DID:ERDL 格式） |
| `agent.role` | string | ✅ | `guardian` / `operator` / `observed` |
| `agent.version` | string | ✅ | Agent 软件版本号 |

#### policies 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `policies[].id` | string | ✅ | 策略唯一标识 |
| `policies[].name` | string | ✅ | 人类可读名称 |
| `policies[].version` | number | ✅ | 策略版本号（用于审计追溯） |
| `policies[].hash` | string | ✅ | 策略完整内容的 SHA-256 哈希 |

#### evaluation 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `evaluation.proposal_id` | string | — | 规则提案 ID（如通过审批流变更），无提案时为 null |
| `evaluation.matched_rules` | array | ✅ | 命中的规则列表 |
| `evaluation.matched_rules[].rule_id` | string | ✅ | 规则 ID |
| `evaluation.matched_rules[].decision` | string | ✅ | 该规则的决策 |
| `evaluation.matched_rules[].reason` | string | — | 原因/说明 |
| `evaluation.matched_rules[].instruction` | string | — | 建议（ALLOW 时） |
| `evaluation.matched_rules[].correction` | string | — | 纠正内容（CORRECT 时） |
| `evaluation.matched_rules[].ring` | number | — | 执行环级别 |
| `evaluation.total_evaluated` | number | ✅ | 评估的规则总数（排除 disabled） |
| `evaluation.total_matched` | number | ✅ | 命中的规则总数 |

#### result 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `result.decision` | string | ✅ | 决策类型（见 §2.3） |
| `result.severity` | string | ✅ | `none` / `low` / `medium` / `high` / `critical` |
| `result.reason` | string | ✅ | 人类可读的决策解释（PASS 时为描述性说明） |
| `result.action_taken` | string | ✅ | 实际执行的动作：`allowed` / `blocked` / `corrected` / `paused` / `halted` / `rolled_back` / `quarantined` / `escalated` |

#### audit 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `audit.hash` | string | ✅ | 本条记录全文的 SHA-256 哈希。计算时须先将 record 按 JCS (RFC 8785) 规范化序列化，移除 `hash` 字段后求 SHA-256。 |
| `audit.previous_hash` | string | — | 上一条审计记录的哈希（形成链），首条记录为 null |
| `audit.commitment` | string | ✅ | 防篡改承诺字符串：`timestamp|agent_id|tool_name|decision` |

---

### 2.3 决策类型与严重性

| 决策 | 严重性 | 含义 | Agent 行为 | 层级 |
|------|:---:|------|-----------|:---:|
| `PASS` | none | 无规则匹配 | 正常执行 | Free |
| `ALLOW` | none | 放行，附建议 | 正常执行，遵循建议 | Free |
| `CORRECT` | medium | 自动纠正 | 参数修正后继续执行 | Free |
| `REQUEST_HUMAN` | medium | 暂停等待审批 | 操作挂起，等待人类确认 | Free |
| `ESCALATE` | medium | 升级到更高级审查者 | 操作挂起，升级到指定审查者 | Pro |
| `NOTIFY` | low | 发出合规通知 | 继续执行但记录通知 | Pro |
| `DENY` | high | 硬拦截 | 操作被阻止，须修改 | Free / Pro |
| `ROLLBACK` | high | 回滚已执行的操作 | 撤销操作，恢复先前状态 | Pro |
| `QUARANTINE` | critical | 隔离 Agent | 禁止所有后续操作，直到审计完成 | Pro |
| `EMERGENCY_HALT` | critical | 全局紧急终止 | 立即停止所有被监管的 Agent | Enterprise |

> **注**：`ROLLBACK`、`QUARANTINE` 和 `ESCALATE` 的 Ring 1/2 级实现为 Pro 功能。Free 层（Ring 3）支持 `ALLOW`、`CORRECT`、`NOTIFY`、`DENY`。`EMERGENCY_HALT` 仅在企业版 Ring 0 中可用。`BLOCK` 在本规范中等价于 `DENY`——两者语义相同，`DENY` 为本规范的统一术语。

> **与 ERDL 语言层的关系**：ERDL 语言规范定义了更广泛的动作集合（含 `DELEGATE`、`STRATEGIZE`、`AUDIT`、`CALCULATE`、`VALIDATE` 等），这些是 Agent 内部推理动作，不进入跨系统的 Decision Object。Decision Object 仅包含具有**外部可见性**的决策类型——即对企业合规、审计、监管有实际影响的决策。这 10 种类型构成 ERDL 动作集的**外部合规子集**。

### 2.4 审计链

Decision Object 支持**防篡改审计链**，每条记录通过 `audit.previous_hash` 链接到上一条记录：

```
[Record N-1]  →  [Record N]  →  [Record N+1]
  hash: abc       hash: def       hash: ghi
                  prev: abc       prev: def
```

任何记录的篡改都会破坏整条链的哈希一致性。审计员只需验证最新的 `audit.hash` 即可确认整条链的完整性。

### 2.5 数据保留

| 法规 | 最短保留期 | 涉及范围 |
|------|:---:|------|
| EU AI Act Article 12 | 6 个月（高风险系统） | 所有决策记录 |
| COSO / SOX | 7 年（审计工作底稿）；366 天（操作日志） | 财务领域 AI 决策 |
| HIPAA | 6 年 | 医疗领域 PHI 相关决策 |
| PCI DSS v4.0 | 12 个月（3 个月在线） | 支付卡数据相关决策 |
| GB/Z 185-2026 | 依据《数据安全法》33 条：不少于 6 个月 | 重要数据处理者的 AI 决策 |
| CC-CSIRT 通用建议 | 12-24 个月 | 安全事件可追溯 |

兼容实现应在文档中声明支持的数据保留策略。零售期取决于部署组织的行业法规——标准本身**不设定最短保留期**，但要求 `audit.hash` 和 `audit.previous_hash` 在整个保留期内保持可验证。

---

## 3. 合规对齐

### 3.1 EU AI Act 覆盖

| Article | 要求 | Decision Object 对应字段 |
|---------|------|--------------------------|
| Art. 12 (记录保存) | 自动记录决策、结果、风险情景 | `decision_id` + `timestamp` + `result` + `context` |
| Art. 13 (透明度) | 决策须可解释 | `result.reason` + `matched_rules` |
| Art. 14 (人类监督) | 外部约束，非系统提示 | `agent.role = "guardian"` + `REQUEST_HUMAN` / `ESCALATE` |
| Art. 9 (风险管理) | 风险管理系统 | `policies[]`（版本化） + `result.severity` |
| Art. 19 (日志访问) | 至少 6 个月可访问 | `audit.hash` + `audit.previous_hash`（审计链） |

### 3.2 中国 GB/Z 185-2026 覆盖

| 要求 | Decision Object 对应 |
|------|---------------------|
| 28 位 AID（智能体身份码） | `agent.id`（建议格式） |
| 工具安全五机制 | `result.decision` + `matched_rules[]`（拦截/纠正/请求人类） |
| 数据流转权限审计 | `matched_rules` 将每条决策追溯到具体规则 |
| 决策追溯 | `audit.previous_hash`（审计链） + `audit.commitment` |

### 3.3 NIST AI RMF 1.0 覆盖

| NIST 功能 | 要求 | Decision Object 对应 |
|-----------|------|----------------------|
| **Govern** | 建立治理结构、政策、问责 | `agent.role` + `policies[].version` + `policies[].hash`（政策版本化） |
| **Map** | 绘制 AI 风险和上下文 | `context`（触发决策的完整上下文） |
| **Measure** | 测量 AI 系统的可信度 | `matched_rules[]`（每条规则为何触发/不触发） |
| **Manage** | 管理已识别的风险 | `result.decision` + `result.action_taken`（实际采取的管理行动） |

### 3.4 COSO 2026 内部控制覆盖

| COSO 要求 | Decision Object 对应 |
|-----------|---------------------|
| 完整审计轨迹 | `decision_id` + `context` + `policies[]` + `result` |
| 模型和配置版本 | `agent.version` + `policies[].version` + `policies[].hash` |
| 人类审查证据 | `REQUEST_HUMAN` / `ESCALATE` / `agent.role` |
| 控制功能可按设计运作 | `matched_rules` 显示哪条规则触发、什么决策、为什么 |

### 3.5 ISO/IEC 42001:2023 AI 管理系统

| 42001 要求 | Decision Object 对应 |
|-----------|----------------------|
| A.7.5 文件化信息 | `policies[]`（版本化 + 哈希） + `evaluation` 结构 |
| A.9.1 监测、测量、分析与评估 | `matched_rules[]`（每条决策可追溯到策略、上下文和结果） |
| A.9.2 内部审计 | `audit.hash` + `audit.previous_hash`（防篡改审计链） |
| A.9.3 管理评审 | `result.severity` + `result.action_taken`（风险处置证据） |

### 3.6 IEEE P3395 — Agentic AI 实践

| P3395 方向（制定中） | Decision Object 前置对齐 |
|---------------------|--------------------------|
| Agent 行为的可追溯性 | `decision_id` (UUID v7) + `audit.previous_hash`（防篡改审计链） |
| 决策的责任归属 | `agent.role` + `agent.id`（Guardian/Observer 模型） |
| 多 Agent 协作的边界定义 | `context`（完整上下文快照）+ `result.action_taken` |

### 3.7 信通院「可信 AI 智能体评估体系 2.0」八大维度（ERDL 主要覆盖维度）

| 维度 | Decision Object 对应 |
|------|----------------------|
| 核心组件（感知·推理·执行） | `evaluation`（推理链·：规则匹配 → 决策） |
| 关键能力（安全·鲁棒·公平） | `matched_rules[]`（每条决策有因可查） |
| 平台支撑（部署·运维·监控） | `audit.hash` + `audit.previous_hash`（运维可追踪） |
| 运营管理（合规·审计·治理） | 完整 Decision Object 输出 → 满足审计要求 |

### 3.8 OWASP Top 10 for Agentic Applications (2026)

| 风险 | ERDL 规则示例 | Decision Object 证据 |
|------|-------------|---------------------|
| LLM01: Prompt Injection | `when: tool.name = "exec" AND tool.args.command match "(curl|wget)" then: DENY` | `matched_rules[].rule_id` + `deny` |
| LLM02: Tool Manipulation | `when: tool.name in ("exec","bash") then: REQUEST_HUMAN` | `result.decision = "REQUEST_HUMAN"` |
| LLM03: Supply Chain | `when: tool.args.package source != "approved_registry" then: DENY` | `matched_rules[].decision = "DENY"` |
| LLM04: Autonomy Abuse | `when: agent.reputation < 300 then: ESCALATE` | `result.decision = "ESCALATE"` |
| LLM05: Data Leakage | `when: data.classification = "PII" then: DENY` | `matched_rules[].reason` + `context.data.classification` |
| LLM06: Excessive Agency | `when: consecutive_actions > 5 then: REQUEST_HUMAN` | `result.decision = "REQUEST_HUMAN"` + `action_taken = "paused"` |
| LLM07: Goal Misalignment | `when: task.category != agent.purpose then: CORRECT` | `matched_rules[].correction` |
| LLM08: Hallucination Risk | Guardian 规则集 + `agent.role = "guardian"` | `agent.role = "guardian"` + `matched_rules[].ring = 0` |
| LLM09: Multi-Agent Collusion | Ring 1 跨 Agent 规则 + `ring = 1` | `result.severity = "high"` + `ESCALATE` |
| LLM10: Unbounded Consumption | `when: cost_estimate > budget then: DENY` | `context.cost_estimate` + `result` |

---

## 4. 执行环（Execution Rings）

规则按照企业治理层级分为四个执行环：

| Ring | 名称 | 决策范围 | 拥有者 | 典型角色 |
|:---:|------|---------|---------|---------|
| **0** | 安全环 | EMERGENCY_HALT, DENY | 安全/合规团队 | CISO, DPO |
| **1** | 合规环 | ROLLBACK, QUARANTINE（Pro） | 合规/法务团队 | 合规官 |
| **2** | 运营环 | REQUEST_HUMAN, ESCALATE（Pro） | 运营/业务团队 | 部门主管 |
| **3** | 执行环 | ALLOW, CORRECT, NOTIFY（Free） | 开发/个人 | 个人开发者 |

Ring 0 先评估，Ring 3 最后。Ring 0 HALT 可立即短·所有后续评估。高严重性决策不能被低严重性决策覆盖。

---

## 5. 跨实现验证

### 5.1 原则

本标准的中立性通过独立验证证明：

1. 任何实现者可以参照本规范编写 ERDL 兼容的决策引擎
2. 所有实现必须能重现[向量集](#52-向量集)中的全部测试向量
3. 验证结果提交到不受单一实体控制的中立仓库（如 A2A #2031）

### 5.2 向量集

向量集文件：`decision-object-vectors-v1.0.json`（随本规范发布）

包含两类跨实现测试向量：

#### A. 决策引擎向量（23 条）

验证 ERDL 规则引擎的决策逻辑。每条向量包含：规则定义 + 上下文 + 预期输出。

覆盖：
- 安全基线（financial service tool allowlist）
- 合规工作流（PHI access → human review）
- 危险命令拦截（destructive DBA commands）
- 关键基础设施保护（系统配置·径边界）
- 策略版本化（disabled rules during review）
- 空策略集（zero-rule deployment gap）
- override 语义（安全方向 vs 不安全方向）
- 执行环短·（Ring 0 priority + HALT short-circuit）
- 严重性升级（DENY 胜出 over ALLOW / REQUEST_HUMAN）
- 全部 11 种运算符（gt、ne、exists、in、contains、match 等）
- 多 Agent 信任模型（低信誉 Agent 升级）

#### B. 审计哈希向量（5 条）

验证 JCS (RFC 8785) 规范化 + SHA-256 哈希一致性。每条向量包含：
- 完整的 Decision Object JSON（含 `decision_id`、`timestamp`、`agent`、`audit` 等全部字段）
- `canonical_bytes`：JCS 规范化后的字节序列（hex 编码）
- `expected_sha256`：预期的 SHA-256 哈希值

实现者验证方法：
1. 取向量中的 `decision_object`
2. 移除 `audit.hash` 字段
3. 按 JCS (RFC 8785) 规范化序列化
4. 计算 SHA-256
5. 与 `expected_sha256` 比对
6. 将计算出的 hash 填回 `audit.hash`，与 `decision_object.audit.hash` 比对

这 5 条向量覆盖了主要的决策类型和 Ring 级别：

| Audit Vector | 来源 | 决策类型 | Ring | 特性 |
|:---|:---|:---|:---:|------|
| AV-001 | DO-001 | DENY | 0 | 单安全规则 + high severity |
| AV-002 | DO-003 | REQUEST_HUMAN | 1 | PHI 上下文 + medium severity |
| AV-003 | DO-010 | ALLOW | 0+3 | 双规则 override（instruction 字段）|
| AV-004 | DO-013 | EMERGENCY_HALT | 0 | HALT 短· + critical severity |
| AV-005 | DO-022 | ESCALATE | 1 | 多 Agent 信任 + escalated action |

任何兼容实现必须逐字节一致地复现全部 23 条决策引擎向量和 5 条审计哈希向量。

### 5.3 验证流程

```
1. 实现者编写 ERDL 决策引擎（任何语言）
2. 加载向量集 → 运行每条向量 → 比较输出
3. 全部 28 条向量（23 条决策引擎 + 5 条审计哈希）expected 与 actual 逐字节一致 → 声明兼容
4. 验证结果 PR 到中立仓库（如 A2A #2031）
```

---

## 6. 鸣谢

ERDL Decision Object 规范的制定得益于以下个人和组织的贡献：

- **Erik Newton** (Concordia) — 跨实现中立性验证方法论的创始贡献。其"中立性是测出来的而非宣称的"洞察和"三个独立实现、一个开放规范、没有单一所有者"的标准化·径为本规范奠定了方法论基础。Concordia 将在草案定稿后作为 ERDL Decision Object 的第二个独立 runner，在 A2A #2031 进行逐字节验证。
- **Christopher Hopley** (chopmob-cloud / AlgoVoi) — 合规 substrate 模型与跨验证愿景；声誉与合规证据的本质区分；content-address receipt 模型（RFC 8785 JCS 规范化 → SHA-256 帧）；合规向量集（compliance_receipt_v1、compliance_gate_lite_v1、retention_chain_v1），构成本规范证据链的底层基础与交叉验证参照
- **Tang Haoran** (唐浩然, OpenOBA AI 执行官) — ERDL 规范总架构、向量集设计
- **Tang Qixin** (唐启鑫, DPO) — 合规对齐审校（EU AI Act、GB/Z 185、NIST AI RMF、COSO）
- **Henry** — OpenOBA 联合创始人 · 战略方向

> *"Neutrality is a property you test, not declare." — Erik Newton*
>
> *"An Apache-2.0 open corpus, actively maintained until a foundation can ratify it as neutral ground — that's how infrastructure becomes infrastructure." — Henry (OpenOBA), 引述自 2026-08-02 讨论中 AlgoVoi 开放治理姿态的确认发言*

---

## 7. 版本历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| 1.0.0-draft.2 | 2026-08-02 | 唐浩然 (Tang Haoran) | **(1) 执行环分配对齐 ERDL spec §3.5**：Ring 2 调整为 `REQUEST_HUMAN, ESCALATE`，Ring 3 调整为 `ALLOW, CORRECT, NOTIFY`。原 Ring 2 中的 `NOTIFY` 下移至 Ring 3，原 Ring 3 中的 `REQUEST_HUMAN` 上移至 Ring 2。`ESCALATE` 仅属 Ring 2（移除 Ring 1 重复声明）。**(2) 新增 ERDL 动作集关系说明**：Decision Object 的 10 种决策类型为 ERDL 语言层动作集的**外部合规子集**，`DELEGATE`、`STRATEGIZE`、`AUDIT`、`CALCULATE`、`VALIDATE` 为 Agent 内部动作，不进入跨系统 Decision Object。**(3) agent.role 值修正**：`observer` → `observed`，对齐 ERDL spec §3.7。**(4) auditor hash 向量**：新增 5 条审计哈希向量（AV-001 ~ AV-005），JCS (RFC 8785) + SHA-256，28 条向量（23+5）。
| 1.0.0-draft | 2026-08-02 | 唐浩然 (Tang Haoran) | 初始草案：企业合规视角、10 种决策类型、23 条跨实现向量、审计链 (JCS + SHA-256)、8 框架逐字段合规对齐（EU AI Act、GB/Z 185、NIST AI RMF、COSO、ISO/IEC 42001、IEEE P3395、信通院、OWASP Top 10）+ 2 框架监管压力引用（Colorado SB 205、新加坡 Agentic AI 治理框架）。跨实现中立性方法论（Erik Newton 贡献）。 |

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
