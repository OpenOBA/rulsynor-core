# @rulsynor/core

> **大模型厂商交付超群智商，我们交付恪守职业操守的数字员工。**
>
> 万亿级参数 LLM 让智商已不再是稀缺资源，但缺乏职业道德的天才足以毁掉一切。

```bash
npm install @rulsynor/core
```

---

## 问题

没有企业会雇用未经过培训的员工，更不会让未经考核的新人直接操盘核心业务。但当下的每个 AI Agent 框架，都**跳过了这一步**——把原始智能直接塞进生产系统。

一个智商超群但没有任何职业操守的员工，是企业的定时炸弹。Agent 也一样。

---

## rulsynor 是什么

给 AI Agent 注入**职业精神**的基础设施。将人力资源管理全生命周期的核心理念，映射到 Agent 上：

```
撰写规则 → 培训 → 考核 → 发工牌 → 上岗 → 每笔操作留痕 → 纠正错误 → 累积信誉 → 年审
```

这不是套在 LLM 调用外面的一层安全过滤器，这是企业数字智力资源的治理基础设施——从规则编写到加密审计，一步不落。

---

## 快速体验：30 秒，见证一个有职业操守的 Agent

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 已培训：    28 条岗位规则
🛡️  决策：     DENY
📝 原因：      Destructive command blocked. Use safe alternatives or request human approval.
🧾 操作留痕：  sha256:18ce857...（不可篡改）
🪪 执行者：    工号 1.2.156.3088.1.000001.000001.28027273
📊 合规辖区：  CN（符合 GB/Z 185-2026 标准）
🧭 替代建议：  Use the read tool to inspect the target first
```

**不是"不行"。是"这样不行，但这个可以。"**

---

## 全生命周期操作指南

### 一、撰写规则 —— 定义职业底线

规则是 ERDL YAML 格式。每条规则声明：在什么条件下（`when`），Agent 应该被拦截、纠正或暂停（`then`）。

```yaml
# rules/my-enterprise.erdl.yaml
# 禁止未经审批访问生产数据库
name: require-approval-for-prod-db
version: 1
category: security
severity: high
ring: 0                        # 0=立即拦截, 1=拦截+纠正, 2=警告, 3=被动
priority: 500                  # 越小越优先评估
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: contains
      value: "PRODUCTION_DATABASE"
  conditionLogic: AND
then:
  decision: REQUEST_HUMAN
  instruction: "生产数据库访问需要经理审批。"
  alternative:
    en: "请使用测试数据库（STAGING_DATABASE）进行调试。"
  correction: "将连接字符串改为 STAGING_DATABASE 后重试。"
---
# 所有 exec 命令必须携带 command 参数
name: require-tool-args
version: 1
category: format
severity: low
ring: 1
priority: 200
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: not_exists
then:
  decision: DENY
  instruction: "缺少必要的参数：command。"
```

**可用运算符**（16 种）：`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `match`/`matches`, `starts_with`, `ends_with`, `exists`, `not_exists`, `length_gt`/`gte`/`lt`/`lte`/`eq`

**可用决策类型**：`ALLOW` 放行 | `DENY` 拦截 | `CORRECT` 自动纠正 | `QUARANTINE` 隔离审查 | `REQUEST_HUMAN` 人工审批 | `EMERGENCY_HALT` 紧急停摆

**执行环（Execution Rings）**：
| 环 | 含义 | 典型用途 |
|:---:|------|------|
| 0 | 立即拦截（致命级） | 删除生产表、凭证泄漏 |
| 1 | 拦截并给出纠正建议（高危） | 参数缺失、超大数据写入 |
| 2 | 告警后继续（中危） | 非标端口、已弃用 API |
| 3 | 被动记录（低危） | 只读 allowlist、审计日志 |

---

### 二、培训 —— 将规则编译到引擎

加载 YAML 规则，编译成 Guard 引擎直接消费的数据结构：

```typescript
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
} from '@rulsynor/core';

// 加载内置 28 条规则 + 你的自定义规则
const presetRules = loadPresetRules();           // PresetRule[]
const rules = toCompiledRules(presetRules);       // CompiledRule[]

const evaluator = new Evaluator(new GuardStateManager());
```

**加载自定义 YAML 规则**：将 `.erdl.yaml` 文件放在项目目录中，使用 RuleCompilerImpl：

```typescript
// 编译自定义规则（需直接导入 engine 子路径）
const { RuleCompilerImpl } = await import('@rulsynor/core/engine');
const compiler = new RuleCompilerImpl();
const compiled = compiler.compile(readFileSync('rules/my-enterprise.erdl.yaml', 'utf8'));

// 与预设规则合并
const allRules = [...toCompiledRules(loadPresetRules()), ...compiled.rules];
```

**规则编译时的质量门禁**：
- 缺少必填字段（`name`、`when`、`then`）→ 编译错误
- 使用了未知 operator 或非法决策 → 编译错误
- match/matches 模式存在 ReDoS 风险（嵌套量词）→ 拒绝编译
- `eq`/`contains` 条件中 value 未定义 → 编译警告

---

### 三、考核发证 —— Agent 身份标识（AID）

每个员工都有工号和工牌，每个 Agent 都应该有 AID——一个进入决策对象审计哈希的加密身份。

```typescript
import { generateAID } from '@rulsynor/core';

// 默认生成（OID 前缀 1.2.156.3088）
const aid = generateAID();
// → "1.2.156.3088.1.000001.000001.a3f8c120"

// 通过环境变量自定义：
//   RULSYNOR_AID_REGISTRAR=000042   — 企业注册码
//   RULSYNOR_AID_REQUESTER=000003   — 部门/团队码
//   PID 由主机名 + 进程 ID 哈希自动生成
```

**AID 结构**：`{OID_PREFIX}.1.{REGISTRAR}.{REQUESTER}.{INSTANCE_HASH}`

AID 会被嵌入到 `record.agent.aid` 字段中，并参与 JCS+SHA-256 审计哈希计算——篡改即被发现。

---

### 四、上岗 —— 在工具调用点守护

将 Guard 插入到 Agent 工具执行边界中。这是 LangChain、OpenAI function calling、MCP Server、自定义 ReAct 循环的通用集成点：

```typescript
// 在你的 Agent 工具执行循环中：
function guardedToolExecutor(toolName: string, toolArgs: Record<string, unknown>) {
  const ctx = {
    toolName,
    toolArgs,
    sessionId: currentSessionId,
    agentId: 'agent-finance-01',  // 上岗时指定
  };

  // 执行前评估
  const result = evaluator.evaluate(ctx, rules);

  switch (result.decision) {
    case 'DENY':
    case 'EMERGENCY_HALT':
      throw new Error(`Guard 拦截 ${toolName}: ${result.reason}`);

    case 'REQUEST_HUMAN':
      return requestHumanApproval(result.reason);

    case 'CORRECT':
      // 自动纠正后重试（最多 3 轮）
      const corrected = applyCorrection(toolName, toolArgs, result);
      return executeTool(corrected);

    case 'ALLOW':
      return executeTool(toolName, toolArgs);

    case 'QUARANTINE':
      // 隔离环境执行，留待审查
      return sandboxExecute(toolName, toolArgs);
  }
}
```

**LangChain 集成**：

```typescript
import { AgentExecutor } from 'langchain';

const guardedTools = tools.map(tool => ({
  ...tool,
  call: async (args: any) => {
    const result = evaluator.evaluate(
      { toolName: tool.name, toolArgs: args, sessionId, agentId },
      rules,
    );
    if (result.decision === 'DENY') throw new Error(result.reason);
    return tool.call(args);
  },
}));

const executor = new AgentExecutor({ agent, tools: guardedTools });
```

**MCP Server 集成**：

```typescript
// MCP 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = evaluator.evaluate(
    { toolName: request.params.name, toolArgs: request.params.arguments, sessionId, agentId },
    rules,
  );
  if (result.decision !== 'ALLOW') {
    return { content: [{ type: 'text', text: `已拦截: ${result.reason}` }], isError: true };
  }
  // ... 执行工具
});
```

---

### 五、审计留证 —— 每笔操作加密记录

每次评估生成一个 **25 字段决策对象**，经 JCS（RFC 8785）规范化 + SHA-256 哈希。记录不可篡改，第三方可零依赖独立验证：

```typescript
const record = buildDecisionObject({
  input: {
    runId: crypto.randomUUID(),
    step: 0,
    toolName: 'exec',
    toolArgs: { command: 'cat /etc/shadow' },
    context: {},
    agentId: 'agent-finance-01',
    sessionId: 'session-abc123',
    previousAuditHash: null,  // 链位置：设为上一条 DO 的哈希
  },
  decision: result.decision,
  actionTaken: 'blocked',
  reason: result.reason,
  matchedRules: [{ ruleId: result.matchedRuleId!, decision: result.decision, reason: result.reason }],
  totalEvaluated: rules.length,
  totalMatched: 1,
  rules: rules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: Math.round(performance.now() - evalStart),
});

console.log(record.audit.hash);
// → "sha256:a1b2c3d4e5f6..."  — 不可篡改
```

**审计哈希链**：

```typescript
// 通过传入前一条哈希，将决策对象串成链：
const do2 = buildDecisionObject({
  input: { ..., previousAuditHash: record1.audit.hash },
  ...
});
// do2.audit.previous_hash === do1.audit.hash  → 链验证通过

// 第三方独立验证（无需 SDK，只需 JCS+SHA-256）：
// 1. 获取 DO JSON。删除 audit.hash、signature、signing_key_id。
// 2. 按 RFC 8785 JCS 规范排序。
// 3. SHA-256 哈希。前缀 "sha256:"。
// 4. 与 audit.hash 比较。匹配 = 无人篡改。
```

**独立验证工具**（`@openoba/audit-verify`）：

```bash
npx @openoba/audit-verify decision-object.json
# ✅ 审计哈希匹配 — 记录真实有效
```

---

### 六、合规对标 —— 辖区感知字段激活

Decision Object 会根据辖区自动激活合规字段。一次配置，处处生效：

```bash
# 配置辖区
export RULSYNOR_JURISDICTIONS="CN,EU"
export RULSYNOR_INDUSTRY="financial-services"
export RULSYNOR_RISK_LEVEL="high"
```

```typescript
import { getComplianceProfile } from '@rulsynor/core/compliance';

const profile = getComplianceProfile();
// {
//   jurisdictions: ['CN', 'EU'],
//   activated_fields: ['agent.aid', 'model_id', 'confidence_score', 'signature', ...],
//   regulatory_references: [
//     { framework: 'EU-AI-Act', version: 'Regulation-2024-1689', jurisdiction: 'EU' },
//     { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
//   ]
// }
```

**支持的监管框架**：EU AI Act、GB/Z 185-2026（中国）、NIST AI RMF（美国）、COSO GenAI（通用）

`activated_fields` 数组决定哪些字段进入决策对象和审计哈希。合规不是你嘴上说说的"我们合规"——它是加密执行的。

---

### 七、证据保存 —— 不可篡改的审计链

每个 Decision Object 包含：

| 字段 | 用途 |
|------|------|
| `audit.hash` | JCS 规范化后 SHA-256 哈希 |
| `audit.previous_hash` | 上一条 DO 的哈希——形成不可断裂的链 |
| `audit.commitment` | `时间戳|AgentID|工具名|决策`——人工可读锚点 |
| `execution_trace_id` | UUID——串联同一个任务/session 的所有 DO |
| `decision_id` | UUID——每次评估唯一 |

**存储方式**：

```typescript
// 1. JSONL 文件（追加写入）
fs.appendFileSync('audit.jsonl', JSON.stringify(record) + '\n');

// 2. 数据库（任意 SQL/noSQL）
await db.decisionObjects.insert(record);

// 3. 对象存储（S3/GCS）——按 decision_id 命名
await s3.putObject({ Key: `audit/${record.decision_id}.json`, Body: JSON.stringify(record) });
```

**链验证**：从任意一条 DO 沿 `audit.previous_hash` 回溯到链头。断裂 = 被篡改。

---

### 八、扩展 —— 自定义 fn() 运算符

内置 16 种运算符之外，可注册自定义函数处理复杂条件：

```typescript
import { ERDLFnRegistry } from '@rulsynor/core/engine';

const registry = new ERDLFnRegistry();

// 注册自定义函数
registry.register('isBusinessHours', (args: unknown[]) => {
  const timezone = (args[0] as string) || 'Asia/Shanghai';
  const hour = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
  const h = parseInt(hour);
  return h >= 9 && h < 18;
}, { timeoutMs: 100 });

// 在规则中使用：
// when:
//   conditions:
//     - field: "toolName"
//       operator: eq
//       value: "exec"
//     - fn: "isBusinessHours"
//       args: ["Asia/Shanghai"]
```

---

## 架构图

```
┌─────────────────────────────────────────┐
│         你的 Agent (LangChain/MCP/自定义) │
│                                         │
│  LLM 生成了 tool_call                   │
│         │                               │
│         ▼                               │
│  ┌──────────────────┐                   │
│  │   RULSYNOR GUARD  │  ← 本包          │
│  │                  │                   │
│  │  Evaluator       │  环 0-3 规则     │
│  │  SafeExprEngine  │  16 种运算符     │
│  │  RuleCompiler    │  ERDL YAML → AST │
│  │  StateManager    │  within/rate     │
│  │  Compliance      │  4×4 辖区合规    │
│  │  Guidance        │  CORRECT + 替代  │
│  └────────┬─────────┘                   │
│           │                             │
│           ▼                             │
│  ┌──────────────────┐                   │
│  │  DECISION OBJECT  │  25 字段         │
│  │  JCS + SHA-256    │  不可篡改        │
│  └──────────────────┘                   │
│         │                               │
│         ▼                               │
│  执行 或 拦截                           │
└─────────────────────────────────────────┘
```

---

## API 参考

### 核心导出（`@rulsynor/core`）

| 导出 | 类型 | 说明 |
|------|------|------|
| `Evaluator` | class | 规则评估引擎（first-match-wins, Ring+Priority 排序） |
| `GuardStateManager` | class | `within`/`rate` 运算符有状态计数器管理 |
| `buildDecisionObject(opts)` | function | 构建 25 字段 JCS+SHA-256 决策对象 |
| `generateAID()` | function | 生成 Agent 身份标识码 |
| `loadPresetRules()` | function | 加载 28 条内置 ERDL YAML 规则 |
| `toCompiledRules(rules)` | function | 将预设规则转换为 `CompiledRule[]` |
| `toERDLRuleSet(rules)` | function | 将预设规则转换为 ERDLRuleSet 格式 |
| `PROVENANCE` | const | 版本、厂商、OID 前缀、已知限制 |

### 子路径导出

| 路径 | 内容 |
|------|------|
| `@rulsynor/core/engine` | Evaluator, SafeExprEvaluator, RuleCompilerImpl, ERDLFnRegistry, GuardStateManager, 类型定义 |
| `@rulsynor/core/guard` | buildDecisionObject, generateAID, DecisionObject 类型 |
| `@rulsynor/core/compliance` | getComplianceProfile, ComplianceProfile 类型 |
| `@rulsynor/core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet |
| `@rulsynor/core/guidance` | extractNavigationGuide, CORRECT 纠正循环处理 |
| `@rulsynor/core/runtime` | runReActLoop, createToolExecutor, RuntimeOptions |
| `@rulsynor/core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object 字段参考（25 字段）

```
spec                     — "decision-object-v1.0"
decision_id              — UUID
compliance_profile       — 辖区感知激活字段 + 监管引用
execution_trace_id       — UUID（跨步关联）
timestamp                — ISO 8601
evaluation_duration_ms   — 实际测量延迟
agent.id                 — 你的 Agent 标识
agent.role               — guardian | operator | observed
agent.version            — @rulsynor/core 版本号
agent.aid                — Agent 身份标识码（OID 格式）
agent.algorithm_filing_no — CAC 算法备案状态
agent.model_registration_id — CAC 模型上线备案状态
agent.known_limitations  — 已声明能力边界
agent.tool_registry_hash — 注册工具集 SHA-256
model_id                 — LLM 模型标识
context                  — { tool.name, tool.args }
context_snapshot_hash    — 评估时上下文的 SHA-256
rule_set_version         — 规则集 { id, timestamp }
policies                 — [{ id, name, version, hash }] 每条规则
evaluation               — { total_evaluated, total_matched, matched_rules }
result                   — { decision, decision_type, reason, rules_matched }
human_oversight          — 布尔值（是否触发 REQUEST_HUMAN/ESCALATE）
audit.hash               — SHA-256 JCS 哈希（不可变）
audit.previous_hash      — 上一条 DO 哈希（链位置）
audit.commitment         — timestamp|agentId|toolName|decision
```

---

## 环境变量

| 变量 | 用途 | 默认值 |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | 合规辖区（逗号分隔） | `CN` |
| `RULSYNOR_INDUSTRY` | 合规行业 | `financial-services` |
| `RULSYNOR_RISK_LEVEL` | 合规风险等级 | `high` |
| `RULSYNOR_AUTONOMY_LEVEL` | Agent 自主权等级（L1-L5） | `L2` |
| `RULSYNOR_MODEL_ID` | 决策对象中记录的 LLM 模型 ID | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | 企业注册码（AID 中） | `000001` |
| `RULSYNOR_AID_REQUESTER` | 部门/团队码（AID 中） | `000001` |

---

## 许可证

MIT © 2026-present OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

> "大模型厂商交付超群智商，我们交付恪守职业精神的数字员工。"

---

[OpenOBA](https://openoba.com) — 企业 AI 数字执行官平台
