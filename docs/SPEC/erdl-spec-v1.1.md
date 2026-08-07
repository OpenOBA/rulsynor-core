<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# ERDL Protocol Specification v1.1

> **Entity-Rule Definition Language — Agent 行为规则层开放标准**
>
> 版本：1.1 (Final) · 2026-08-02 · 冻结
> 最后修订：2026-08-02（冻结期审计 #3/#4 修订 §12.7 + §14 · 补充 AV-008 · 移除 expected_sha256 引用）
> 维护者：OpenOBA
> 许可证：MIT
> 状态：Final
>
> **声明式规则描述语言，兼容 MCP 和 A2A 生态。**
>
> **人、LLM、系统、审计共享的语义约定层。**
>
> **本版本基于两份独立第三方审查意见修订定稿（审查方：技术自洽性审计 v1.1 draft · 工程可行性审计 v1.1 draft），并在冻结期内经 Erik Newton (Concordia) 和 Christopher Hopley (chopmob-cloud) 的独立审计进一步完善了 §12.7（跨实现验证）和审计哈希向量集（新增 AV-008 陈旧回归向量，移除 `expected_sha256` 答案密钥）。**

---

## 版本说明

本文档基于以下来源整合并经过两轮独立第三方审查后定稿：

| 来源 | 版本 | 日期 | 角色 |
|------|------|------|------|
| `index.md` | v1.0 (Community Preview) | 2026-08-02 | 主规范骨架（§1–§13） |
| `erdl-spec-v1.1-draft.md` | v1.1 (Draft) | 2026-08-02 | v1.1 增量章节（§3.2.1–§3.2.4, §3.4.1, §11.5） |
| `decision-object-v1.0.md` | v1.0 (Frozen) | 2026-08-02 · 冻结 | 审计子集完整集成（§12 Decision Object） |
| 外部审计 #1 | 技术自洽性深度审计 | 2026-08-02 | 跨章节一致性、边缘冲突、语义缺口检测 |
| 外部审计 #2 | 工程可行性审计 | 2026-08-02 | 业务场景验证、工程落地评估、工具链建议 |
| 冻结期审计 #3 | Erik Newton (Concordia) — 独立跨实现验证 | 2026-08-02 | `expected_sha256` 答案密钥风险评估、`canonical_bytes` 诊断价值论证、AV-008 陈旧回归向量方案 |
| 冻结期审计 #4 | Christopher Hopley (chopmob-cloud) — 独立审计报告 | 2026-08-02 | 五步简写结构性缺陷证明、c3f22df/5cff368 复现、delete-vs-blank JCS 语义验证、纯 hex+SHA-256 验证方法 |

### v1.1 新增章节

| 章节 | 内容 | 新增原因 | 兼容性 |
|------|------|---------|:---:|
| **§3.2.1** | when 最小完整度要求 | 防止 `when: "true"` + `then: DENY` 导致系统不可用 | 非破坏性 |
| **§3.2.2** | unless 豁免机制 | 规则需要例外；unless 评估优先于 when | 非破坏性 |
| **§3.2.3** | message 强制要求 | 空 message 导致运维排查成本指数级上升 | 非破坏性 |
| **§3.2.4** | 规则命名规范 | 非结构化命名导致规则库不可维护 | 非破坏性 |
| **§3.4.1** | metadata.decision 与 rules[].then 的优先级 | 消除两处存 decision 的语义冲突 | 非破坏性 |
| **§11.5** | 规则质量门禁 | 加载时自动检测危险/低质量规则 | 非破坏性 |
| **§12** | Decision Object（审计子集） | 全量集成 decision-object-v1.0 (2026-08-02 冻结) | 非破坏性 |

### v1.1 继承与微调章节（基于 v1.0，2026-08-02）

> **说明**：以下章节核心内容继承自 v1.0，在 v1.1 中进行了局部微调（如新增子节、修订引用概念、补充审计行为定义等），但未进行结构性重写。具体变更详见括号内标注。

§1 引言 · §2 架构 · §3.1 Entity · §3.3 When · §3.4 Then（除 §3.4.1 新增）· §3.5 执行环 · §3.6 Guard（CORRECT 例外修订）· §3.7 Guardian/Observed Agent 模型 · §3.8 Audit（新增 unless 审计行为子节）· §4 Agent 身份与信任 · §5 规则文件格式 · §6 安全模型（§6.1 新增空值传播+资源配额子节）· §7 合规对齐（§7.5.2 修订引用概念）· §8 协议互操作 · §9 版本兼容性 · §10 参考实现 · §11.1–§11.4 规则治理 · §13 贡献 · §14 社区致谢 · 附录 A–E

### 审计声明

本规范 v1.1 定稿已经过以下审查：
- **技术自洽性审计**：跨章节语义一致性、边缘冲突消解、规范完整性
- **工程可行性审计**：业务场景验证、工程落地评估、工具链路线图
- **审查日期**：2026-08-02
- **结论**：v1.1 已达到工程预览阶段标准，适合作为参考实现开发的规范基线

---

## 1. 引言

### 1.1 背景：Agent 生态的标准化

AI Agent 生态正在快速标准化。两个协议定义了 Agent 互操作的基础：

- **MCP**（Model Context Protocol，Anthropic → Linux Foundation）：Agent 与外部工具的连接标准——"Agent 的 USB"
- **A2A**（Agent-to-Agent Protocol，Google → Linux Foundation）：Agent 之间的通信标准——"Agent 的 HTTP"

Cisco Research 在 2025 年提出分层 Agent 协议架构（arXiv:2511.19699），定义了 L8（Agent Communication Layer）和 L9（Agent Semantic Negotiation Layer）。L8 正在被 MCP 和 A2A 实现。L9 "does not exist today"（原文）。

**ERDL 填补了 L9 的空白——Agent 语义规则层。**

### 1.2 ERDL 是什么

ERDL（Entity-Rule Definition Language，实体-规则定义语言）是一个开放的、声明式的 Agent 行为规则标准。它定义了 AI Agent 在执行操作时应遵循的约束、策略和纠偏逻辑。

**ERDL 不是 Prompt 工程。** 它是确定性引擎。规则由 SafeExpr 表达式引擎执行——递归下降解析，零代码注入。Agent 无法绕过。

**ERDL 不是 Agent 框架。** 它不取代 LangGraph、CrewAI、OpenClaw。它集成到这些框架中，作为它们缺失的规则层。

**ERDL 通过标准路径融入现有 Agent 生态：**

- **ERDL → MCP Tool**：规则自动生成为 MCP Tool，Agent 通过标准 MCP 协议调用
- **ERDL → A2A Agent Card 扩展**：Agent Card 中声明 `erdl` 扩展，携带规则文件和 Guardian Agent 信息

三层协同工作：

```
┌──────────────────────────────────┐
│  A2A  — Agent ↔ Agent 通信标准   │  Google · LF · 150+ orgs
├──────────────────────────────────┤
│  ERDL — Agent 行为规则描述语言   │  OpenOBA · MIT
│         (MCP Server + A2A Card)  │
├──────────────────────────────────┤
│  MCP  — Agent ↔ Tool 连接标准    │  Anthropic · LF · 97M 下载/月
└──────────────────────────────────┘
```

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **声明式** | 规则用 when/then YAML 表达，不需要写代码 |
| **确定性** | 规则由引擎执行，不依赖 LLM 自觉遵守 |
| **协议层拦截** | Action Guard 在 Tool Call 执行前拦截，不是 Prompt 建议 |
| **可审计** | 每条规则的触发、拦截、纠偏都有结构化记录 |
| **可热更新** | 规则变更无需重启 Agent 运行时 |
| **框架无关** | 不绑定任何 Agent 框架或 LLM 提供商 |
| **MCP/A2A 互补** | 通过 MCP Server 和 A2A Card 扩展两种标准路径融入生态 |
| **翻译 + 向导 + 纠偏** | 不只是一刀切拦截。纠正路径、建议策略、指导 Agent 回到正轨 |
| **多方语义层** | 人、LLM、Agent、系统、审计共享同一套语义约定 |
| **默认安全** | 无规则匹配时默认 ALLOW。但 Guard 规则默认加载 |

### 1.4 与 IEEE/ISO/NIST/GB 的关系

ERDL 旨在与以下框架对齐：

- **IEEE P3395** — Recommended Practice for Agentic AI Practices (制定中)
- **ISO/IEC 42001** — AI 管理系统
- **NIST AI RMF 1.0** — AI 风险管理框架
- **OWASP Top 10 for Agentic Applications (2026)** — 每项风险对应 ERDL 规则
- **EU AI Act (2026-08-02 全面生效)** — 高风险 AI 系统的透明度和人工监督要求
- **GB/Z 185-2026 《人工智能 智能体互联》系列国家标准** — 中国首套智能体互联标准体系（7 部分），2026-05-22 发布，2028 年前升级为强制国标（GB）
- **中国信通院「可信 AI 智能体评估体系 2.0」**（2026-04-15 发布）— 面向企业级智能体的八大维度全链路评估框架

### 1.5 本文档约定

本文档使用 BCP 14 (RFC 2119 & RFC 8174) 关键词：MUST（必须）、MUST NOT（禁止）、SHOULD（应该）、SHOULD NOT（不应该）、MAY（可选）。

ERDL 规则使用 YAML 1.2 语法。规则文件命名为 `*.erdl.yaml` 或 `*.erdl.yml`。

---

## 2. 架构

### 2.1 Agent 运行时架构

```
┌──────────────────────────────────────────────────────┐
│                  Agent Runtime                       │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌───────────────┐   │
│  │   LLM    │   │  Memory  │   │  ERDL Engine   │   │
│  │ (推理)   │   │ (状态)   │   │  (规则执行)    │   │
│  └────┬─────┘   └────┬─────┘   └───────┬───────┘   │
│       │              │                  │           │
│       └──────────────┼──────────────────┘           │
│                      ▼                              │
│            ┌──────────────────┐                     │
│            │   Tool Router    │                     │
│            │  (工具调度)       │                     │
│            └────────┬─────────┘                     │
│                     │                               │
│          ┌──────────┴──────────┐                    │
│          ▼                     ▼                    │
│   ┌────────────┐       ┌────────────┐              │
│   │ MCP Client │       │ A2A Client │              │
│   │ (工具连接) │       │ (Agent通信)│              │
│   └────────────┘       └────────────┘              │
└──────────────────────────────────────────────────────┘
```

### 2.2 ERDL 引擎组件

```
┌───────────────────────────────────────┐
│           ERDL Engine                 │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │   Parser    │  │  Rule Engine   │ │
│  │  YAML+Zod   │─▶│  when/then     │ │
│  └─────────────┘  │  evaluation    │ │
│                   └───────┬────────┘ │
│  ┌─────────────┐          │          │
│  │  SafeExpr   │          │          │
│  │  表达式引擎  │◀─────────┘          │
│  └─────────────┘                     │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Action Guard│  │  Audit Logger  │ │
│  │ Tool Call   │  │  结构化记录     │ │
│  │ 拦截层      │  │                │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Hot Reload  │  │ Snapshot Mgr   │ │
│  │ 实时规则更新 │  │ 版本+回滚      │ │
│  └─────────────┘  └────────────────┘ │
│                                      │
│  ┌─────────────┐  ┌────────────────┐ │
│  │ Proposal    │  │  Agent State   │ │
│  │ Engine      │  │  Manager       │ │
│  │ 规则治理     │  │ 运行时状态追踪  │ │
│  └─────────────┘  └────────────────┘ │
└───────────────────────────────────────┘
```

### 2.3 执行流程

```
Agent Tool Call
     │
     ▼
Action Guard ─── Guard 规则评估
     │
  ┌──┴─────────────────────┐
  ▼                        ▼
ALLOW/CORRECT           DENY/HALT/ESCALATE/
  │                      REQUEST_HUMAN/QUARANTINE
  ▼                        │
修正后的 Tool Call       返回拦截/纠偏原因到 Agent
  │
  ▼
Rule Engine ─── 策略规则评估
  │
  ▼
Audit Logger ─── 结构化记录
  │
  ▼
返回结果到 Agent
```

### 2.4 集成模型

ERDL 支持三种集成深度：

| 模式 | 深度 | 确定性 | 适用人群 | 平台覆盖 |
|------|:---:|:---:|------|:---:|
| **SKILL.md** | 浅 — Prompt 注入 | 🟡 依赖 LLM | 任何人 | 任何 Agent |
| **MCP Tool** | 中 — Agent 调用 | 🟡 代理模式可强制 | 开发者 | 300+ MCP 平台 |
| **SDK / Middleware** | 深 — 代码级拦截 | ✅ 协议层 | 框架开发者 | 特定框架 |

---

## 3. 核心概念

### 3.1 Entity（实体）

Entity 是 ERDL 规则作用的主体。在 Agent 场景中：

| Entity 类型 | 说明 |
|------|------|
| `agent` | 单个 Agent 实例 |
| `tool` | Agent 调用的工具 |
| `task` | Agent 执行的任务 |
| `workflow` | 多 Agent 编排流程 |
| `human` | 人类审批者 |
| `guardian` | Guardian Agent（监管者） |

Entity 通过 context 传递给规则引擎。规则引擎匹配 context 中的字段与 when 条件。

### 3.2 Rule（规则）

Rule 是 ERDL 的核心单元：

```
Rule = Metadata + When (条件) + Then (动作) + Audit (审计)
```

**优先级与冲突解决**：

1. 按 `priority` 从小到大排序（值越小越先）
2. 同 priority 的，有 `override` 标记的排在前面
3. `override` 字段类型为枚举：`critical` > `high` > `normal` > `low`。未声明时默认为 `normal`
4. 同 priority 且同 override 级别的，按定义顺序
5. `override` 标记的规则可覆盖同一执行环内之前匹配的结果，但**仅允许 DENY → ALLOW 方向覆盖**（不允许覆盖到更不安全的状态，详见 §11.4）

---

#### 🆕 §3.2.1 when 最小完整度要求

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

实践中发现 `when: "true"` + `then: DENY` 的组合会导致**无条件拦截所有操作**——规则引擎的每一次评估都会命中这条规则，等同于系统停摆。这种行为在代码中等价于 `if (true) { throw new Error() }`——逻辑上正确，但工程上不可接受。

同样，无条件的 `when: "true"` + `then: CORRECT` 会向 LLM 的每一次输出注入纠正建议，即使操作与规则完全不相关。

##### 规范

| 规则 | 级别 | 说明 |
|------|------|------|
| `when: "true"` MUST NOT 与 `then: DENY` 搭配 | MUST NOT | 无条件拦截所有操作 |
| `when: "true"` MUST NOT 与 `then: EMERGENCY_HALT` 搭配 | MUST NOT | 无条件终止系统 |
| `when: "true"` MUST NOT 与 `then: CORRECT` 搭配 | MUST NOT | 无差别向所有操作注入纠正建议 |
| `when: "true"` MUST NOT 与 `then: REQUEST_HUMAN` 搭配 | MUST NOT | 无差别触发审批流 |
| `when: "true"` MAY 与 `then: ALLOW + instruction` 搭配 | MAY | 全局建议性规则，不拦截操作 |
| `when: "true"` MAY 与 `then: NOTIFY` 搭配 | MAY | 全局通知性规则 |
| 安全类规则 (category=security) MUST 至少包含 1 个 condition | MUST | 安全规则不能纯猜测 |
| 工具拦截类规则 SHOULD 包含 `tool.name` 条件 | SHOULD | 精确指定影响的工具 |
| 文件操作规则 (涉及 write_file/edit/apply_patch) SHOULD 包含 `tool.args.path` 条件 | SHOULD | 精确指定影响的文件 |
| 命令操作规则 (涉及 exec) SHOULD 包含 `tool.args.command` 条件 | SHOULD | 精确指定影响的命令 |

##### 设计理由

`when: "true"` 的语义是"对所有操作生效"。这个语义仅适用于**建议性规则**（ALLOW + instruction / NOTIFY），不适用于**拦截性规则**（DENY / HALT / CORRECT / REQUEST_HUMAN）。拦截性规则必须在 when 条件中明确指定其适用范围。

##### 示例

```yaml
# ✅ 正确：when: "true" + 建议性指令
- name: "COD-001-docs-reminder"
  description: "提醒写文档"
  priority: 100
  ring: 3
  when: "true"
  then: ALLOW
  message: "变更时请附带摘要说明"

# ❌ 错误：when: "true" + 拦截性规则 — 引擎加载时 MUST 拒绝此规则
- name: "block-everything"
  description: "无条件拦截 — 非法"
  priority: 1
  ring: 0
  when: "true"
  then: DENY
  message: "已被拦截 — when:'true' 不得与 DENY 搭配"

# ✅ 正确：拦截性规则有精确的 when 条件
- name: "COD-002-no-console-log"
  description: "禁止 console.log 进入生产代码"
  priority: 10
  override: high
  ring: 3
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: in
        value: ["write_file", "edit"]
      - field: "tool.args.content"
        operator: contains
        value: "console.log"
  then: CORRECT
  message: "避免在生产代码中使用 console.log"
```

---

#### 🆕 §3.2.2 unless 豁免机制

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

规则在实践中经常需要例外：一条 `no-console-log` 规则可能在测试文件中合理使用；一条 `no-force-push` 规则可能在紧急热修复时合理破例。如果没有豁免机制，用户只能禁用整条规则（失去保护）或忍受误拦截。

`unless` 字段提供规则级的"除非"条件——当 unless 匹配时，跳过 when/then 评估，直接返回 ALLOW。

##### 规范

| 要求 | 级别 |
|------|------|
| `unless` 字段 MUST 使用与 `when` 相同的数据结构：`{ logic: AND|OR, conditions: [...] }` | MUST |
| `unless` MUST 在 `when` 之前评估 | MUST |
| `unless` 匹配 → ALLOW（立即终止，不评估 when） | MUST |
| `unless` 不匹配 → 评估 when → then | MUST |
| `unless` 是可选字段 | MAY |

##### 评估顺序

```
1. unless.conditions → evaluateLeaf()
   ├─ 全部匹配 → ALLOW (终止。MUST NOT 继续评估 when)
   └─ 不匹配 → 继续
2. when.conditions → evaluateLeaf()
   ├─ 全部匹配 → then (执行)
   └─ 不匹配 → PASS
```

> **短路求值保证**：当 `unless` 评估为 true 时，引擎 MUST NOT 评估 `when` 表达式，直接跳过 then 动作。这是逻辑要求（避免无意义计算）、性能要求（减少求值开销）和安全要求（防止 when 中的求值错误——如除零、空指针——在 unless 已豁免的情况下仍被触发）。

##### 设计理由

`unless` 的评估优先于 `when`。这不是"DENY unless X"，而是"当 X 成立时不触发规则"。"触发规则"是 when 的语义，"不触发"是 unless 的语义。两者互为对偶。

##### 示例

```yaml
- name: "COD-002-no-console-log"
  description: "禁止 console.log，但测试文件和正式 logger 豁免"
  priority: 10
  override: high
  ring: 3
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: in
        value: ["write_file", "edit"]
      - field: "tool.args.content"
        operator: contains
        value: "console.log"
  then: CORRECT
  message: "避免在生产代码中使用 console.log"
  unless:
    logic: OR
    conditions:
      # 测试文件豁免
      - field: "tool.args.path"
        operator: match
        value: '\.test\.(ts|js)$'
      # 使用了正式 logger → 有意为之
      - field: "tool.args.content"
        operator: contains
        value: "logger."
```

##### 约束

| 约束 | 级别 | 说明 |
|------|------|------|
| Guard 规则（guard: true）MUST NOT 包含 `unless` 字段 | MUST NOT | Guard 是协议级强制拦截，不允许通过 unless 豁免。unless 仅适用于普通策略规则 |
| `unless` 条件 MUST NOT 包含 `within` 或 `rate` 约束 | MUST NOT | 豁免条件应是静态的、不依赖运行时状态的。`within`/`rate` 依赖时序状态，若在 unless 中使用会导致评估顺序歧义 |

##### 设计理由

Guard 规则的"防线"语义要求它永远不被绕过。如果 Guard 规则可以通过 unless 豁免，则攻击者只需构造匹配 unless 的上下文即可 bypass。这与 §3.6 "Agent 无法绕过 Guard" 的原则矛盾。

---

#### 🆕 §3.2.3 message 强制要求

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

规则引擎的日志是排查问题的唯一依据。在实践中发现部分规则的 `message` 字段为空字符串，当规则触发生效时，用户和开发者只能收到一个冷冰冰的决策（如 "DENY"），完全不知道是哪条规则、因为什么原因触发的。运维排查成本指数级上升。

##### 规范

| 规则 | 级别 |
|------|------|
| `message` 字段 MUST 为非空字符串 | MUST |
| 对 `DENY` 决策：message MUST 包含被拦截的原因 | MUST |
| 对 `REQUEST_HUMAN` 决策：message MUST 包含需要审批的原因 | MUST |
| 对 `CORRECT` 决策：message MUST 包含纠正建议 | MUST |
| 对 `EMERGENCY_HALT` 决策：message MUST 包含紧急终止的原因 | MUST |
| 对 `ALLOW/NOTIFY/AUDIT` 决策：message SHOULD 为非空字符串 | SHOULD |

##### 设计理由

拦截规则是运行时诊断的唯一依据。一个空 message 的 DENY 等同于说"你被拦截了，但我不会告诉你为什么。" 在任何生产系统中，这都是不可接受的。

##### 消费方说明

不同决策类型的 message 有不同的主要消费方和格式建议：

| 决策类型 | 主要消费方 | 格式建议 | 示例 |
|------|------|------|------|
| `DENY` / `EMERGENCY_HALT` | 运维人员 / 最终用户 | 原因 + 规则引用 | "危险命令已拦截 (SEC-001-code-safety)" |
| `REQUEST_HUMAN` | 审批者 | 操作描述 + 审批理由 | "非工作时间写操作，需要主管审批" |
| `CORRECT` | Agent / LLM | 纠正建议 + 目标格式 | "请使用 logger.info() 替代 console.log()" |
| `ALLOW` + instruction | Agent / LLM | 建议性指令 | "请同时更新 CHANGELOG" |
| `NOTIFY` / `AUDIT` | 审计系统 / 合规团队 | 操作摘要 | "操作涉及个人数据，已记录完整审计日志" |

> **设计建议**（v1.2 目标）：当 message 需要同时面向人类和 LLM 时，考虑拆分为 `message.text`（人类可读）和 `message.instruction`（LLM 指令）。当前 v1.1 使用单一 message 字段，规则作者应根据主要消费方选择格式。

---

#### 🆕 §3.2.4 规则命名规范

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

实践中发现 `old-rule`, `new-rule`, `test-rule`, `temp-rule` 等非结构化命名。当规则库增长到 50+ 条时，这些名字失去意义，无法追溯规则的来源、用途和优先级。

##### 规范

| 规则 | 级别 |
|------|------|
| `name` MUST 为非空字符串 | MUST |
| `name` SHOULD 遵循 `[CAT]-[NNN]-描述` 格式，如 `SEC-001-code-safety` | SHOULD |
| `name` MUST NOT 使用 `test-`, `old-`, `temp-`, `debug-`, `wip-` 前缀 | MUST NOT |
| `name` MUST 在规则文件内唯一（不区分大小写） | MUST |

> **大小写与审计记录说明**：唯一性检查不区分大小写（`SEC-001-Code-Safety` 与 `sec-001-code-safety` 视为同名冲突），但审计记录中的 `rule_ref` 保留规则文件内声明的**原始大小写**。这确保了审计日志中的名称精确对应源码中的声明，同时防止大小写变体导致的冲突。

> **NNN 编号说明**：NNN 编号在**规则文件内**唯一即可，不需要跨文件连续或全局唯一。不同文件的编号空间独立（如 file-a.yaml 的 SEC-001 与 file-b.yaml 的 SEC-001 不冲突）。编号管理由规则文件维护者自行负责，不需要中心化分配。审计记录通过 `rule_ref`（文件名 + 规则名 + 版本）区分不同文件中的同名规则。

> **设计理由**：将唯一性从 SHOULD 提升为 MUST——审计日志中的 `rule_ref` 依赖规则名称区分同名规则。如果允许重复名称，热更新和冲突检测无法精确定位目标规则。

##### 分类缩写 (CAT)

| 缩写 | 全称 | 对应 SPEC category |
|------|------|-------------------|
| SEC | Security | security |
| ENG | Engineering | engineering |
| COD | Coding | coding |
| PRF | Performance | performance |
| TST | Testing | testing |
| CMP | Compliance | compliance |
| WRT | Writing | writing |
| DSG | Design | design |
| ACC | Accessibility | accessibility |
| CUS | Custom | custom |

##### 示例

```yaml
# ✅ 正确 — [CAT]-[NNN]-描述 格式
- name: "SEC-001-code-safety"
- name: "ENG-005-no-shortcut"
- name: "COD-003-no-any"

# ❌ 错误 — 禁用前缀或空名
- name: "old-rule"
- name: "test-thing"
- name: ""
```

---

### 3.3 When（条件）

#### 顶层语法

`when` 字段支持三种语法形式：

| 形式 | 语法 | 语义 |
|------|------|------|
| **conditions 数组** | `{ logic: AND|OR, conditions: [...] }` | 标准条件匹配，每条 condition 包含 field/operator/value |
| **扁平简写** | `{ field, operator, value[, rate] }` | 单条件时的简写形式，语义等价于 `{ logic: AND, conditions: [{ field, operator, value }] }` |
| **`'true'` 简写** | `when: "true"` | 恒真匹配（always），不依赖 context。语义等价于无条件命中 |

**设计理由**：`when: "true"` 不是 operator，而是 when 字段的顶层简写——它表示"所有操作均满足此条件"。其求值逻辑为恒真，不与 context 中任何字段交互。仅适用于建议性规则（ALLOW+instruction / NOTIFY），拦截性规则（DENY/HALT/CORRECT/REQUEST_HUMAN）禁止使用（见 §3.2.1）。

#### 13 个 Operator

| Operator | 说明 | 示例 |
|------|------|------|
| `eq` | 等于 | `value: "exec"` |
| `ne` | 不等于 | `value: "exec"` |
| `gt` | 大于 | `value: 100` |
| `gte` | 大于等于 | `value: 3` |
| `lt` | 小于 | `value: 0.8` |
| `lte` | 小于等于 | `value: 10` |
| `in` | 值在列表中 | `value: ["rm", "sudo"]` |
| `not_in` | 值不在列表中 | `value: ["ls", "cat"]` |
| `contains` | 字符串包含 | `value: "delete"` |
| `not_contains` | 字符串不包含 | `value: "drop table"` |
| `match` | 正则匹配 | `value: "(rm -rf|sudo)"` |
| `exists` | 字段存在且非空 | — |
| `within` | 时间窗口约束 | `within: "5m"` |

**`within` 时间窗口**（v1.0 新增）：

```yaml
when:
  logic: AND
  conditions:
    - field: "agent.consecutive_errors"
      operator: gte
      value: 3
      within: "1m"    # 1 分钟内连错 3 次
```

支持的时间单位：`s`（秒）、`m`（分钟）、`h`（小时）、`d`（天）。

**速率限制**（v1.0 新增）：

```yaml
when:
  field: "tool.name"
  operator: eq
  value: "api_call"
  rate: "10/1m"       # 每分钟最多 10 次
```

> **作用域**：`rate` 默认作用于单 Agent 实例。如需全局速率限制，应通过 Guardian Agent 统一管控，或使用 `rate_scope: global` 配置项。

### 3.4 Then（动作）

ERDL 定义了 **18 种完整动作**。其中 14 种为**外部可见决策类型**（进入 Decision Object，§12），4 种为 **Agent 内部推理动作**（不进入跨系统决策记录）：

| 动作 | 层级 | 可见性 | 说明 |
|------|:---:|:---:|------|
| `ALLOW` | Ring 3 | 外部 | 放行，正常执行 |
| `CORRECT` | Ring 3 | 外部 | 纠正参数后放行 |
| `NOTIFY` | Ring 3 | 外部 | 发送通知 |
| `DENY` | Ring 0 | 外部 | 直接拒绝（`BLOCK` 已废弃，等价于 `DENY`） |
| `EMERGENCY_HALT` | Ring 0 | 外部 | 紧急终止，全局生效 |
| `ROLLBACK` | Ring 1 | 外部 | 回滚当前操作 |
| `QUARANTINE` | Ring 1 | 外部 | 隔离，禁止后续操作直到审核 |
| `REQUEST_HUMAN` | Ring 2 | 外部 | 请求人类审批 |
| `ESCALATE` | Ring 2 | 外部 | 升级到上级 Agent |
| `DELEGATE` | Ring 2 | 外部 | 委派给指定 Agent（v1.1: 暂通过 ESCALATE 映射进入 Decision Object，v1.2 独立）|
| `DEFER` 🆕 v1.2 | Ring 2 | 外部 | 延迟决策——暂不决定，等待外部异步输入后再评估（如等待第三方审批回调、等待外部系统事件触发、等待人类在特定 UI 中做出选择）。与 `REQUEST_HUMAN` 不同：后者是"现在需要人决定是否放行"，前者是"现在不做决定，等收到信号后再做决定"。与 `WORKFLOW_WAITING` 不同：后者已知下一步是什么，只是条件未满足；`DEFER` 连下一步都不知道，需要外部信号决定方向。复杂审批流（多角色审批、超时自动拒绝、并行审批分支）中，DEFER 是高频状态 |
| `WORKFLOW` | Ring 3 | 外部 | 启动多步骤 workflow 编排流程 |
| `WORKFLOW_WAITING` | Ring 3 | 外部 | 当前步骤条件不满足，等待后重试 |
| `WORKFLOW_PROGRESS` | Ring 3 | 外部 | 当前步骤完成，推进到下一步 |
| `STRATEGIZE` | Ring 3 | 内部 | 建议替代策略（Agent 推理） |
| `AUDIT` | Ring 3 | 内部 | 仅记录日志（Agent 推理） |
| `CALCULATE` | Ring 3 | 内部 | 安全计算（Agent 推理） |
| `VALIDATE` | Ring 3 | 内部 | 校验不通过则拒绝（Agent 推理） |

**设计理由**：`STRATEGIZE`、`AUDIT`、`CALCULATE`、`VALIDATE` 是 Agent 内部推理动作，不进入跨系统的 Decision Object。`DELEGATE` 是外部可见的委派动作，在 v1.1 中暂通过 ESCALATE 映射进入 Decision Object（§12.3），计划在 v1.2 作为独立决策类型纳入。`DEFER` 为 v1.2 新增类型——复杂审批流（多角色审批、超时自动拒绝、并行审批分支）中，"暂不做决定、等待外部异步信号"是高频场景，现有的 `REQUEST_HUMAN`（即时审批）和 `WORKFLOW_WAITING`（已知下一步的等待）均无法准确表达"方向未定、等外部信号"的语义。Decision Object 仅包含具有**外部可见性**的决策类型——即对企业合规、审计、监管有实际影响的决策。

---

#### 🆕 §3.4.1 metadata.decision 与 rules[].then 的优先级

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

SPEC §5.1 完整模板中同时定义了 `metadata.decision` 和 `rules[].then` 两个决策字段，但未明确两者冲突时的优先级。兼容实现中可能存在两个字段不一致的情况。

##### 规范

| 规则 | 级别 |
|------|------|
| `rules[].then` 优先级高于 `metadata.decision` | MUST |
| 如果 rules[] 中没有规则匹配 → 使用 `metadata.decision` 作为 fallback | MUST |
| `metadata.decision` 未定义 → 默认值为 `ALLOW` | MUST |
| 引擎 SHOULD 在加载时校验两者一致性，不一致 → warning | SHOULD |
| 实现 SHOULD 在写入时保证两者同步 | SHOULD |

##### 语义

`metadata.decision` = "这个文件里如果没有任何一条规则匹配，默认怎么处理"。
`rules[].then` = "这条具体规则匹配到之后怎么处理"。

`rules[].then` > `metadata.decision` > 引擎默认 `ALLOW`。

---

### 3.5 Execution Rings（执行环）

ERDL 借鉴了操作系统 CPU 特权环模型，将 Agent 操作分为四个 Ring。

> **注**：本节基于 v1.0 index.md (2026-08-02) 与 Decision Object v1.0 §4 (2026-08-02 冻结) 合并校准。以 Decision Object 的 Ring 分配为准（2026-08-02 draft.2 已修正）。

```
Ring 0 (最高限制)  ← EMERGENCY_HALT, DENY
Ring 1 (高限制)    ← ROLLBACK, QUARANTINE
Ring 2 (中限制)    ← REQUEST_HUMAN, ESCALATE, DELEGATE, DEFER 🆕 v1.2
Ring 3 (低限制)    ← ALLOW, CORRECT, NOTIFY, WORKFLOW, WORKFLOW_WAITING, WORKFLOW_PROGRESS, STRATEGIZE, AUDIT, CALCULATE, VALIDATE
```

> **注**：Ring 3 中 STRATEGIZE/AUDIT/CALCULATE/VALIDATE 为 Agent 内部推理动作，不进入 Decision Object（§12）。WORKFLOW/WORKFLOW_WAITING/WORKFLOW_PROGRESS 为多步编排动作，v1.1 中不进入 Decision Object，计划 v1.2 纳入。`DEFER`（v1.2 新增，Ring 2）为延迟决策类型——暂不决定，等待外部异步输入后再评估。Free 层可用 ALLOW/CORRECT/NOTIFY/WORKFLOW 系列/DENY/REQUEST_HUMAN；Pro 层额外支持 ROLLBACK/QUARANTINE/ESCALATE/DELEGATE/DEFER；EMERGENCY_HALT 仅 Enterprise。

| Ring | 名称 | 决策范围 | 拥有者 | 典型角色 |
|:---:|------|---------|---------|---------|
| **0** | 安全环 | EMERGENCY_HALT, DENY | 安全/合规团队 | CISO, DPO |
| **1** | 合规环 | ROLLBACK, QUARANTINE（Pro） | 合规/法务团队 | 合规官 |
| **2** | 运营环 | REQUEST_HUMAN（Free）+ ESCALATE, DELEGATE, DEFER（Pro） | 运营/业务团队 | 部门主管 |
| **3** | 执行环 | ALLOW, CORRECT, NOTIFY（Free）+ STRATEGIZE/AUDIT/CALCULATE/VALIDATE（内部） | 开发/个人 | 个人开发者 |

Guardian Agent 默认运行在 Ring 0。普通 Agent 默认运行在 Ring 3。规则可以将特定操作提升到更高的 Ring。

Ring 0 先评估，Ring 3 最后。Ring 0 HALT 可立即短路所有后续评估。高严重性决策不能被低严重性决策覆盖。

### 3.6 Guard（防线）

Guard 是一类特殊的规则——它在 Agent 的 Tool Call 执行前被调用。Guard 拦截所有到达它的调用；在 Guardian Agent 模型中（§3.7），Guardian 独立运行于 Ring 0，Agent 的每个 Tool Call 都必须经过 Guardian 中介，因此 Agent 无法绕过 Guardian 的拦截。在进程内部署模式下，Guard 中介每一个到达 evaluator 的调用。

Guard 的 then 仅支持 Ring 0-2 的动作：`DENY`、`EMERGENCY_HALT`、`QUARANTINE`、`ROLLBACK`、`REQUEST_HUMAN`、`ESCALATE`。（`DELEGATE` 同为 Ring 2 动作，但在 v1.1 中暂通过 `ESCALATE` 映射进入 Decision Object，§3.4.1/§12.3，不直接由 Guard 返回。计划 v1.2 纳入。`DEFER` 为 v1.2 新增 Ring 2 动作——Guard 可返回 DEFER 将决策推迟至外部异步信号到达，适用于复杂审批流中的"暂时搁置"场景。Guard 返回 DEFER 时，Agent 必须暂停当前操作链并注册外部事件监听器，等待异步回调。）此外，Guard 可以返回 `CORRECT`（Ring 3）以纠正参数后放行——CORRECT 是 Guard 在 Ring 3 中的唯一例外，因为 Guard 必须有能力纠正危险参数而不只是拦截。（`BLOCK` 为 `DENY` 的废弃别名。）

### 3.7 Observed / Guardian Agent 模型

ERDL 定义了两种 Agent 角色：

| 角色 | 职责 | Ring |
|------|------|:---:|
| **Observed Agent** | 被监管的 Agent，执行用户任务 | Ring 3 |
| **Guardian Agent** | 监管 Agent，执行规则校验 | Ring 0 |

Guardian Agent 可以拦截 Observed Agent 的所有 Tool Call。一个 Guardian Agent 可以监管多个 Observed Agent。

```yaml
agent:
  role: guardian
  observes:
    - agent-alpha
    - agent-beta
  ruleset: enterprise-compliance.erdl.yaml
```

### 3.8 Audit（审计）

每条规则触发生成一条审计记录（Audit Record）：

```
audit_id            — 唯一标识（UUID v7）
rule_ref            — 规则名称 + 版本
timestamp           — ISO 8601 带纳秒精度
context_snapshot    — 触发时的完整 context（敏感字段脱敏）
decision            — 放行/拦截/纠偏/升级
reason              — 决策原因（人类可读 + 规则引用）
agent_id            — 触发的 Agent Identity
session_id          — 会话标识
parent_audit_id     — 跨 Agent 审计链的上级记录（可选）
ring_level          — 触发时所在执行环
trace_id            — OpenTelemetry Trace ID
```

**跨 Agent 审计链**：

```
Agent A: audit_001 → Agent B: audit_002 (parent: audit_001)
  → Agent C: audit_003 (parent: audit_002)
```

**合规输出**：审计日志支持导出为 OCSF (Open Cybersecurity Schema Framework) 和 OpenTelemetry OTLP 格式。

**unless 审计行为**（v1.1 新增）：当 `unless` 条件匹配导致规则跳过时，引擎 MUST 生成审计记录：

- `decision`: `ALLOW`
- `rule_ref`: `[rule-name]/unless`（例如 `SEC-001-code-safety/unless`）
- `reason`: 包含 unless 条件的具体匹配详情（命中了哪个 unless condition）

这使得 unless 豁免在审计日志中完全可追溯，区别于 when→then 的正常触发路径。

---

## 4. Agent 身份与信任

### 4.1 Agent Identity

每个 Agent MUST 具有唯一身份标识：

```yaml
agent:
  id: "did:erdl:agent-alpha"
  name: "Order Processing Agent"
  version: "2.1.0"
  vendor: "openoba"
```

支持的身份机制：
- **DID**（Decentralized Identifier）— `did:erdl:` 前缀
- **SPIFFE/SPIRE** — 企业级工作负载身份
- **OAuth 2.0 / OpenID Connect** — 标准 Web 身份

### 4.2 Agent BOM (Bill of Materials)

每个 Agent SHOULD 声明其组件清单（AgBOM）：

```yaml
bom:
  llm:
    provider: "deepseek"
    model: "deepseek-v4-pro"
    version: "2026.06"
  tools:
    - name: "exec"
      version: "1.0.0"
      sha256: "abc123..."
    - name: "web_search"
      version: "2.1.0"
      sha256: "def456..."
  skills:
    - name: "browser-automation"
      version: "0.3.0"
      author: "openoba"
  sdks:
    erdl-engine: "1.0.0"
```

支持的 BOM 格式：CycloneDX、SPDX、SWID。

ERDL 规则可以校验 BOM 合规性：

```yaml
protocol: "erdl/v1"
version: "1.1.0"

metadata:
  name: "agent-bom-verify"
  description: "Agent BOM 合规性校验"
  category: compliance
  decision: ALLOW
  tags: [compliance, bom, rulsynor]

rules:
  - name: "CMP-001-require-audited-tools"
    description: "所有 Tool 必须经过审计校验"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "agent.bom.tools[*].sha256"
          operator: exists
    then: ALLOW
    message: "所有 Tool 都有校验和"
```

### 4.3 Trust Scoring

Agent 之间的信任评分（1-1000）：

```
0–199    不信任（Untrusted）
200–499  低信任（Low）
500–749  中信任（Medium）
750–899  高信任（High）
900–1000 完全信任（Full）
```

Trust Score 由 Guardian Agent 根据以下因素动态计算：
- 历史违规次数
- 规则合规率
- BOM 完整性
- 请求频率异常

```yaml
- name: "SEC-001-require-trust-for-delete"
  description: "低信任 Agent 不能删除文件"
  priority: 30
  ring: 2
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "delete"
      - field: "caller.reputation_score"
        operator: lt
        value: 500
  then: ESCALATE
  message: "信任度不足，操作已升级"
```

> **设计理由**：Trust Score 是**声誉信号**（"该 Agent 总体是否可信？"），不是合规/治理依据。合规要求的是逐决策验证：每个受治理的操作绑定 (规则版本, 输入, 判定) 为可重新计算的内容寻址记录，任何第三方可离线验证（详见 §12 Decision Object）。

---

## 5. 规则文件格式

### 5.1 规范模板

ERDL 规则文件遵循严格的字段顺序和格式约定。
所有兼容实现 MUST 接受以下三种模板中的任意一种作为有效输入。

**格式铁律**（三种模板共用）：

1. 顶层字段顺序：`protocol` → `version` → `metadata` → `rules`
2. `metadata` 子字段顺序：`name` → `description` → `category` → `decision` → `tags`
3. `rules[]` 子字段顺序：`name` → `description` → `priority` → `override` → `ring` → `when` → `then` → `message` → `instruction` → `unless`
4. `when.conditions[]` 子字段顺序：`field` → `operator` → `value`
5. `when` 扁平简写（单一条件，不使用 `logic` 和 `conditions` 包装）时，字段顺序与 F4 相同：`field` → `operator` → `value` → `rate`（可选）。`when: "true"` 简写必须使用双引号
6. 字符串值引号规范：自然语言字符串（`description`、`message`、`instruction`、`name`、`field`、`value` 等）MUST 使用双引号。枚举关键字（`then`、`logic`、`operator`、`override`、`category`、`decision`、`ring` 的预定义标识符）、数字（`priority`、`ring`）、布尔值（`true`/`false`）以裸词书写，不加引号。`tags` 数组元素为裸词标识符，不加引号
7. 缩进 MUST 使用 2 空格
8. 规则文件 MUST 以 `protocol: "erdl/v1"` 开头

> **片段与完整模板的缩进基准**：文档中独立出现的规则片段（如 §3.2.1 的 `- name:` 示例）起始列为 0、子字段缩进 2——这是因为省去了外层 `rules:` 的包裹。当规则嵌入完整的 `*.erdl.yaml` 文件时，`- name:` 在 `rules:` 下一级（起始列 2、子字段缩进 4）。两种形式语义等价，仅视觉基准不同。编写规则文件时以完整模板（§5.1.1–§5.1.3）为准。

---

#### 5.1.1 基础模板

单规则、单条件、ALLOW 决策。适用于简单的工具放行规则。

- **①** 文件名约定 — `*.erdl.yaml`，每个文件包含一组规则
- **②** `protocol: "erdl/v1"` — 协议声明，每个文件的第一行，固定值
- **③** `version: "1.1.0"` — 规则文件版本（SemVer），当前稳定版 (§9.2)
- **④** `metadata` — 元数据块，描述这组规则的归属和用途
- **⑤** `metadata.name` — 文件名称，唯一标识，用于日志和审计
- **⑥** `metadata.description` — 文件用途说明，人类可读
- **⑦** `metadata.category` — 规则分类，取自 §3.2.4 分类缩写表
- **⑧** `metadata.decision` — 当所有规则都不匹配时的 fallback 决策 (§3.4.1)
- **⑨** `metadata.tags` — 标签列表，用于搜索和分组
- **⑩** `rules` — 规则列表块，包含 1~200 条规则 (§11.1)
- **⑪** `rules[].name` — 规则名称，必须 `[CAT]-[NNN]-描述` 格式 (§3.2.4)
- **⑫** `rules[].description` — 规则说明，描述这条规则做什么
- **⑬** `rules[].priority` — 优先级，数字越小越优先评估 (§3.2)
- **⑭** `rules[].override` — 覆盖级别，critical/high 可覆盖同 Ring 内的 DENY (§11.4)
- **⑮** `rules[].ring` — 执行环，0=内核级 1=恢复级 2=审批级 3=建议级 (§3.5)
- **⑯** `rules[].when` — 触发条件块，定义规则何时生效
- **⑰** `when.logic` — 条件逻辑，AND（全部满足）或 OR（任一满足）
- **⑱** `when.conditions` — 条件列表块，每个条件检查一个上下文字段
- **⑲** `when.conditions[].field` — 上下文字段名
- **⑳** `when.conditions[].operator` — 运算符（eq/ne/in/match/contains/gte/lte/…）
- **㉑** `when.conditions[].value` — 期望值
- **㉒** `rules[].then` — 动作，条件满足时执行什么（ALLOW/DENY/CORRECT/…）
- **㉓** `rules[].message` — 提示信息，展示给运维人员和审计日志 (§3.2.3)

```yaml
# my-rule.erdl.yaml                         # ① 文件名约定：*.erdl.yaml
protocol: "erdl/v1"                         # ② 协议声明 — 固定值
version: "1.1.0"                            # ③ 规则文件版本

metadata:                                   # ④ 元数据块
  name: "my-first-rule"                    # ⑤ 文件名称
  description: "允许读文件操作"             # ⑥ 文件用途
  category: coding                        # ⑦ 规则分类
  decision: ALLOW                             # ⑧ 默认 fallback 决策
  tags: [example]                           # ⑨ 标签

rules:                                      # ⑩ 规则列表
  - name: "COD-001-allow-read"             # ⑪ 规则名称 [CAT]-[NNN]-描述
    description: "放行 read_file 工具的所有调用"  # ⑫ 规则说明
    priority: 10                            # ⑬ 优先级（数字越小越优先）
    override: high                          # ⑭ 覆盖级别
    ring: 3                                 # ⑮ 执行环（3=建议级）
    when:                                   # ⑯ 触发条件
      logic: AND                            # ⑰ 条件逻辑
      conditions:                           # ⑱ 条件列表
        - field: "tool.name"               # ⑲ 上下文字段
          operator: eq                      # ⑳ 运算符：等于
          value: "read_file"                # ㉑ 期望值
    then: ALLOW                             # ㉒ 动作：放行
    message: "read_file 调用已放行"         # ㉓ 提示信息
```

---

#### 5.1.2 中等模板

双规则、AND/OR 逻辑、eq/in/match 运算符、unless 豁免。
适用于典型的工具拦截与安全校验场景。

在基础模板之上新增：
- **㉔** `unless` — 豁免条件块。when 满足后，如果 unless 也满足，规则不触发 (§3.2.2)
- **㉕** `operator: in` — 列表匹配运算符
- **㉖** `operator: match` — 正则匹配运算符

```yaml
# agent-security-rules.erdl.yaml
protocol: "erdl/v1"
version: "1.1.0"

metadata:
  name: "agent-security-rules"
  description: "Agent 安全拦截规则集"
  category: security
  decision: DENY                              # metadata.decision = DENY：默认拒绝
  tags: [production, security]

rules:
  # ═══ 规则一：拦截危险命令 ═══
  - name: "SEC-001-block-dangerous-commands"
    description: "拦截 exec 工具中的危险 Shell 命令"
    priority: 1                             # 最高优先级，最先评估
    override: critical                      # critical 级别覆盖
    ring: 0                                 # Ring 0：内核级硬拦截
    when:
      logic: AND                            # 两个条件都必须满足
      conditions:
        - field: "tool.name"               # 条件一：工具名
          operator: eq
          value: "exec"
        - field: "tool.args.command"        # 条件二：命令参数
          operator: match                   # 正则匹配
          value: "(rm -rf|sudo|chmod 777|mkfs|> /dev/)"
    then: DENY                              # 动作：硬拒绝
    message: "危险命令已拦截 (SEC-001)。请使用安全替代方案。"

  # ═══ 规则二：写/删操作需审批（管理员豁免）═══
  - name: "SEC-002-approve-writes-or-deletes"
    description: "写文件或删除文件需要审批，但管理员豁免"
    priority: 10
    override: high
    ring: 2                                 # Ring 2：审批级
    when:
      logic: OR                             # OR：任一条件满足即触发
      conditions:
        - field: "tool.name"               # 条件一：工具名等于 write_file
          operator: eq
          value: "write_file"
        - field: "tool.name"               # 条件二：工具名等于 delete_file
          operator: eq
          value: "delete_file"
    then: REQUEST_HUMAN                     # 动作：请求人工审批
    message: "写/删操作需要审批 (SEC-002)。请求已挂起。"
    unless:                                 # ㉔ unless 豁免块
      logic: AND
      conditions:
        - field: "user.role"               # 检查用户角色
          operator: eq
          value: "admin"                    # 管理员角色 → 豁免此规则
```

---

#### 5.1.3 高级模板

多规则、全 Ring 覆盖（0-3）、全运算符覆盖、
unless 豁免。适用于企业级 Agent 治理场景。
三模板间规则互不重叠。

在中等模板之上新增：
- **㉗** `operator: gte` — 大于等于运算符
- **㉘** `operator: ne` — 不等于运算符
- **㉙** `operator: not_in` — 不在列表中运算符
- **㉚** `operator: contains` — 包含子串运算符
- **㉛** `rate: "N/1m"` — 频率限制 (§3.3)
- **㉜** `within: "1m"` — 时间窗口限制 (§3.3)

```yaml
# enterprise-guard.erdl.yaml
protocol: "erdl/v1"
version: "1.1.0"

metadata:
  name: "enterprise-agent-guard"
  description: "企业级 Agent 防线规则 — 全 Ring 覆盖"
  category: security
  decision: DENY
  tags: [production, enterprise, pci-dss]

rules:
  # ═══ 规则一：全局紧急终止（Ring 0 + OR + gte）═══
  - name: "SEC-001-global-emergency-halt"
    description: "威胁等级 ≥900 或收到紧急信号时，Ring 0 全局终止所有 Agent"
    priority: 0                             # 最高优先级
    override: critical
    ring: 0                                 # Ring 0：内核级
    when:
      logic: OR
      conditions:
        - field: "signal.type"
          operator: eq
          value: "emergency"
        - field: "agent.threat_level"
          operator: gte                    # ㉗ 大于等于
          value: 900
    then: EMERGENCY_HALT                    # 全局紧急终止
    message: "全局紧急终止 — 威胁等级异常 (SEC-001)"

  # ═══ 规则二：频率限制（rate + unless）═══
  - name: "SEC-002-rate-limit-delete"
    description: "delete_file 操作超过 5次/分钟 时触发审批，管理员豁免"
    priority: 10
    ring: 2
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "delete_file"
          rate: "5/1m"                      # ㉛ 频率限制：5次/分钟
    then: REQUEST_HUMAN
    message: "delete_file 频率超限 (SEC-002)。需要人工确认后继续。"
    unless:
      logic: AND
      conditions:
        - field: "user.role"
          operator: eq
          value: "admin"

  # ═══ 规则三：路径纠正（in + match + CORRECT + override）═══
  - name: "SEC-003-whitelist-safe-paths"
    description: "放行安全路径内的写操作，系统路径自动纠正"
    priority: 20
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: in                     # ㉕ 列表匹配
          value: ["write_file", "edit", "apply_patch"]
        - field: "tool.args.path"
          operator: match                  # ㉖ 正则匹配
          value: "^(/etc|/var|/sys|/proc|/dev)"
    then: CORRECT                           # 自动纠正
    message: "系统路径已纠正 (SEC-003)。限制到工作区。"

  # ═══ 规则四：安全放行（not_in + contains + ALLOW）═══
  - name: "SEC-004-allow-workspace-reads"
    description: "放行工作区内非关键路径的只读操作"
    priority: 30
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: not_in                 # ㉙ 不在列表中
          value: ["exec", "delete_file"]
        - field: "tool.args.path"
          operator: contains               # ㉚ 包含子串
          value: "workspace"
    then: ALLOW
    message: "工作区只读操作已放行 (SEC-004)"

  # ═══ 规则五：循环检测（gte + within）═══
  - name: "SEC-005-loop-detection"
    description: "1 分钟内连续错误 ≥3 次触发策略建议"
    priority: 40
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "agent.consecutive_errors"
          operator: gte
          value: 3
          within: "1m"                     # ㉜ 时间窗口：1 分钟内
    then: STRATEGIZE
    message: "检测到执行循环 (SEC-005)。建议更换策略或检查输入。"

  # ═══ 规则六：可疑端口拦截（ne + match + 4条件 AND）═══
  - name: "SEC-006-suspicious-network"
    description: "阻止 exec 访问非标准端口（排除 80, 443）"
    priority: 50
    ring: 0                                 # Ring 0：内核级拦截
    when:
      logic: AND                            # 四个条件全部满足
      conditions:
        - field: "tool.name"
          operator: eq
          value: "exec"
        - field: "tool.args.command"
          operator: match
          value: "(:[0-9]+)"
        - field: "tool.args.command"
          operator: ne                     # ㉘ 不等于 — 排除 443
          value: ":443"
        - field: "tool.args.command"
          operator: ne
          value: ":80"
    then: DENY
    message: "可疑网络端口访问已拦截 (SEC-006)"
```

> **字段速查**：以上三个模板共覆盖 ①–㉜ 编号字段。①–㉓ 见基础模板，㉔–㉖ 见中等模板，㉗–㉜ 见高级模板。完整的字段定义见本节格式铁律及 §3.2–§3.5。

> **模板选择指南**：基础模板适用于单个简单规则；中等模板适用于 2–5 条规则的模块；高级模板适用于企业级防线配置。所有模板共享相同的字段顺序和格式约定。任何兼容实现 MUST 能解析三种模板中的任意一种，并 SHOULD 以高级模板作为完整的字段参考。

### 5.2 A2A Agent Card 扩展

ERDL 兼容 A2A v1.0 的 Agent Card：

```json
{
  "name": "Order Processing Agent",
  "description": "Handles order creation and discount application",
  "url": "https://agents.example.com/order-agent",
  "version": "1.0.0",
  "capabilities": {
    "actions": ["create_order", "apply_discount", "delete_order"]
  },
  "extensions": {
    "erdl": {
      "protocol": "erdl/v1",
      "rules_file": "https://agents.example.com/agent.erdl.yaml",
      "audit_endpoint": "https://agents.example.com/erdl/audit",
      "guardian": "did:erdl:guardian-main",
      "reputation_score": 850
    }
  }
}
```

> **设计理由**：`reputation_score` 在 Agent Card 中仅为参考信号（"该 Agent 总体是否可信？"），不是合规/治理依据。合规要求的是逐决策验证——每个受治理的操作绑定 (规则版本, 输入, 判定) 为可重新计算的内容寻址记录（详见 §12 Decision Object）。

### 5.3 MCP Tool 声明

ERDL 作为 MCP Tool 暴露：

```json
{
  "name": "erdl_evaluate",
  "description": "Evaluate ERDL rules against an agent tool call",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tool_name": { "type": "string" },
      "tool_args": { "type": "object" },
      "agent_id": { "type": "string" },
      "session_id": { "type": "string" }
    }
  }
}
```

---

## 6. 安全模型

### 6.1 SafeExpr 表达式引擎

ERDL 使用自研 SafeExpr 引擎——纯递归下降解析器。不使用 `eval`、`new Function`、`Function()` 或任何形式的动态代码执行。

支持的操作：算术（`+` `-` `*` `/` `%` `()`）、逻辑比较、字符串操作。每次求值严格校验 AST 节点类型。不支持原型链访问。不支持 `require`、`import`、`process`。

**安全保证**：即使 ERDL 规则文件被恶意篡改，SafeExpr 引擎不会执行注入的代码。

**幂等性约束**（v1.1 新增）：条件表达式（`when` 和 `unless` 中的 conditions）MUST 是纯同步和幂等的。求值过程中 MUST NOT 执行 I/O 操作（网络请求、数据库查询、文件读写等）。如需外部状态查询，应通过 `fn` 调用委派给已注册的外部函数。条件表达式的确定性是规则引擎正确性的基础假设。

#### 空值传播语义

Agent 上下文（Context）具有高度动态性，字段缺失是常态。SafeExpr 引擎 MUST 实现**三值逻辑下的安全失败**原则，避免因上下文字段缺失导致运行时崩溃：

| 场景 | 行为 | 说明 |
|------|------|------|
| 字段不存在时的相等性比较 | 返回 `false` | `context.missing_field != 'admin'` → false（非 NPE） |
| 字段不存在时的数值比较 | 返回 `false` | `context.count > 5` → false |
| `== null` / `!= null` 检查 | 正常返回 `true` / `false` | 唯一可感知字段存在性的操作符 |
| 类型不匹配的比较 | 返回 `false` | `"100" > 50` → false，禁止隐式类型转换 |
| 字段不存在时的算术运算 | 返回 `false`（条件）或 `EvaluationError`（算术表达式） | |

> **设计理由**：如果采用标准二值逻辑（先访问字段，发现 undefined → 抛异常），动态上下文中的规则引擎极易崩溃。三值逻辑下的安全失败原则确保"字段缺失"被统一视为"条件不满足"而非"求值异常"。这也是跨语言参考实现必须统一的基础语义——不同语言的 `undefined`/`nil`/`None` 处理方式不同，由规范统一定义。

#### 资源配额

为防止 AST 膨胀攻击和正则拒绝服务（ReDoS），SafeExpr 引擎 MUST 在编译和运行时阶段执行以下硬性约束：

| 约束项 | 上限 | 级别 | 超限行为 |
|------|:---:|------|------|
| 表达式字符串长度 | 4KB | Error | 加载时拒绝 |
| AST 最大嵌套深度 | 64 | Error | 加载时拒绝 |
| 单节点最大子节点数 | 256 | Error | 加载时拒绝 |
| 正则匹配步数上限 | 10,000 | Error | 运行时触发保护性中断 → 匹配失败 |

> **设计理由**：递归下降解析器本身不足以防御 ReDoS（嵌套量词、重叠分支等）。这些约束在加载时检测静态复杂度，在运行时中断恶意回溯，确保 SafeExpr 不会成为 Agent 运行时的性能瓶颈。

### 6.2 规则隔离

- 规则文件加载路径 MUST 显式声明。引擎 MUST NOT 自动扫描或加载未经声明的规则文件
- Guardian Agent 的规则域（Policy Domain）与 Observed Agent 隔离
- 策略域变更 MUST 经过 Proposal 审批流程

### 6.3 审计安全

- 审计记录包含 context_snapshot。敏感字段在进入审计记录前 MUST 自动脱敏
- 审计日志 SHOULD 不可篡改（append-only，可选用区块链或 WAL 实现）
- 审计记录 MUST NOT 包含 API key、密码、token 等凭证

### 6.4 Emergency HALT

- Guardian Agent 可以在任何时间发送 EMERGENCY_HALT 信号
- EMERGENCY_HALT MUST 在 1 秒内生效
- 被 HALT 的 Agent 进入 QUARANTINE 状态，所有操作被冻结直到 Guardian Agent 手动解除

---

## 7. 合规对齐

### 7.1 OWASP Top 10 for Agentic Applications (2026)

| OWASP 风险 | ERDL 应对 |
|------|------|
| **A01: Goal Hijacking** | Action Guard 拦截非预期 Tool Call |
| **A02: Tool Misuse** | Guard 规则 + Execution Rings |
| **A03: Data Leakage** | PII 检测 + AUDIT 强制记录 |
| **A04: Memory Poisoning** | BOM 校验 + Audit Chain 追溯 |
| **A05: Identity Abuse** | Agent Identity + Trust Scoring |
| **A06: Excessive Agency** | Execution Rings + REQUEST_HUMAN |
| **A07: Infinite Loops** | within 时间窗口 + STRATEGIZE |
| **A08: Cascading Failures** | Rollback + 跨 Agent 审计链 |
| **A09: Rogue Agents** | Guardian Agent + EMERGENCY_HALT |
| **A10: Supply Chain Risk** | Agent BOM 校验 |

### 7.2 EU AI Act (2026-08-02)

| 要求 | ERDL 覆盖 |
|------|:---:|
| 透明度（Transparency） | ✅ 结构化审计日志 + 自然语言规则 |
| 人工监督（Human Oversight） | ✅ REQUEST_HUMAN + ESCALATE |
| 风险管理（Risk Management） | ✅ Execution Rings + Trust Scoring |
| 技术文档（Technical Documentation） | ✅ Agent BOM + RuleRecord |
| 准确性（Accuracy） | ✅ CORRECT + STRATEGIZE 纠偏 |

### 7.3 NIST AI RMF 1.0

| 功能 | ERDL 映射 |
|------|------|
| Map | ERDL Entity 定义 = 风险映射 |
| Measure | Trust Scoring + 规则合规率 = 度量 |
| Manage | Execution Rings + Guardian Agent = 管理 |
| Govern | Proposal Engine + Snapshot = 治理 |

### 7.4 GB/Z 185-2026 《人工智能 智能体互联》

GB/Z 185-2026 是中国首套智能体互联国家级标准体系，2026 年 5 月 22 日批准发布。由中国电子技术标准化研究院（CESI）牵头，华为、清华大学等 30 余家单位联合研制。系列标准共 7 部分，构建从"身份可信、能力可见、发现匹配、交互协作"到"工具调用、任务完成"的全流程标准化体系。标准的核心原则：**不仅要"连得上"，还要"信得过、管得住、可追溯"**。

GB/Z 185 定义了智能体互联的**四层通用模型**（GB/Z 185.1）：感知层 → 决策层 → 执行层 → 协作层。ERDL 与四层模型的对应关系：

| 层级 | 国标定义 | ERDL 覆盖 |
|------|---------|:---:|
| 感知层 | 上下文获取与环境感知 | ✅ Entity 定义（§3.1）提供结构化上下文输入 |
| 决策层 | 策略决策与行为推理 | ✅ when/then 规则引擎是决策层的声明式实现 |
| 执行层 | 操作执行与安全控制 | ✅ Guard 规则（§3.6）提供协议级拦截 |
| 协作层 | 跨 Agent 通信与协同 | ✅ A2A Agent Card 扩展（§5.2）提供规则声明 |

#### 7.4.1 身份与描述

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **唯一身份码**（GB/Z 185.2）— 28 位 AID 编码（企业信用代码 + 类型 + 序列号 + 安全分级 + 校验码）| ✅ Agent Identity（§4.1）支持 DID / SPIFFE / OAuth 多种身份机制；28 位 AID 作为可选身份方案，通过 `aid` 扩展字段承载 |
| **身份全生命周期管理**（GB/Z 185.3）— 注册 → 认证 → 分级 → 变更 → 冻结 → 注销 | ✅ Agent Identity 支持版本化与状态标记；Guardian Agent 可强制执行身份策略 |
| **审计日志留存 ≥36 个月**（GB/Z 185.3）| ✅ 审计记录（§3.8）包含完整时间戳；Snapshot（§2.2）支持合规归档策略 |
| **ACDL 能力描述语言**（GB/Z 185.4）— JSON Schema 格式，强制标注功能、I/O、权限、依赖、环境约束 | ✅ Entity 定义（§3.1）+ Agent BOM（§4.2）结构语义等价；支持输出为 ACDL JSON Schema |

#### 7.4.2 交互与协作

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **智能体发现**（GB/Z 185.5）— 同步查询 + 异步发布/订阅；本地局域网无中心发现 | ✅ 发现属于 L8 通信层职责（§1.1）— 由 A2A / 注册中心实现；ERDL 在 Agent Card 扩展中声明规则可用性 |
| **gRPC+Protobuf 交互协议**（GB/Z 185.6）— 同步调用 + 异步事件推送 + 长会话上下文传递 | ✅ ERDL 独立于传输协议（§8）；规则引擎通过框架适配层对接任意传输协议 |
| **溯源 AID 链条**（GB/Z 185.6）— 每条报文携带完整协作链 | ✅ 跨 Agent 审计链（§3.8）通过 `parent_audit_id` 实现等价溯源；`trace_chain` 映射到审计记录链 |

#### 7.4.3 工具调用安全

| 国标要求 | ERDL 覆盖 |
|------|:---:|
| **工具注册**（GB/Z 185.7）— 上线前 MUST 登记所有可用工具 | ✅ Agent BOM（§4.2）声明工具清单，含名称、版本、SHA-256 校验和 |
| **参数校验**（GB/Z 185.7）— 调用前 MUST 校验参数合法性 | ✅ Guard 规则（§3.6）在 Tool Call 执行前拦截并校验参数；SafeExpr（§6.1）确保校验逻辑零注入 |
| **权限拦截**（GB/Z 185.7）— 未登记工具 MUST 直接拦截 | ✅ DENY + EMERGENCY_HALT（§3.4）提供协议级拒绝 |
| **调用日志**（GB/Z 185.7）— 每次调用 MUST 记录 | ✅ 审计记录（§3.8）为每次规则触发生成结构化日志 |
| **异常熔断**（GB/Z 185.7）— 异常时 MUST 熔断 | ✅ QUARANTINE（§3.4）+ Guardian Agent（§3.7）提供隔离与熔断机制 |

#### 7.4.4 ERDL 与 GB/Z 185 的互补关系

GB/Z 185 定义了 Agent 互联的**基础设施规范**（身份、通信、发现、工具调用）。ERDL 在此基础上提供了 GB/Z 185 未覆盖的**语义规则层**：

| 能力 | GB/Z 185 | ERDL |
|------|:--:|:--:|
| 身份标识 | ✅ 28 位 AID | ✅ 多身份机制 + AID 兼容 |
| 通信协议 | ✅ gRPC+Protobuf | 传输无关，适配任意协议 |
| 能力描述 | ✅ ACDL JSON Schema | ✅ 可执行的 when/then 规则 |
| 工具安全 | ✅ 五重安全机制 | ✅ Execution Rings 四级分级控制 |
| 决策规则 | — | ✅ 13 operators + Guard + override 硬约束 |
| 决策审计 | ✅ trace_chain 溯源 | ✅ 结构化审计记录（为什么做这个决策）|
| 人工监督 | — | ✅ REQUEST_HUMAN + ESCALATE |
| 规则治理 | — | ✅ Proposal Engine + Snapshot/Rollback |

ERDL 与 GB/Z 185 的关系是**遵守对齐补充**：GB/Z 185 定义 Agent 之间"如何连通"，ERDL 定义 Agent "应遵循什么规则"。两者共同构成完整的 Agent 互操作基础设施——MCP 管工具连接，A2A 管 Agent 通信，GB/Z 185 管互联规范，ERDL 管行为规则。

---

### 7.5 中国信通院「可信 AI 智能体评估体系 2.0」

中国信通院（CAICT）于 2026 年 4 月 15 日发布「可信 AI 智能体评估体系 2.0」，构建面向企业级智能体的全生命周期、多层次、可量化的综合评价框架。评估体系覆盖**八大维度**，为技术选型、项目验收、行业监管与规模化落地提供标准化支撑。

#### 7.5.1 八大维度对应

| 评估维度 | 信通院关注点 | ERDL 覆盖 |
|----------|-------------|:---:|
| 基础设施 | 运行环境、硬件适配、异构兼容、弹性扩展 | 不涉及 — 基础设施由部署平台提供 |
| 数据资源 | 数据开发、数据工程、DataOps | ✅ Entity 定义（§3.1）提供类型安全的数据语义建模 |
| **核心组件** | **协作协议、RAG、Skills、编排** | ✅ ERDL 核心优势区 — Guard 规则协同协议 + fn Skills 注册 + chain/combine 编排 |
| 平台支撑 | 开发、测试、运营、优化全生命周期工具链 | ✅ Hot Reload + Parse/Lint + Snapshot/Rollback + Proposal Engine |
| **关键能力** | **感知、决策、生成、交互、多智能体协同** | ✅ 决策（when/then）+ 生成（Entity 实例化）+ 交互（规则输出）+ 多智能体（Guardian/Observed 模型）|
| 典型应用 | 个人、企业、行业（金融、工业、教育）应用案例 | ✅ §5.1 完整规则模板覆盖工具拦截、安全审计、速率限制等工作负载 |
| 运营管理 | 运维制度与能力 | ✅ 审计日志（§3.8）+ Snapshot 回滚（§2.2）+ Proposal Engine 规则治理 |
| 价值评价 | 业务价值、服务质量、应用效能、应用成熟度 | ✅ 四实验全链路验证 + 开源 ERP 规则覆盖率实证（51–68%）|

#### 7.5.2 核心组件维度深度对齐

信通院明确将"协作协议、RAG、Skills、编排"列为核心组件重点评估项。ERDL 在此维度的对应机制：

| 信通院子项 | ERDL 机制 | 说明 |
|-----------|----------|------|
| 协作协议 | A2A Agent Card 扩展（§5.2）+ Entity 语义约定（§3.1） | `.erdl.yaml` 作为多方共享的规则协议，人 · LLM · Agent · 系统 · 审计共享同一语义约定 |
| Skills | when/then 规则模板 + 条件匹配机制（§3.2/§3.3） | 规则模板中的运算符选择、unless 豁免、override 硬约束、within 时间窗口等机制天然映射到 Skills 维度 |
| 编排 | when/then 编排逻辑 + Guardian/Observed Agent 角色编排 | 规则优先级排序（§3.2）+ 执行环调度（§3.5）+ 多 Agent 规则分治（§11.2）|

---

### 7.6 ISO/IEC 42001:2023 — AI 管理系统

ISO/IEC 42001 是全球首个 AI 管理系统（AIMS）国际标准，采用 Plan-Do-Check-Act (PDCA) 循环，与 ISO 9001 / 27001 / 14001 共用 Annex SL 高层结构，可直接集成到现有企业管理体系中。

| 42001 要求 | ERDL 映射 |
|-----------|----------|
| **A.5.2 AI 方针** — 组织必须建立与战略一致的 AI 方针 | `policies[]`（版本化 YAML 规则文件）→ 企业 AI 治理方针的可执行形式 |
| **A.7.5 文件化信息** — 管理系统文件须受控（创建、更新、分发、保留、处置） | `proposal_id` + Snapshot Manager → 规则变更有完整的提案→审批→版本→回滚生命周期 |
| **A.9.1 监测、测量、分析与评估** — 组织须评估 AI 系统性能和效果 | `matched_rules[]`（每条决策可追溯到策略、上下文、结果）+ `total_evaluated` / `total_matched` |
| **A.9.2 内部审计** — 按计划间隔开展内部审计 | `audit.hash` + `audit.previous_hash`（防篡改审计链）+ 结构化审计日志（§3.8） |
| **A.9.3 管理评审** — 最高管理者定期评审 AIMS | `result.severity` + `result.action_taken`（提供管理层可见的风险处置证据） |
| **A.10.1 持续改进** — 不符合项与纠正措施 | CORRECT + Rollback 机制 → 自动纠正 + 规则迭代闭环 |

ERDL 通过将 AI 方针转化为可执行的 when/then 规则，将 42001 的 PDCA 循环自动化：**Plan**（规则提案）→ **Do**（规则引擎执行）→ **Check**（审计日志验证）→ **Act**（纠正与回滚）。

### 7.7 IEEE P3395 — Recommended Practice for Agentic AI Practices

IEEE P3395 是 IEEE 正在制定的 Agentic AI 实践推荐标准，旨在为 AI Agent 的设计、部署和治理提供行业指导。标准目前处于早期阶段，但 ERDL 已在前述关键方向上与之对齐：

| P3395 方向（预期） | ERDL 前置对齐 |
|-------------------|-------------|
| Agent 行为的可追溯性 | `decision_id` (UUID v7) + `audit.chain`（防篡改） |
| 决策的责任归属 | `agent.role` (guardian/operator/observed) + `agent.id` |
| 多 Agent 协作的边界定义 | Guardian/Observed 模型 + Execution Rings 分层治理 |
| 基于风险的 Agent 分级管控 | `result.severity` (none/low/medium/high/critical) + Execution Rings (Ring 0-3) |

P3395 正式发布后，ERDL 将更新本节以反映最终标准的具体要求。

---

## 8. 协议互操作

### 8.1 与 MCP 的关系

ERDL 可以作为 MCP Tool 暴露。Agent 通过 MCP 协议调用 ERDL 进行规则校验。

**代理模式**（推荐）：将危险 Tool 的 MCP 端点指向 ERDL 代理，由 ERDL 校验后再转发到真正的 Tool 实现。所有经过代理的 MCP 调用都会被 Guard 裁决；Agent 通过此路径无法到达原始 Tool。这是实现确定性 Guard 的最可靠方式。

### 8.2 与 A2A 的关系

ERDL 扩展了 A2A 的 Agent Card（`extensions.erdl` 字段）。在 A2A Task 委派中：

1. 委派前：Agent A 通过 ERDL 校验委派是否合规
2. 委派后：Agent B 通过 ERDL 校验自己是否有权执行
3. 完成后：Agent A 通过 ERDL 校验结果是否可信

### 8.3 与 OpenTelemetry 的关系

ERDL 审计记录输出为 OTLP Span。每个规则触发生成一个 Span。跨 Agent 审计链通过 `parent_audit_id` → OTLP `parentSpanId` 映射。

### 8.4 与 OCSF 的关系

审计日志支持导出为 OCSF (Open Cybersecurity Schema Framework) 格式，兼容 SIEM 系统。

---

## 9. 版本兼容性

### 9.1 协议版本

通过 `protocol` 字段声明：`"erdl/v1"`。引擎在加载规则文件时 MUST 校验协议版本。不支持的版本 MUST 拒绝加载并给出明确错误信息。

### 9.2 规则文件版本

通过 `version` 字段使用 SemVer。不声明则默认为 `"0.0.0"`。

### 9.3 向后兼容

- v1 引擎 MUST 支持 v1 规则文件
- v1.1 所有新增约束（`message` 强制、规则命名规范、`unless` 豁免、质量门禁）对 v1.0 存量规则文件为 Non-breaking
- 引擎加载 v1.0 规则时，不符合 v1.1 新约束的规则 SHALL 触发 Warning（而非 Error），规则仍正常加载和求值
- 例外：`when: "true"` + 拦截性 `then`（§3.2.1）在任何版本中均拒绝加载（MUST Error）
- 新增 operator 不破坏现有规则
- 废弃的 operator SHALL 在文档中标注，至少保留一个大版本的兼容期

---

## 10. 参考实现与验证基准

### 10.1 参考实现（rulsynor）

rulsynor 是 ERDL 规范的全栈参考实现（NestJS + Vue 3），覆盖规则定义、执行、审计、验证的全生命周期。

源代码位于 `OpenOBA/rulsynor`（MIT 许可）。

**能力矩阵（截至 2026-08-02）**：

| # | 特性 | 规范章节 | rulsynor 状态 | 说明 |
|---|------|------|:---:|------|
| 1 | YAML 解析 + Zod 校验 | §2.2 | ✅ | 完整实现 |
| 2 | 13 operators + AND/OR 嵌套 | §3.3 | ✅ | eq/ne/gt/gte/lt/lte/in/not_in/contains/not_contains/match + starts_with/ends_with |
| 3 | SafeExpr 表达式引擎 | §6.1 | ✅ | 递归下降解析，零代码注入 |
| 4 | Action Guard（协议层拦截） | §3.6 | ✅ | Tool Call 执行前确定性拦截 |
| 5 | Hot Reload（热更新） | §2.2 | ✅ | 规则变更无需重启 |
| 6 | 审计日志 | §3.8 | ✅ | 结构化审计记录 + unless 审计行为 |
| 7 | Execution Rings（执行环 0–3） | §3.5 | ✅ | 四层环 + Ring 间 override 约束 |
| 8 | EMERGENCY_HALT | §6.4 | ✅ | 全局应急终止 |
| 9 | unless 豁免机制 | §3.2.2 | ✅ | 条件前的例外评估 |
| 10 | 规则质量门禁（11 项） | §11.5 | ✅ | 加载时自动检测危险/低质量规则 |
| 11 | Decision Object（JCS+SHA-256） | §12 | ✅ | v1.3 规范格式，101 条向量全量通过 |
| 12 | within 时间窗口 | §3.3 | ✅ | 时间敏感规则 |
| 13 | rate 速率限制 | §3.3 | ✅ | 流量控制 |
| 14 | OpSem 操作语义分类 | §3.3 | ✅ | 14 种操作语义类别 |
| 15 | MCP Tool 代理模式 | §5.3 | ✅ | 规则作为 MCP Tool 暴露 |
| 16 | 空值传播（三值逻辑） | §6.1 | ✅ | 字段缺失时安全失败 |
| 17 | 严格类型匹配 | §6.1 | ✅ | 无隐式类型转换 |
| 18 | 资源配额（深度/节点/输入） | §6.1 | ✅ | DoS 防护 |
| 19 | ReDoS 防护 | §6.1 | ✅ | 输入长度限制 + 步数限制 |
| 20 | 动态向量引擎 | §12.7 | ✅ | temporal(10) + seeded(8) + stateful(8) = 26 条 |
| 21 | Decision Object v1.3 跨实现验证 | §12.7 | ✅ | 63 静态 DO + 12 AV + 26 动态 = 101 条全量通过 |
| 22 | Snapshot + Rollback | §2.2 | 🚧 | 规划中（v1.2） |
| 23 | Proposal Engine | §2.2, §6.2 | 🚧 | 规划中（v1.2） |
| 24 | Agent Identity（DID/SPIFFE） | §4.1 | 🚧 | 规划中（v1.2） |
| 25 | Trust Scoring | §4.3 | 🚧 | 规划中（v1.2） |
| 26 | Agent BOM（CycloneDX/SPDX） | §4.2 | 🚧 | 规划中（v1.2） |
| 27 | Observed / Guardian Agent 模型 | §3.7 | 🚧 | 规划中（v1.2） |
| 28 | A2A Agent Card 扩展 | §5.2 | 🚧 | 规划中（v1.2） |
| 29 | OpenTelemetry OTLP 集成 | §8.3 | 🚧 | 规划中（v1.2） |
| 30 | Registry 冲突/遮蔽/冗余检测 | §11.3 | 🚧 | 规划中（v1.2） |
| 31 | GB/Z 185 AID 身份码 | §7.4.1 | 🚧 | 规划中 |
| 32 | GB/Z 185 ACDL 能力描述 | §7.4.1 | 🚧 | 规划中 |
| 33 | 审计日志 ≥36 月留存 | §3.8 | 🚧 | 规划中 |
| 34 | 工具白名单注册表 | §7.4.3 | 🚧 | 规划中 |

**当前覆盖率**：21/34 = **61.8%**（核心引擎 Tier 0+1: 21/21 = 100%，治理/互操作层: 0/13）

### 10.2 验证基准（erdl-vectors v1.3）

ERDL 规范的跨实现验证基准由 `erdl-vectors` 仓库维护，版本 v1.3 为当前唯一权威来源。

> **v1.3 已冻结。** 所有先前的向量版本（v1.0, v1.1, v1.2）均已归档，不作为兼容性验证基准。任何兼容实现 MUST 逐字节通过 v1.3 全量向量。

| 向量类别 | 数量 | 说明 |
|---------|:---:|------|
| 静态决策向量（DO） | 63 | 覆盖 13 种决策类型 × 13 种 operator × Ring 0–4 |
| 审计哈希向量（AV） | 12 | JCS (RFC 8785) + SHA-256 哈希自洽性验证，含 AV-013 链位篡改金丝雀 |
| 动态向量（Temporal/Seeded/Stateful） | 26 | temporal(10) + seeded(8) + stateful(8) |
| **活动向量总计** | **101** | 跨实现验证的完整基准 |
| 预留向量 | 2 | DO-064 (DELEGATE) + AV-013 (链位金丝雀，已实现) |

**第三方验证记录**：

| 实现者 | 仓库 | 验证结果 | 日期 |
|------|------|------|------|
| rulsynor (OpenOBA) | TypeScript | 101/101 ✅ | 2026-08-02 |
| Erik Newton (Concordia) | 独立 runner | 13/13 AV 逐字节匹配 | 2026-08-02 |

**向量集决策类型覆盖**：ALLOW, DENY, CORRECT, REQUEST_HUMAN, ESCALATE, NOTIFY, PASS, ROLLBACK, EMERGENCY_HALT, QUARANTINE, WORKFLOW, WORKFLOW_PROGRESS, WORKFLOW_WAITING（13/14，缺 OVERRIDE）

**向量集 operator 覆盖**：eq, ne, neq, gt, gte, lt, lte, in, not_in, contains, match, matches, exists, starts_with, ends_with（15 种）

> **兼容等级**：
> - **L1 Basic Compatible**：通过 v1.3 全部 101 条向量
> - **L2 Verified Compatible**：L1 + 独立审计 + 跨实现 AV 哈希一致

---

### 工具链路线图（v1.1 新增）

ERDL 的命名规范（§3.2.4）和质量门禁（§11.5）定义了严格的静态约束。纯靠运行时检查或 CI/CD 集成只能做到"事后发现"。为提升开发体验，建议社区推动以下工具链建设：

| 工具 | 说明 | 优先级 |
|------|------|:---:|
| **VS Code Extension** | 在编辑 `*.erdl.yaml` 时实时显示质量门禁结果（红线/黄线），类似 ESLint 体验 | 🟡 P1 |
| **Language Server Protocol (LSP)** | 为任何支持 LSP 的编辑器（Vim/Emacs/JetBrains）提供 ERDL 语言服务 | 🟡 P1 |
| **ERDL CLI `lint`** | 独立命令行工具，输出 JSON/ SARIF 格式的门禁结果，可集成到 CI/CD pipeline | 🟡 P1 |
| **Playground / Sandbox** | 在线编辑 ERDL 规则 + 即时模拟求值 + 向量集验证，降低学习曲线 | 🟢 P2 |

> 以上工具链不构成规范强制要求，由社区按需推进。参考实现团队欢迎社区贡献。

---

## 11. 规则治理

ERDL 不仅定义规则怎么写，还定义规则之间的交互行为。规则治理是 L9 协议层的职责——不由应用层实现、不由 Agent 代劳、不由用户手动维护。引擎在加载规则时自动执行以下治理检测。

### 11.1 规则数量指南

ERDL 引擎的确定性求值在 10,000 条规则内保持 <20ms P99 延迟（Node.js v22 环境实测）。

规则文件的上限不由引擎性能决定，而由以下可审计性约束共同决定：

- **人类审阅能力**：200 条规则（约 3,000 行 YAML）是一次代码评审（Code Review）可覆盖的上限。超过 200 条后，人类无法在一次审阅中追溯完所有规则的交互效应。
- **LLM 审计能力**：当前主流 LLM（DeepSeek/Qwen/GPT-4o）提供 128K tokens 上下文窗口，是标准规范参考的最小实施条件。200 条规则占用约 22% 的窗口（~28KB），为任务上下文保留 78% 的空间。如实施环境使用更大窗口（如 Gemini 2.5 Pro 的 1M tokens 或持续增长的上下文），可在部署者评估后适当提高上限。

| 条件 | 推荐单文件上限 | 依据 |
|------|:--:|------|
| 最小实施条件（128K 上下文 + 人类审阅） | **200 条规则** | 人类 Code Review 可覆盖 + LLM 审计窗口充裕 |
| 充分实施条件（≥1M 上下文 + 自动化审计工具链） | 部署者自定 | 在分片审计和自动化冲突检测支持下可突破 200 条 |
| 理论极限 | 10,000 条 | 引擎性能保证（<20ms P99），但可审计性不再保证 |

**声明**：
- **推荐单文件上限：200 条规则**。超过 200 条时引擎发出 info 级别提示，建议拆分规则文件或使用决策表。
- **推荐单 Agent 上限：1,000 条规则（最多 5 个文件）**。超过 1,000 条时引擎发出 warning，建议增加 Agent 分担规则职责。
- **不设硬性上限**。引擎不阻止加载超过推荐上限的规则文件，由部署者自行决策。
- **核心原则：超过 1,000 条 → 加 Agent，不加规则。** 每个 Agent 独立维护自己的规则文件，通过 Guardian Agent（§3.7）协调跨 Agent 规则交互。

### 11.2 多 Agent 规则分治

当单一 Agent 的规则超过 1,000 条时，不增加规则，而是增加 Agent。每个 Agent 管理一个职责域的规则文件：

```
Agent-A (OrderValidator)     → order_rules.yaml     (180 条)
Agent-B (PaymentGuard)       → payment_rules.yaml    (150 条)
Agent-C (ComplianceAuditor)  → compliance_rules.yaml ( 80 条)
Agent-D (LogisticsRouter)    → logistics_rules.yaml  (120 条)
                              ─────────────────────
                              合计 530 条，4 个 Agent
```

每个 Agent 只求值自己的规则文件，不跨 Agent 合并求值。Agent 间通过任务链传递决策结果，而非共享全局规则表。

如果两个 Agent 的规则产生矛盾（如 Agent-A 要求 CORRECT，Agent-B 要求 DENY），矛盾由 Guardian Agent（§3.7）收集冲突审计记录，触发 REQUEST_HUMAN 由人工裁决。**不引入独立的 Rule MAIN Agent**——冲突裁决是治理问题，不是调度问题。调度逻辑（优先级、第一条匹配、override）已由 ERDL Engine 的求值机制完成。

### 11.3 Registry 全局视图

ERDL Registry（§3.1）在规则加载阶段提供全局视图，但不参与运行时决策：

| 检测项 | 触发条件 | 行为 |
|------|------|------|
| **冲突检测** | 两条规则的条件域重叠（intersection ≠ ∅）AND then 结果不同 | ⚠️ warning：记录到加载审计日志，按 priority 裁决 |
| **遮蔽检测** | 规则 B 的条件域被规则 A 的条件域完全包含（B ⊆ A）AND A 的 priority ≥ B | ⚠️ warning：B 永远不会触发 |
| **冗余检测** | 两条规则的条件域相同（A = B）AND then 结果相同 | ℹ️ info：建议合并 |
| **上限告警** | 规则文件超过 200 条 | ℹ️ info：建议拆分文件 |
| **总量告警** | 单 Agent 注册规则超过 1,000 条 | ⚠️ warning：建议增加 Agent |

所有检测结果写入规则加载审计日志（`RuleLoadAudit`），人可读、Agent 可解析。

### 11.4 规则执行优先级

ERDL Engine 按以下顺序处理规则：

1. 所有规则按 `priority` 升序排列（数字越小越优先）
2. 顺序求值每条规则的 `when` 条件
3. 第一条条件全部匹配的规则决定最终动作（`then`）
4. 如果没有规则匹配，默认动作是 `ALLOW`（默认放行）
5. 标记 `override: critical` 或 `override: high` 的规则可以覆盖之前匹配的结果（仅覆盖 `DENY` → `ALLOW` 方向，不允许覆盖到更不安全的状态）。`normal` 和 `low` 级别不启用覆盖行为。

**注意**：步骤 3 意味着高优先级的 DENY 规则阻止后续规则的评估。如果一个高优先级规则将所有请求标记为 DENY，后续规则不会被执行。这与 AWS IAM 的 deny-by-default 和 iptables 的第一条匹配策略一致。

---

### 🆕 §11.5 规则质量门禁

> 来源：erdl-spec-v1.1-draft.md · 2026-08-02 · 本节为 v1.1 新增

##### 背景

规则是 ERDL 系统的核心资产。错误的规则可能比没有规则更危险。引擎在加载规则时必须执行质量门禁检查，自动发现并报告潜在问题。这与 §11.3 Registry 全局视图互补——Registry 检测规则间的交互问题（冲突、遮蔽、冗余），质量门禁检测单条规则本身的质量问题。

##### 规范

| 门禁 | 级别 | 触发条件 | 行为 |
|------|------|---------|------|
| `wild-when-with-blocking-then` | error | `when: "true"` 且 `then: DENY/CORRECT/EMERGENCY_HALT/REQUEST_HUMAN` | 拒绝加载 |
| `no-condition-on-security-rule` | error | category=security 且 conditions 为空（即未指定任何条件） | 拒绝加载 |
| `empty-message-on-blocking-rule` | warning | `then: DENY/CORRECT/REQUEST_HUMAN/EMERGENCY_HALT` 且 message 为空 | 记录警告 |
| `non-standard-name` | warning | 规则名不符合 `[CAT]-[NNN]-描述` 格式（不仅检测禁用前缀，而是检测整体命名规范违反） | 记录警告 |
| `no-tool-constraint` | warning | coding/security 规则（category）未指定 `tool.name` 条件 | 记录警告 |
| `no-path-constraint` | warning | 涉及 write_file/edit/apply_patch 的规则未指定 `tool.args.path` 条件 | 记录警告 |
| `guard-with-unless` | error | Guard 规则（guard: true）包含 `unless` 字段 | 拒绝加载 |
| `unless-with-temporal` | error | `unless` 条件中包含 `within` 或 `rate` 约束 | 拒绝加载 |
| `no-unless-for-broad-rule` | info | 规则匹配 ≥3 个工具且无 unless 字段 | 记录提示 |
| `regex-redos-risk` | error | when/unless 条件中的正则表达式（`match` operator）存在灾难性回溯风险（如嵌套量词 `(a+)+`、重叠分支 `(a|a)+`） | 拒绝加载 |
| `ast-complexity-exceeded` | error | 条件表达式超过 §6.1 资源配额限制（深度>64、节点数>256、长度>4KB） | 拒绝加载 |

##### 门禁级别语义

| 级别 | 说明 |
|------|------|
| error | 规则不符合 SPEC 强制要求，引擎拒绝加载 |
| warning | 规则存在潜在问题，引擎加载但记录警告 |
| info | 规则可优化，引擎加载并记录提示 |

##### 设计理由

质量门禁是 ERDL 确定性架构的最后一道防线。它不是替代人工审查，而是确保规则在进入运行时引擎之前，符合 SPEC 定义的最低质量标准。这与编程语言的 type checker 作用相同——不是替代代码审查，而是确保代码不会在运行时崩溃。

---

## 12. Decision Object（审计子集）

> 来源：decision-object-v1.0.md · 版本 1.0.0 · 冻结日期 2026-08-02 · 首次发布 2026-08-02
>
> 本节完整集成 Decision Object v1.0 规范作为 ERDL SPEC v1.1 的审计子集。
> Decision Object v1.0 已冻结，任何后续修订须通过规范修订提案（Spec Change Proposal，SCP）流程，并附带更新的审计向量集。

### 12.0 动机：为什么企业需要决策对象标准

#### 12.0.1 监管压力

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
| **信通院八大维度** (2026-04-15) | 企业级 AI Agent 全链路评估：核心组件 / 关键能力 / 平台支撑 / 运营管理 | 中国政企招标资质要求 |
| **Colorado SB 205** (2026-06-30 生效) | AI 决策须可解释，消费者有权申诉 | $20,000 / 违规 |
| **新加坡 Agentic AI 治理框架** (2026-01-22) | 全球首个专属 Agent AI 治理框架：界定风险、人负全责、技术控制、用户责任 | 自愿，但企业承担最终法律责任 |

#### 12.0.2 企业痛点

企业合规团队面临一个共同的技术障碍：**不同厂商的 Agent 用不同的格式输出决策。** 审计员拿到的是 Prompt 日志 + 对话截图，不是结构化、可验证的决策记录。

以金融服务为例——COSO 2026 已明确要求 AI 审计轨迹必须展示 "控制功能按设计运作"（control functioned as designed）。一条对话截图无法满足这个要求。

ERDL Decision Object 解决这个问题：为 Agent 决策提供一个**机器可读、跨实现验证、防篡改**的标准输出格式。

#### 12.0.3 跨实现中立性

一个开放标准的中立性**不是宣称出来的，是靠独立实现验证出来的。** 本规范的设计原则：

> **给定相同的规则集和上下文，任何兼容的 ERDL 实现必须产生逐字节一致的 Decision Object。**

三个独立实现、同一份规范、同一个向量集、没有单一控制者——这是去中心化基础设施的经典路径（参见 RFC 2026、IETF 标准流程）。

---

### 12.1 范围与受众

#### 12.1.1 本标准面向

| 受众 | 角色 | 关注点 |
|------|------|--------|
| **企业合规团队** | 审计 Agent 决策、满足监管要求 | "这条决策能不能提交给监管机构作为证据？" |
| **Agent 平台开发者** | 实现 ERDL 兼容的规则引擎 | "我的引擎输出能不能通过跨实现验证？" |
| **监管科技 (RegTech) 厂商** | 构建 AI 审计产品 | "我能用这个格式自动解析任何 ERDL Agent 的决策吗？" |
| **标准化组织** | 评估协议中立性 | "存在独立实现吗？向量集是否能复现？" |

#### 12.1.2 本标准不面向

- ❌ 个人开发者日常使用（见 MCP Server Free 层）
- ❌ Agent 行为的最佳实践建议
- ❌ LLM 模型的评估或基准测试

---

### 12.2 规范

#### 12.2.1 Decision Object 格式

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

#### 12.2.2 字段定义

##### 顶层字段

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

##### agent 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `agent.id` | string | ✅ | Agent 唯一标识（建议 GB/Z 185 AID 或 DID:ERDL 格式） |
| `agent.role` | string | ✅ | `guardian` / `operator` / `observed` |
| `agent.version` | string | ✅ | Agent 软件版本号 |

##### policies 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `policies[].id` | string | ✅ | 策略唯一标识 |
| `policies[].name` | string | ✅ | 人类可读名称 |
| `policies[].version` | number | ✅ | 策略版本号（用于审计追溯） |
| `policies[].hash` | string | ✅ | 策略完整内容的 SHA-256 哈希 |

##### evaluation 字段

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

##### result 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `result.decision` | string | ✅ | 决策类型（见 §12.3） |
| `result.severity` | string | ✅ | `none` / `low` / `medium` / `high` / `critical` |
| `result.reason` | string | ✅ | 人类可读的决策解释（PASS 时为描述性说明） |
| `result.action_taken` | string | ✅ | 实际执行的动作：`allowed` / `blocked` / `corrected` / `paused` / `halted` / `rolled_back` / `quarantined` / `escalated` |

##### audit 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|:---:|------|
| `audit.hash` | string | ✅ | 本条记录全文的 SHA-256 哈希。计算时 MUST 先将 record 按 JCS (RFC 8785) 规范化序列化，**删除** `hash` 字段（MUST 删除该 JSON key，不得将其设为 `null` 或空字符串 `""`。删除 key 与置空在 JCS 下产生不同的 canonical byte sequence，因此产生不同的 digest），然后求 SHA-256（MUST 使用 FIPS 180-4 定义的 SHA-256 算法）。哈希值以 `sha256:` 前缀 + 64 位小写十六进制格式表示。 |
| `audit.previous_hash` | string | — | 上一条审计记录的哈希（形成链），首条记录为 null |
| `audit.commitment` | string | ✅ | 防篡改承诺字符串：`timestamp|agent_id|tool_name|decision` |

---

### 12.3 决策类型与严重性

> **注**：以下 11 种决策类型为 ERDL 完整动作集（§3.4）的**外部合规子集**。`PASS` 为 Decision Object 层对引擎层「无规则匹配 → 默认 ALLOW fallback」的合规表述——二者指向同一执行路径（放行），`PASS` 用于审计记录、`ALLOW` 用于规则定义。`DELEGATE` 暂通过 `ESCALATE` 映射进入 Decision Object，计划 v1.2 独立。`DEFER`（v1.2 新增，Ring 2）为延迟决策类型——暂不决定，等待外部异步输入后再评估；与 `REQUEST_HUMAN`（即时审批）和 `WORKFLOW_WAITING`（已知下一步的等待）不同，`DEFER` 表达的是"方向未定、等外部信号"的状态。`STRATEGIZE`、`AUDIT`、`CALCULATE`、`VALIDATE` 为 Agent 内部推理动作，不进入跨系统 Decision Object。下一版 Decision Object 将正式纳入 `DELEGATE` 和 `DEFER` 作为独立决策类型。

| 决策 | 严重性 | 含义 | Agent 行为 | 层级 |
|------|:---:|------|-----------|:---:|
| `PASS` | none | 无规则匹配（引擎侧等价于 `ALLOW` 默认 fallback，§3.4.1） | 正常执行 | Free |
| `ALLOW` | none | 放行，附建议 | 正常执行，遵循建议 | Free |
| `CORRECT` | medium | 自动纠正 | 参数修正后继续执行 | Free |
| `REQUEST_HUMAN` | medium | 暂停等待审批 | 操作挂起，等待人类确认 | Free |
| `ESCALATE` | medium | 升级到更高级审查者 | 操作挂起，升级到指定审查者 | Pro |
| `NOTIFY` | low | 发出合规通知 | 继续执行但记录通知 | Pro |
| `DENY` | high | 硬拦截 | 操作被阻止，须修改 | Free / Pro |
| `ROLLBACK` | high | 回滚已执行的操作 | 撤销操作，恢复先前状态 | Pro |
| `QUARANTINE` | critical | 隔离 Agent | 禁止所有后续操作，直到审计完成 | Pro |
| `EMERGENCY_HALT` | critical | 全局紧急终止 | 立即停止所有被监管的 Agent | Enterprise |

> **注**：`ROLLBACK`、`QUARANTINE` 和 `ESCALATE` 的 Ring 1/2 级实现为 Pro 功能。Free 层（Ring 3）支持 `ALLOW`、`CORRECT`、`NOTIFY`、`DENY`、`REQUEST_HUMAN`。`EMERGENCY_HALT` 仅在企业版 Ring 0 中可用。`BLOCK` 在本规范中等价于 `DENY`——两者语义相同，`DENY` 为本规范的统一术语。
>
> **DELEGATE → ESCALATE 映射**（v1.1 过渡方案）：当规则触发 `DELEGATE` 动作时，Decision Object 的 `result.decision` 字段使用 `ESCALATE`，`result.reason` 中携带原始 DELEGATE 信息（格式：`DELEGATE to <agent_name> — <original_reason>`），`evaluation.matched_rules[].decision` 保留原始 `DELEGATE` 值。v1.2 计划将 `DELEGATE` 作为独立决策类型纳入 Decision Object。

---

### 12.4 审计链

Decision Object 支持**防篡改审计链**，每条记录通过 `audit.previous_hash` 链接到上一条记录：

```
[Record N-1]  →  [Record N]  →  [Record N+1]
  hash: abc       hash: def       hash: ghi
                  prev: abc       prev: def
```

任何记录的篡改都会破坏整条链的哈希一致性。审计员只需验证最新的 `audit.hash` 即可确认整条链的完整性。

---

### 12.5 数据保留

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

### 12.6 合规对齐（逐字段映射）

Decision Object 与 9 大监管框架的逐字段对齐详见 Decision Object v1.0 §3。关键映射摘要：

| 框架 | 核心要求 | Decision Object 对应 |
|------|---------|---------------------|
| EU AI Act Art.12/13/14 | 记录保存、透明度、人类监督 | `decision_id` + `result.reason` + `REQUEST_HUMAN`/`ESCALATE` |
| GB/Z 185 | AID 身份码、工具安全五机制、决策追溯 | `agent.id` + `matched_rules[]` + `audit.previous_hash` |
| COSO 2026 | 完整审计轨迹、控制功能可按设计运作 | `decision_id` + `policies[]` + `matched_rules[]` |
| NIST AI RMF | Govern/Map/Measure/Manage | `agent.role` + `context` + `evaluation` + `result` |
| ISO/IEC 42001 | PDCA 循环、内部审计 | `policies[].version` + `audit.hash` + `result.severity` |
| OWASP Top 10 | 10 项风险逐项控制 | `matched_rules[]` 映射到各 OWASP 编号 |

---

### 12.7 跨实现验证

#### 12.7.1 原则

本标准的中立性通过独立验证证明：

1. 任何实现者可以参照本规范编写 ERDL 兼容的决策引擎
2. 所有实现必须能重现向量集中的全部测试向量
3. 验证结果提交到不受单一实体控制的中立仓库（如 A2A #2031）

#### 12.7.2 向量集

验证基准由独立仓库 **erdl-vectors** 维护：

> **仓库**：[github.com/erdl-vectors](https://github.com/erdl-vectors) — MIT 许可，独立于任何单一实现维护。
> **当前权威版本：v1.3（已冻结）**。所有先前版本（v1.0, v1.1, v1.2）均已归档。

**v1.3 向量集**（文件：`decision-object-vectors-v1.3.json`）：

| 类别 | 数量 | 说明 |
|------|:---:|------|
| **A. 静态决策引擎向量（DO）** | 63 | 覆盖 13 种决策类型 × 15 种 operator × Ring 0–4。包含 unless 豁免、override 方向约束、空值传播、unless 审计行为、metadata.decision fallback、空条件规则兜底等规范语义。 |
| **B. 审计哈希向量（AV，12 条）** | 11 + 1 金丝雀 | JCS (RFC 8785) + SHA-256 哈希自洽性。AV-001~AV-012 应对 DO 逐字节匹配。AV-013 为链位篡改金丝雀（tapered `previous_hash`）——兼容实现 MUST 检测到不匹配。 |
| **C. 动态向量** | 26 | Temporal(10) + Seeded(8) + Stateful(8)。覆盖时间敏感规则、种子随机化、跨步骤状态累积。 |
| **活动向量总计** | **101** | 跨实现验证的完整基准 |
| 预留向量 | 2 | DO-064 (DELEGATE) + 预留 AV，尚未激活 |

**决策类型覆盖** (13/14)：ALLOW, DENY, CORRECT, REQUEST_HUMAN, ESCALATE, NOTIFY, PASS, ROLLBACK, EMERGENCY_HALT, QUARANTINE, WORKFLOW, WORKFLOW_PROGRESS, WORKFLOW_WAITING（暂缺 OVERRIDE）

**Operator 覆盖** (15 种)：eq, ne, neq, gt, gte, lt, lte, in, not_in, contains, match, matches, exists, starts_with, ends_with

**第三方验证记录**：

| 实现者 | 语言 | 结果 | 日期 | 可独立执行？ |
|------|------|------|------|:---:|
| Erik Newton (Concordia) | 独立 runner (Python) | 13/13 AV 逐字节匹配（含 AV-013 金丝雀） | 2026-08-02 | ✅ 可克隆执行 |

> **"可独立执行"列**："✅ 可克隆执行"表示独立读者可克隆仓库并在无需访问任何私有数据的情况下执行测试。"—"表示实现者未提供公开仓库。
>
> Rulsynor 已在内部完成 v1.3 全量向量对齐（71/71 静态 + 26/26 动态），将在公开发布后作为第二个可独立执行的参考实现加入本表。

#### 12.7.3 合规验证方法（规范性）

##### 决策引擎向量

兼容实现编写 ERDL 规则引擎，加载向量集中的每条决策向量，运行规则评估，比较输出 `result.decision` 与向量集期望值。`PASS` 和 `ALLOW` 在引擎层功能上等价（均为"放行"），但向量集预期值为 `PASS` 的用例（如空规则集）在审计层应以 `PASS` 记录。

> **v1.3 语义**：引擎默认 fallback 为 `ALLOW`（无规则匹配时）。`PASS` 用于审计记录层区分"主动放行"与"无规则管控"。

##### 审计哈希向量

兼容实现 **MUST** 对每条审计哈希向量执行以下六步验证：

1. 从向量集加载 Decision Object
2. 提取 `decision_object.audit.hash`，保存为**声称哈希值**（claimed hash）
3. 从 `decision_object` 中**删除** `audit.hash` key（MUST 删除，不得设为 null/空字符串）
4. 对剩余对象按 JCS (RFC 8785) 规范化序列化
5. 对 canonical bytes 计算 SHA-256 (FIPS 180-4)，前缀 `sha256:`
6. **逐字节比较**重算哈希与声称哈希

**对 AV-013（链位篡改金丝雀）**：兼容实现 MUST 检测到 `audit.hash` 不匹配——这是正确的预期行为。金丝雀向量保证任何使用缓存/预计算答案的简写 runner 被暴露。

> **兼容等级**：
> - **L1 Basic Compatible**：通过 v1.3 全部 101 条向量（63 DO + 12 AV + 26 dynamic）
> - **L2 Verified Compatible**：L1 + 至少两个独立实现的 AV 哈希逐字节一致

验证结果 **SHOULD** 提交到 erdl-vectors 仓库供公开记录。

---

## 13. 贡献

ERDL 是一个社区驱动的开放标准。欢迎通过以下方式参与：

- **GitHub Issues** — 提交建议、bug 报告、用例
- **GitHub Discussions** — 讨论协议设计、扩展提案
- **规则模板贡献** — 提交 Agent 场景的规则模板
- **适配器开发** — LangGraph / CrewAI / AutoGen / OpenClaw 适配器

**仓库**：[github.com/OpenOBA/erdl-landing](https://github.com/OpenOBA/erdl-landing)
**网站**：[openoba.com/erdl](https://openoba.com/erdl)
**许可证**：MIT

---

## 14. 社区致谢

ERDL v1.0–v1.1 在开放的社区讨论中得到完善。

- **Erik Newton (Concordia)** — 在 A2A Discussion #2031 中提出并验证了"中立性不是宣称的，是测出来的"这一核心原则。Concordia 作为 ERDL Decision Object 的第二个独立 runner，在 A2A #2031 提交了全部 28 条合规向量的逐字节验证结果。其提出的"三个独立实现、一个开放规范、没有单一所有者"的标准化路径为 ERDL 从开源项目走向基础设施标准奠定了方法论基础。在 v1.1 冻结期审计中，Erik 独立发现 `expected_sha256` 作为答案密钥的结构性风险，并提出"删除 `expected_sha256`、保留 `canonical_bytes`（hex 明文格式）作为诊断工具、增加陈旧回归向量"的方案——该方案已被全量采纳。其通过 `canonical_bytes` 逐字节比对定位到 AV-003/AV-004/AV-005 差异源自一个 em-dash 字符的事实，证明了 `canonical_bytes` 作为跨实现诊断锚点的不可替代价值。
- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — 在 A2A Discussion #2031 中提出了关键贡献：合规 substrate 模型与跨验证愿景（"two L2s targeting the same JCS+SHA-256 discipline"）；声誉（advisory）与合规证据（per-decision 可重新计算的记录）的本质区分；content-address receipt 模型（RFC 8785 JCS 规范化 → SHA-256 帧）；以及其提出的 Agent 治理四层模型（guardrails, action gate, harness, governance）独立验证了 ERDL 所实现的 Action Gate 层。在 v1.1 冻结期独立审计中，Chris 提交了书面审计报告，指出"五步简写删除了需要校验的字段"这一结构性缺陷，通过 c3f22df→5cff368 两提交对比证明了 7/7 PASS（五步）vs 4/7 PASS（六步）的差异，验证了 JCS 下 delete-key vs blank-key 产生不同 SHA-256（023c4b vs bd0925），并提供了纯 hex+SHA-256 复现脚本（无需 canonicalizer），其报告已被纳入 §12.7.3 设计理由。
- **Tang Qixin (唐启鑫, DPO)** — 合规对齐审校（EU AI Act、GB/Z 185、NIST AI RMF、COSO）

欢迎通过 GitHub Issues 和 A2A Discussions 继续参与社区审阅。

---

## 附录 A：术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 实体 | Entity | 规则作用的主体 |
| 规则 | Rule | when/then 定义的行为约束 |
| 防线 | Guard | Tool Call 前的强制规则 |
| 执行环 | Execution Ring | 借鉴 CPU 特权环的操作分级 |
| 监管 Agent | Guardian Agent | 执行规则校验的 Agent |
| 受监管 Agent | Observed Agent | 被监管的普通 Agent |
| 代理模式 | Proxy Mode | ERDL 代理危险 Tool 的 MCP 端点 |
| 审计记录 | Audit Record | 规则触发的结构化记录 |
| 决策对象 | Decision Object | 跨系统可验证的标准化决策输出格式 |
| 组件清单 | AgBOM | Agent Bill of Materials |
| 信任评分 | Trust Score | Agent 之间的动态信任度 |
| 质量门禁 | Quality Gate | 规则加载时的自动质量检查 |

## 附录 B：Cisco L8/L9 参考

Cisco 研究团队在 arXiv:2511.19699 中提出 Agent 协议的分层架构：

- **L8 (Agent Communication Layer)** — 标准化消息信封、Speech-Act Performatives（REQUEST、INFORM 等）、交互模式（request-reply、publish-subscribe）
- **L9 (Agent Semantic Negotiation Layer)** — **"does not exist today"**。使 Agent 能够发现、协商并锁定 Shared Context。

ERDL 的 Entity 定义直接实现了 L9 的 Shared Context 功能。ERDL 的 then 语义（DELEGATE 等信息传递动作）对应了 L8 的 Speech-Act Performatives。

## 附录 C：参考

- Anthropic, "Model Context Protocol (MCP)", 2024. modelcontextprotocol.io
- Google, "Agent-to-Agent Protocol (A2A) v1.0", 2026. a2a-protocol.org
- Fleming et al., "A Layered Protocol Architecture for the Internet of Agents", arXiv:2511.19699, 2025
- OWASP, "Top 10 for Agentic Applications", 2026. genai.owasp.org
- NIST, "AI Agent Standards Initiative", 2026. nist.gov
- EU, "AI Act", Regulation 2024/1689, effective 2026-08-02
- ISO/IEC 42001:2023, "AI Management System"
- IEEE P3395, "Recommended Practice for Agentic AI Practices"
- Agent Control Standard (ACS), github.com/Agent-Control-Standard
- Microsoft, "Agent Governance Toolkit", 2026. github.com/microsoft/agent-governance-toolkit
- GB/Z 185-2026, 《人工智能 智能体互联》系列国家标准（7 部分），国家市场监督管理总局、国家标准化管理委员会，2026
- 中国信通院，《可信 AI 智能体评估体系 2.0》，2026-04-15
- 国家互联网信息办公室、国家发展和改革委员会、工业和信息化部，《智能体规范应用与创新发展实施意见》，2026-05-08
- IETF, "JSON Canonicalization Scheme (JCS)", RFC 8785, 2020

## 附录 D：v1.0 → v1.1 变更摘要

| v1.0 问题 | v1.1 解决 |
|----------|--------|
| 未定义 when 的最低完整性 | §3.2.1 when 最小完整度要求 |
| 规则无例外机制 | §3.2.2 unless 豁免 |
| message 无强制性要求 | §3.2.3 message 强制 |
| 命名无规范 | §3.2.4 命名规范 |
| 两个 decision 字段冲突 | §3.4.1 优先级定义 |
| 无规则加载质量检查 | §11.5 质量门禁 |
| Decision Object 独立于主 SPEC | §12 审计子集集成 |
| 执行环 Ring 分配不一致 | §3.5 以 Decision Object v1.0 为准校准 |
| Then 动作集内外不分 | §3.4 明确区分 17 种完整动作 vs 13 种外部合规子集 |
| `when: "true"` 语法地位模糊 | §3.3 明确定义为 when 顶层简写（always 语义），非 operator |
| Guard 与 unless 的交互冲突 | §3.2.2 禁止 Guard 规则使用 unless；unless 禁止 within/rate |
| unless 审计行为未定义 | §3.8 定义 unless 豁免的审计记录格式 |
| 命名唯一性约束太弱 | §3.2.4 提升为 MUST，增加 NNN 编号管理说明 |
| 质量门禁级别不匹配 | §11.5 重定义级别：no-tool-constraint/no-path-constraint → warning；新增 no-condition-on-security-rule/guard-with-unless/unless-with-temporal；删除 decision-field-conflict |
| message 消费方不明确 | §3.2.3 增加消费方说明表 + v1.2 拆分建议 |
| rate 作用域未定义 | §3.3 明确默认作用于单 Agent 实例 |
| SafeExpr 空值传播语义未定义（跨语言行为不一致） | §6.1 三值逻辑安全失败 + 严格类型匹配 |
| SafeExpr 资源配额未定义（AST 膨胀/ReDoS 攻击面） | §6.1 深度/节点/步数硬性约束 |
| ReDoS 静态检测未纳入门禁 | §11.5 新增 regex-redos-risk + ast-complexity-exceeded |
| REQUEST_HUMAN Free/Pro 分层不一致 | §3.5 + §12.3 三处统一：REQUEST_HUMAN = Free |
| 审计向量 `expected_sha256` 作为答案密钥存在简写 runner 跳过重算的风险 | §12.7.2–§12.7.3 移除 `expected_sha256`，保留 `canonical_bytes`（hex 明文）作为诊断工具；新增 AV-008 陈旧回归向量 |
| 五步简写（strip → JCS → SHA-256 → 比 expected_sha256）无法检测自引用 audit.hash 过期 | §12.7.3 六步验证为 MUST（含步骤 6 audit.hash 自指校验）；实证案例添加至设计理由 |
| JCS delete-key vs blank-key 语义差异未在规范中明确 | §12.2.2 audit.hash 字段说明 + §12.7.3 步骤 3 明确 MUST 删除 key，不得设为 null 或空字符串 |

## 附录 E：v1.2 规划目标

以下议题在 v1.1 中标记为 TODO，计划在 v1.2 中解决：

| 议题 | 来源 | 优先级 |
|------|------|:---:|
| message 字段拆分（text / instruction / audit_note） | 外部 review §1.3 | 🟡 P1 |
| 分布式一致性（EMERGENCY_HALT 全局生效、within 分布式状态存储） | 外部 review §2.1/§3 | 🔴 P0 |
| 热更新原子性和错误处理策略 | 外部 review §2.5 | 🟡 P1 |
| JCS+SHA-256 合规证据链纳入规范正文 | 外部 review §3 | 🔴 P0 |
| 参考实现追赶（Guardian/Observer/Execution Rings 等 🚧 项） | §10 能力矩阵 | 🔴 P0 |
| DELEGATE 正式纳入 Decision Object | §3.4/§12.3 标注 | 🟡 P1 |
| DEFER 作为新决策类型纳入（延迟决策，等待外部异步输入） | §3.4/§12.3 新增 | 🟡 P1 |
| message 模板变量插值（`{{amount}}` 等） | 第4方审计 §2 | 🟡 P1 |
| 自定义质量门禁扩展（Custom Linters） | 第4方审计 §3 | 🟡 P1 |
| 条件表达式纯同步和幂等性强制（SafeExpr I/O 约束） | 第4方审计 §4 技术风险 | ✅ 已补入 v1.1 §6.1 |
| unless 短路求值语义的完整实现验证 | 第4方审计 §1 | 🟡 P1 |
| 空值传播语义规范化（三值逻辑安全失败） | 第三方评估 SafeExpr 研究 | ✅ 已补入 v1.1 §6.1 |
| SafeExpr 资源配额（深度/节点/步数上限） | 第三方评估 SafeExpr 研究 | ✅ 已补入 v1.1 §6.1 |
| 严格类型匹配（禁止隐式转换） | 第三方评估 SafeExpr 研究 | ✅ 已补入 v1.1 §6.1 |
| ReDoS 静态检测纳入 §11.5 门禁 | 第三方评估 SafeExpr 研究 | ✅ 已补入 v1.1 §11.5 |
| 异步降级协议（Fail-Close/Fail-Open 配置） | 第三方评估 SafeExpr 研究 | 🟡 P1 |
| 协议隔离适配器层（Canonical Model + Adapter Trait） | 第三方评估 MCP/A2A 研究 | 🟡 P1 |
| JCS+SHA-256 证据链细化条款（字段排序、数值规范化等） | 第三方评估密码学研究 | 🔴 P0 |

---

> *"确定性架构，而非 Prompt 工程。*
> *声明式规则描述语言，兼容 MCP 和 A2A 生态。*
> *人、LLM、系统、审计共享的语义约定层。"*
>
> -- OpenOBA · 2026.07.22 · v1.1 (Final)
