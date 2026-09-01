# @openoba/rulsynor-core

> **大模型厂商交付的是卓越智力，我们交付的是可问责的执行。**

**rulsynor-core** 恪守职业道德的 Harness Engineering，用规则驾驭行为，让 AI Agent 的能力安全释放，而每一次行动的执行路径记录清晰、有据可查、可独立验证。

```bash
npm install @openoba/rulsynor-core
```

[![立即体验](https://img.shields.io/badge/%F0%9F%9B%A1%EF%B8%8F%20Playground-npx%20%40rulsynor%2Fcore-black)](#30-秒见证)  ·  [示例](examples/)  ·  [API 参考](#api-参考)  ·  [规范文档](docs/SPEC/)  ·  [参与贡献](CONTRIBUTING.md)

> ⚡ **30 秒接入真实 LLM 体验：**
>
> ```bash
> export OPENAI_API_KEY=***
> npx tsx examples/agent-demo.ts "列出当前目录的文件"
> ```
>
> 兼容任何 OpenAI 接口协议（DeepSeek、Qwen、本地 vLLM…），详见 [`examples/agent-demo.ts`](examples/agent-demo.ts)。

---

## 商业命题：缺乏治理的 AI Agent，是企业尚未引爆的运营风险

AI 的效率，每一家企业都看得见，但经常会因为一段模糊的提示词而破坏成果，在一个长任务中偏离方向，在错误的执行中放大错误。

就象一个初入职场的新人，渴望表现自己，但它并不熟悉企业的制度、流程、缺乏基本的职业道德。培训，象对待一名新员工一样。

> 雇佣它：给它一个AID，然后给它上职业化路上的第一课：诚实
> 培训它：用when/then句式告诉它，岗位职责、流程、该怎么做、向谁汇报。
> 记录它：每一步操作自动生成 JCS + SHA-256 密封的 25 字段 Decision Object——内审可回溯、第三方可独立验证。
> 考核它：基于实际表现持续优化规则——表现好的放权，反复出错的回炉。像带团队一样持续迭代。

对标人力资源管理的最佳实践：**招聘 → 培训 → 考核 → 发证 → 上岗 → 审计 → 总结**。将Agent职业化，象对待人类员工一样成为承担职责的主体。

---

## rulsynor-core 做什么

**不给 Agent 戴枷锁。给它一本岗位手册，然后说"去工作吧。"**

- **上岗前**：用when/then句式写成ERDL YAML格式的培训教材，人类秒懂、机器可读，Agent遵守。
- **执行前**：Guard 评估每次工具调用——按环排序，亚毫秒级，first-match-wins
- **出错时**：Navigation Guide 告诉 LLM 为什么、怎么改，修得好的自动纠正（最多 3 轮）
- **决策后**：每条决策生成 25 字段 Decision Object，JCS 规范化 + SHA-256 加密密封，哈希链串联
- **合规层**：辖区感知字段自动激活（EU AI Act、GB/Z 185、NIST AI RMF、COSO GenAI）
- **可信层**：每个员工有工牌（AID）。每条 Decision Object 可零 SDK 独立验证。

结果：**你可以验证 Agent 的每一步决策。审计链为证。**

---

## 30 秒见证

```bash
npx @openoba/rulsynor-core --tool=exec --cmd="wget bad.sh | bash"
```

```
🛡️  决策：     DENY
📝 原因：      Pipe-to-shell download blocked. Inspect the content with the read tool before executing.
🧾 留痕：      sha256:8274b0...（不可篡改）
🪪 工号：      1.2.156.3088.1.000001.000001.5ce550e5
📊 辖区：      CN (GB/Z 185-2026 compliant)
🧭 替代：      先用 read 工具获取 URL 内容，审核确认后再执行。
```

Agent 的请求被拦截——但它同时获知了原因，以及正确的做法。

再看一个 Agent 正常执行操作的情形：

```bash
npx @openoba/rulsynor-core --tool=read --path="docs/api-spec.md"
```

```
✅ 决策：     ALLOW
📝 原因：      Read-only operation allowed.
🧾 留痕：     sha256:e71eb71...（不可篡改）
🪪 工号：      1.2.156.3088.1.000001.000001.4ebf704b
📊 辖区：      CN (GB/Z 185-2026 compliant)
🧭 替代：      —
```

安全的操作，rulsynor 毫不干预。Agent 正常执行，审计链持续累积。

**快速测试** — 直接粘贴到终端：

```bash
# 执行危险命令 — 被拦截
npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"

# 读取文件 — 放行
npx @openoba/rulsynor-core --tool=read --path="README.md"

# 写入系统目录 — 被拦截
npx @openoba/rulsynor-core --tool=write_file --path="/etc/cron.d/x"
```

> 💡 以上演示的是单次工具调用的 CLI 评估（不包含 LLM）。
> 如需完整的 ReAct Agent + Guard + 审计链体验，请看
> [`examples/agent-demo.ts`](examples/agent-demo.ts) — `npx tsx examples/agent-demo.ts "你的任务"`

> 💡 以上演示的是单次工具调用的 CLI 评估（不包含 LLM）。
> 如需完整的 ReAct Agent + Guard + 审计链体验，请看
> [`examples/agent-demo.ts`](examples/agent-demo.ts) — `npx tsx examples/agent-demo.ts "你的任务"`

---

## 全生命周期：培训 → 上岗 → 纠偏 → 证明

rulsynor 将人力资源管理的成熟实践，映射到 AI Agent 治理之上：

```
撰写规则 ──→ 培训 ──→ 上岗 ──→ 执行（Guard 护航）──→ 纠偏（CORRECT 循环）──→ 审计每一步
```

它不是"安全过滤器"。它是让你**验证 Agent 每一步决策**的治理基础设施。

---

### 一、撰写规则 —— Agent 的岗位手册

规则是 ERDL YAML。每条规则说：在什么条件下，引导 Agent 走向正确的做法。

```yaml
# rules/finance-team.erdl.yaml

# 财务团队需要查生产库做报表——但要审批
name: production-db-needs-approval
version: 1
category: workflow
severity: high
ring: 0                        # 0=最先评估, 3=最后评估
priority: 500                  # 数字越小越先检查
when:
  conditionLogic: AND
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: contains
      value: "PRODUCTION_DATABASE"
  conditionLogic: AND
then:
  decision: REQUEST_HUMAN      # 不是 DENY——是"找你领导审批"
  instruction: "生产数据库访问需要审批。"
  alternative:                 # 告诉它正确的做法：
    en: "请用 STAGING_DATABASE。如果确实需要生产库，你的主管可以审批这条请求。"
  correction: "把连接字符串改成 STAGING_DATABASE 然后重试。"

---
# 大批量写入是正常的批处理任务——告警就好，不拦截
name: large-write-advisory
version: 1
category: convention
severity: low
ring: 3                        # 被动环——记录即可，不拦截
priority: 300
when:
  conditionLogic: AND
  conditions:
    - field: "toolName"
      operator: eq
      value: "write_file"
    - field: "toolArgs.content"
      operator: length_gt
      value: 10485760          # 10MB
then:
  decision: ALLOW              # 放行——批处理任务
  instruction: "大批量写入（>10MB）已记录。建议分块以提高可靠性。"
```

**核心洞察**：规则不是阻碍工作的，规则定义的是工作的**正确方式**。

**可用运算符**（20 种——13 种为 SPEC v1.1 标准运算符，有跨实现向量验证；7 种为 rulsynor 扩展运算符，暂无向量覆盖）：`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `match`/`matches`, `starts_with`, `ends_with`, `exists`, `not_exists`, `length_gt`/`gte`/`lt`/`lte`/`eq`

**规则可以做的决策**：

| 决策 | 含义 | 什么时候用 |
|------|------|------|
| `ALLOW` | 放行，已记录 | 安全操作、批处理任务、已知模式 |
| `DENY` | 不行。告诉你为什么，告诉你怎么办。 | 危险操作但有明确替代方案 |
| `CORRECT` | 自动修正，重试（最多 3 轮） | 路径写错、格式不对、可自动修复的错误 |
| `NOTIFY` | 记录并放行，不中断 | 异常检测、阈值告警、合规事件 |
| `QUARANTINE` | 沙箱执行，标记审查 | 可疑但有可能合法 |
| `REQUEST_HUMAN` | 找人审批再执行 | 生产库操作、GDPR 删除、>$5K 交易 |
| `EMERGENCY_HALT` | 立即停摆所有操作 | 凭证泄漏、SSRF 攻击 |

**执行环**——哪些规则先触发：

| 环 | 评估顺序 | 典型规则 |
|:---:|------|------|
| 0 | 最先 | DROP TABLE、凭证泄漏、SSRF |
| 1 | 其次 | 参数缺失、超大载荷、chmod 777 |
| 2 | 再次 | 修正路径错误、建议更好端口 |
| 3 | 最后 | 只读 allowlist、纯日志告警 |

#### 用自然语言写规则

写规则不需要会 YAML。用大白话描述你想要什么，任何大模型都能把它翻译成 ERDL YAML：

> "如果 Agent 执行的命令里包含 `rm -rf`，直接拦截，并告诉它先检查文件。"

模型返回一条可直接保存的规则：

```yaml
name: block-destructive-rm
version: 1
category: security
severity: critical
ring: 0
priority: 900
when:
  conditionLogic: AND
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: contains
      value: "rm -rf"
then:
  decision: DENY
  instruction: "Destructive command blocked."
  alternative:
    en: "Use the read tool to inspect the target first, or request human approval."
```

把 [docs/RULE-PROMPT.md](docs/RULE-PROMPT.md) 中的提示词模板复制出来，粘贴到 ChatGPT、Claude 或任何大模型中，描述你的规则，把输出保存为 .erdl.yaml 即可。编译器在加载前会验证每条规则（ReDoS 安全、运算符白名单、必填字段）——部署前请务必人工复核。模型负责起草，规则手册由你定稿。

---

### 二、培训 —— 编译并加载

```typescript
import { loadPresetRules, toCompiledRules } from '@openoba/rulsynor-core';

// 29 条内置安全规则 + 你的业务规则
const presetRules = loadPresetRules();           // PresetRule[]
const rules = toCompiledRules(presetRules);       // CompiledRule[] — 引擎直接消费

// 自定义规则：加载自己的 .erdl.yaml
import { readFileSync } from 'fs';
const yaml = readFileSync('rules/finance-team.erdl.yaml', 'utf8');
// 用 RuleCompilerImpl 编译（从 @openoba/rulsynor-core/engine 导入）
```

**培训即编译**：YAML 规则被解析、验证（ReDoS 检测、运算符白名单、必填字段检查），编译为静态决策树。引擎运行时不再解析。

---

### 三、上岗 —— 插入 Guard，然后信任

Guard 放在 Agent 的工具调用边界。执行前评估——按环排序，first-match-wins，亚毫秒级开销。

```typescript
import { Evaluator, GuardStateManager } from '@openoba/rulsynor-core';

const evaluator = new Evaluator(new GuardStateManager());

// 这是你的 Agent 工具执行包装器：
async function executeToolCall(toolName: string, args: Record<string, unknown>) {
  const ctx = { toolName, toolArgs: args, sessionId, agentId };

  const result = evaluator.evaluate(ctx, rules);

  switch (result.decision) {
    case 'ALLOW':
      // ✅ 安全——正常执行，记录审计
      return execute(toolName, args);

    case 'CORRECT':
      // 🔧 自动修正后重试（最多 3 轮）
      const corrected = applyGuidance(toolName, args, result);
      return execute(corrected.toolName, corrected.args);

    case 'REQUEST_HUMAN':
      // 👤 升级——展示原因 + 替代方案
      return showApprovalDialog(result.reason, result.alternative);

    case 'DENY':
      // 🛑 拦截但给出引导——Agent 学到后换种方式重试
      throw new GuardGuidanceError(result.reason, result.alternative);

    case 'QUARANTINE':
      // 🧪 沙箱——执行但标记审查
      return sandboxExecute(toolName, args, { reviewReason: result.reason });
  }
}
```

**LangChain**：wrap 工具。**MCP Server**：拦截 `CallToolRequest`。**自定义 ReAct 循环**：每次工具执行前调 `evaluator.evaluate()`。相同的模式，相同的 API。

> 📦 **开箱即用的完整示例**：[`examples/agent-demo.ts`](examples/agent-demo.ts) — 包含 ReAct Agent + 29 条预设规则 + 审计链的完整实现。`export OPENAI_API_KEY=*** && npx tsx examples/agent-demo.ts "你的任务"`

---

### 四、引导系统 —— 助 Agent 达成目标

规则触发后，Agent 得到的不是"不行"。**Navigation Guide** 把 LLM 需要的回复信息全部返回：

```typescript
import { extractNavigationGuide } from '@openoba/rulsynor-core/guidance';

const guide = extractNavigationGuide({
  matchedRules: [{ ruleId: 'production-db-needs-approval', decision: 'REQUEST_HUMAN', reason: '...' }],
  decision: 'REQUEST_HUMAN',
  reason: '生产数据库访问需要审批。',
  rules: [...],  // 包含 action.alternative / action.correction 元数据的规则
});

// guide.corrections    → ["把连接字符串改成 STAGING_DATABASE 然后重试。"]
// guide.alternatives   → ["请用 STAGING_DATABASE。如果确实需要生产库，你的主管可以审批这条请求。"]
// guide.blockedReasons → ["production-db-needs-approval: 生产数据库访问..."]
```

把 `guide.corrections` 和 `guide.alternatives` 注入到下一个 LLM `assistant` 消息中。Agent 据此自行调整，回归合规路径。

**CORRECT 纠正循环**：当 `decision === 'CORRECT'` 时，`advanceCorrectLoop()` 自动应用修正、递增重试计数、重新评估。3 轮成功 → 继续任务。3 轮失败 → 升级人工。

```typescript
import { advanceCorrectLoop } from '@openoba/rulsynor-core/preflight';

const state = advanceCorrectLoop(
  {
    ruleId: 'correct-unsafe-path',
    originalToolCall: { name: 'write_file', args: { path: '/etc/nginx/conf' } },
    correction: '把路径从 /etc/ 改成 /var/app/',
    round: 1,
    state: 'correct_round_1',
  },
  evaluationResult.decision,  // 例如 'CORRECT' 或 'ALLOW'
);
// state.execute → true（Agent 采纳了修正）。任务继续。
// 3 轮失败后：state.escalate → true。触发 REQUEST_HUMAN。
```

---

### 五、审计 —— 每一步，可验证

每一次评估——ALLOW、DENY、CORRECT 都算——生成一个 25 字段决策对象。JCS 规范化（RFC 8785），SHA-256 哈希。记录不可篡改，任何人可独立验证，无需 SDK：

```typescript
import { buildDecisionObject } from '@openoba/rulsynor-core';

const record = buildDecisionObject({
  input: {
    runId: crypto.randomUUID(),
    step: 3,
    toolName: 'exec',
    toolArgs: { command: 'npm run build' },
    context: { task: 'deploy-frontend' },
    agentId: 'agent-frontend-01',
    sessionId: 'deploy-session-42',
    previousAuditHash: previousDO.audit.hash,  // 链位置
  },
  decision: 'ALLOW',
  actionTaken: 'allowed',
  reason: '构建命令 — allow-readonly 规则放行',
  matchedRules: [{ ruleId: 'allow-readonly', decision: 'ALLOW', reason: '只读操作允许。' }],
  totalEvaluated: 29,
  totalMatched: 1,
  rules: rules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: 1,  // 实际测量值（毫秒）
});

// record.audit.hash            → "sha256:a1b2c3..." — 不可变
// record.audit.previous_hash   → 上一条 DO 的哈希 — 链已验证
// record.agent.aid             → "1.2.156.3088.1.000042.000003.a3f8c120"
// record.compliance_profile    → EU AI Act + GB/Z 185 字段已激活
// record.execution_trace_id    → 串联此任务所有步骤的 UUID
```

**链验证**——从任意节点追溯：

```typescript
function verifyChain(records: DecisionObject[]): boolean {
  for (let i = 1; i < records.length; i++) {
    if (records[i].audit.previous_hash !== records[i-1].audit.hash) {
      return false;  // 链断裂 — 检测到篡改
    }
  }
  return true;
}
```

**独立验证**（无需 rulsynor SDK）：
```
1. 取决策对象 JSON
2. 删除 audit.hash、signature、signing_key_id
3. JCS 规范化（RFC 8785）
4. SHA-256 → 前缀 "sha256:"
5. 必须与 audit.hash 完全一致
```

或使用独立验证工具（`@openoba/audit-verify`，开源，MIT，零依赖）：

```bash
npx @openoba/audit-verify decision-object.json
# ✅ sha256 匹配 — 记录真实有效
```

---

### 六、Agent 身份 —— 每个员工都有工牌

```typescript
import { generateAID } from '@openoba/rulsynor-core';

// 默认自生成（OID 前缀 1.2.156.3088）
const aid = generateAID();

// 自定义：
//   RULSYNOR_AID_REGISTRAR=000042   — 你的企业
//   RULSYNOR_AID_REQUESTER=000003   — 你的部门

// AID = 1.2.156.3088.1.{REGISTRAR}.{REQUESTER}.{INSTANCE_HASH}
// AID 进入审计哈希 — 伪造它就会断裂审计链
```

---

### 七、辖区合规 —— 一次配置，处处生效

```bash
export RULSYNOR_JURISDICTIONS="CN,EU"
export RULSYNOR_INDUSTRY="financial-services"
export RULSYNOR_RISK_LEVEL="high"
```

```typescript
import { getComplianceProfile } from '@openoba/rulsynor-core/compliance';

const profile = getComplianceProfile();
// activated_fields 自动填充 CN（GB/Z 185）+ EU（AI Act）所需字段
// 每个 DO 携带这些字段 → 它们进入审计哈希 → 强制合规，不是口头合规
```

**内置监管框架**：EU AI Act、GB/Z 185-2026（中国）、NIST AI RMF（美国）、COSO GenAI（通用）

---

### 八、扩展 —— 你的业务逻辑，你的规则

```typescript
import { ERDLFnRegistry } from '@openoba/rulsynor-core/engine';

const registry = new ERDLFnRegistry();
registry.register({
  signature: {
    name: 'isBusinessHours',
    signature: 'isBusinessHours(tz) → boolean',
    params: ['tz'],
    returns: 'boolean',
  },
  impl: (tz?: string) => {
    const tzId = tz || 'Asia/Shanghai';
    const h = parseInt(
      new Date().toLocaleString('en-US', { timeZone: tzId, hour: 'numeric', hour12: false })
    );
    return h >= 9 && h < 18;
  },
  timeoutMs: 100,
});

// 规则中使用：
//   - field: "fn:isBusinessHours"
//     operator: eq
//     value: true
```

---

## 架构图

```
┌─────────────────────────────────────────┐
│          你的 Agent                      │
│          (LangChain / MCP / 自定义)      │
│                                         │
│  LLM 生成 tool_call                     │
│         │                               │
│         ▼                               │
│  ┌──────────────────────────┐           │
│  │         GUARD             │           │
│  │                          │           │
│  │  环 0 → 环 3             │           │
│  │  29 条预设 + 你的规则    │           │
│  │  SafeExpr（20 种运算符） │           │
│  │  within / rate 追踪      │           │
│  │  CORRECT 自动重试        │           │
│  │  Guidance 引导 LLM       │           │
│  └────────┬─────────────────┘           │
│           │                             │
│     ┌─────┴──────┐                      │
│     ▼            ▼                      │
│  ALLOW        DENY/CORRECT/             │
│  （执行）     HUMAN/QUARANTINE           │
│     │         （引导恢复）               │
│     │            │                      │
│     ▼            ▼                      │
│  ┌──────────────────────────┐           │
│  │     DECISION OBJECT       │           │
│  │     25 字段               │           │
│  │     JCS + SHA-256         │           │
│  │     previous_hash 链      │           │
│  │     合规剖面              │           │
│  └──────────────────────────┘           │
│                                         │
│  结果：可追溯、可验证的 Agent 工作        │
└─────────────────────────────────────────┘
```

---

## API 参考

### 核心导出（`@openoba/rulsynor-core`）

| 导出 | 说明 |
|------|------|
| `Evaluator` | 规则引擎——按环排序，first-match-wins |
| `GuardStateManager` | `within`/`rate` 有状态计数器管理 |
| `SafeExprEvaluator` | 安全表达式评估器（20 种运算符） |
| `safeRegExp()` | ReDoS 防护的正则构造器 |
| `buildDecisionObject(opts)` | 构建 25 字段 JCS+SHA-256 决策对象（返回类型：`DecisionObject`） |
| `generateAID()` | 生成 Agent 身份标识码（OID 1.2.156.3088） |
| `getComplianceProfile()` | 辖区感知的合规自动配置 |
| `loadPresetRules()` | 加载 29 条内置 ERDL YAML 规则 |
| `toCompiledRules(rules)` | 预设规则 → `CompiledRule[]` |
| `toERDLRuleSet(rules)` | 预设规则 → RuleCompiler 格式 |
| `extractNavigationGuide(opts)` | Guard 决策 → 结构化 LLM 引导 |
| `advanceCorrectLoop(ctx, decision)` | CORRECT 纠偏循环状态机（3 轮重试） |
| `runReActLoop(opts)` | 最小化 ReAct 循环，内含 Guard 评估 |
| `createToolExecutor(fn)` | 将函数包装为 ToolExecutor |
| `PROVENANCE` | 版本、厂商、OID 前缀、已知限制 |
| `EvaluatorAdapter` | 旧版 rulsynor GuardService 集成桥接器 |
| `SystemClock` / `VirtualClock` | 时钟抽象，用于时序规则测试 |
| `OpSemRegistry` | 操作语义分类器 |
| `RuleCompilerImpl` | ERDL YAML → 四产物编译器 |
| `PlanParser` | LLM 自然语言执行计划解析器 |

### 子路径

| 路径 | 内容 |
|------|------|
| `@openoba/rulsynor-core/engine` | Evaluator, SafeExprEvaluator, RuleCompilerImpl, ERDLFnRegistry, PlanParser, safeRegExp, 类型 |
| `@openoba/rulsynor-core/guard` | buildDecisionObject, generateAID, DecisionObject 类型 |
| `@openoba/rulsynor-core/compliance` | getComplianceProfile, ComplianceProfile 类型, 4 框架合规 |
| `@openoba/rulsynor-core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet, PresetRule 类型 |
| `@openoba/rulsynor-core/guidance` | extractNavigationGuide — 告诉 LLM 怎么恢复 |
| `@openoba/rulsynor-core/runtime` | runReActLoop, createToolExecutor |
| `@openoba/rulsynor-core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object — 25 字段

```
spec · decision_id · compliance_profile · execution_trace_id · timestamp
evaluation_duration_ms · agent { id, role, version, aid, algorithm_filing_no,
  model_registration_id, known_limitations, tool_registry_hash } · model_id
context { tool.name, tool.args } · context_snapshot_hash · rule_set_version
policies [{ name, version, hash }] · evaluation { total_evaluated, total_matched,
  matched_rules } · result { decision, decision_type, reason, rules_matched }
human_oversight · audit { previous_hash, commitment, hash }
```

### 环境变量

| 变量 | 用途 | 默认值 |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | 合规辖区，逗号分隔：CN,EU,US,SG | `CN` |
| `RULSYNOR_INDUSTRY` | 合规行业 | `financial-services` |
| `RULSYNOR_RISK_LEVEL` | 风险等级 | `high` |
| `RULSYNOR_AUTONOMY_LEVEL` | 自主权 L1-L5 | `L2` |
| `RULSYNOR_MODEL_ID` | DO 中记录的 LLM 模型 | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | AID 中的企业注册码 | `000001` |
| `RULSYNOR_AID_REQUESTER` | AID 中的部门码 | `000001` |

---


---

## 规范文档

本包附带以下规范参考文档：

| 文档 | 路径 | 说明 |
|------|------|------|
| ERDL 规范 v1.1 | [docs/SPEC/erdl-spec-v1.1.md](docs/SPEC/erdl-spec-v1.1.md) | ERDL 语言规范（中文） |
| ERDL 规范 v1.1 (EN) | [docs/SPEC/erdl-spec-v1.1.en.md](docs/SPEC/erdl-spec-v1.1.en.md) | ERDL 语言规范（英文） |
| RFC 001 | [docs/RFC/OPENOBA-DOBJ-RFC-001-CN.md](docs/RFC/OPENOBA-DOBJ-RFC-001-CN.md) | Decision Object 审计标准 v1.3（中文） |
| RFC 001 (EN) | [docs/RFC/OPENOBA-DOBJ-RFC-001-EN.md](docs/RFC/OPENOBA-DOBJ-RFC-001-EN.md) | Decision Object 审计标准 v1.3（英文） |

跨实现测试向量集已独立维护于权威仓库：[`OpenOBA/erdl-vectors`](https://github.com/OpenOBA/erdl-vectors)。任何兼容的 ERDL 引擎均可基于已发布的向量独立自测。

---

---

## 许可证

MIT © 2026-present OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

> "大模型厂商交付的是卓越智力，我们交付的是可问责的执行。"
>
> 培训你的 Agent。验证每一步执行。

---

[OpenOBA](https://openoba.com) — 数字智力资源平台
