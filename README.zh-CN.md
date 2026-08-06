# @rulsynor/core

> **大模型厂商交付超群智商，我们交付恪守职业操守的数字员工。**
>
> 给 Agent 一本规则手册。放手让它干活。每一步都经得起审计。

```bash
npm install @rulsynor/core
```

---

## Agent 不需要被捆住手脚。它需要一本规则手册。

一个新人入职，企业不会直接扔给他 root 权限然后说"别闯祸"。他会接受培训，拿到岗位手册，知道什么能做、什么要请示、做错了怎么改。

然后——这才是关键——企业会放手让他干活。

当下的 Agent 框架全部跳过了培训这一步，直接把 LLM 接上无限制的工具权限。这不是自主，这是莽撞。

**rulsynor 不给 Agent 上手铐。它给 Agent 一本规则手册，然后说"去干活吧。"**

规则负责拦不该发生的。Guidance 系统告诉 Agent 怎么改、怎么走正道。审计链证明每一步决定都是对的。

---

## 30 秒，看看有规则手册的 Agent

```bash
npx @rulsynor/core --tool=exec --cmd="wget bad.sh | bash"
```

```
🛡️  决策：     DENY
📝 原因：      Pipe-to-shell download blocked. Inspect the content with the read tool before executing.
🧭 引导：      先用 read 工具获取 URL 内容，审核确认后再执行。
🧾 留痕：      sha256:18ce857...（不可篡改，25 字段决策对象）
🪪 工号：      1.2.156.3088.1.000001.000001.28027273
```

Agent 被拦了——但它知道了为什么，以及怎么做才对。

再看一个 Agent 正常干活的情况：

```bash
npx @rulsynor/core --tool=read --path="docs/api-spec.md"
```

```
✅ 决策：     ALLOW
🧾 留痕：     sha256:b2f1a93...（已记录，审计链正常增长）
```

安全的操作，rulsynor 完全不挡路。Agent 正常工作。审计链持续累积。

---

## 全生命周期：培训 → 干活 → 纠错 → 证明

rulsynor 将人力资源管理映射到 AI Agent 上：

```
撰写规则 ──→ 培训 ──→ 上岗 ──→ 干活（Guard 护航）──→ 纠错（CORRECT 循环）──→ 审计每一步
```

它不是"安全过滤器"。它是让你**信任 Agent 到胆敢把真实工作交给它**的治理基础设施。

---

### 一、撰写规则 —— Agent 的岗位手册

规则是 ERDL YAML。每条规则说：在什么条件下，引导 Agent 走向正确的做法。

```yaml
# rules/finance-team.erdl.yaml

# 财务团队需要查生产库做报表——但要审批
name: production-db-needs-approval
version: 1
category: business-logic
severity: high
ring: 0                        # 0=最先评估, 3=最后评估
priority: 500                  # 数字越小越先检查
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
  decision: REQUEST_HUMAN      # 不是 DENY——是"找你领导审批"
  instruction: "生产数据库访问需要审批。"
  alternative:                 # 告诉它正确的做法：
    en: "请用 STAGING_DATABASE。如果确实需要生产库，你的主管可以审批这条请求。"
  correction: "把连接字符串改成 STAGING_DATABASE 然后重试。"

---
# 大批量写入是正常的批处理任务——告警就好，不拦截
name: large-write-advisory
version: 1
category: resource-management
severity: low
ring: 3                        # 被动环——记录即可，不拦截
priority: 300
when:
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

**核心洞察**：规则不是拦工作的。规则定义工作**怎么做**。

**可用运算符**（16 种）：`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `match`/`matches`, `starts_with`, `ends_with`, `exists`, `not_exists`, `length_gt`/`gte`/`lt`/`lte`/`eq`

**规则可以做的决策**：

| 决策 | 含义 | 什么时候用 |
|------|------|------|
| `ALLOW` | 放行，已记录 | 安全操作、批处理任务、已知模式 |
| `DENY` | 不行。告诉你为什么，告诉你怎么办。 | 危险操作但有明确替代方案 |
| `CORRECT` | 自动修正，重试（最多 3 轮） | 路径写错、格式不对、可自动修复的错误 |
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

---

### 二、培训 —— 编译并加载

```typescript
import { loadPresetRules, toCompiledRules } from '@rulsynor/core';

// 28 条内置安全规则 + 你的业务规则
const presetRules = loadPresetRules();           // PresetRule[]
const rules = toCompiledRules(presetRules);       // CompiledRule[] — 引擎直接消费

// 自定义规则：加载自己的 .erdl.yaml
import { readFileSync } from 'fs';
const yaml = readFileSync('rules/finance-team.erdl.yaml', 'utf8');
// 用 RuleCompilerImpl 编译（从 @rulsynor/core/engine 导入）
```

**培训即编译**：YAML 规则被解析、验证（ReDoS 检测、运算符白名单、必填字段检查），编译为静态决策树。引擎运行时不再解析。

---

### 三、上岗 —— 插入 Guard，然后信任

Guard 放在 Agent 的工具调用边界。执行前评估——按环排序，first-match-wins，亚毫秒级开销。

```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';

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

---

### 四、引导系统 —— 帮 Agent 把事做成

规则触发后，Agent 得到的不是"不行"。**Navigation Guide** 把 LLM 需要的恢复信息全部返回：

```typescript
import { extractNavigationGuide } from '@rulsynor/core/guidance';

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

把 `guide.corrections` 和 `guide.alternatives` 注入到下一个 LLM `assistant` 消息中。Agent 自行调整，走上正道。

**CORRECT 纠正循环**：当 `decision === 'CORRECT'` 时，`advanceCorrectLoop()` 自动应用修正、递增重试计数、重新评估。3 轮成功 → 继续任务。3 轮失败 → 升级人工。

```typescript
import { advanceCorrectLoop } from '@rulsynor/core/preflight';

const state = advanceCorrectLoop({
  current: { round: 0, maxRounds: 3, lastCorrection: null },
  correction: '把路径从 /etc/ 改成 /var/app/',
  agentResponse: revisedToolCall,
});
// state.corrected → true, round → 1。用修正后的工具调用重试。
```

---

### 五、审计 —— 每一步，可证明

每一次评估——ALLOW、DENY、CORRECT 都算——生成一个 25 字段决策对象。JCS 规范化（RFC 8785），SHA-256 哈希。记录不可篡改，任何人可独立验证，无需 SDK：

```typescript
import { buildDecisionObject } from '@rulsynor/core';

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
  totalEvaluated: 28,
  totalMatched: 1,
  rules: rules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: 0.8,  // 实际测量值
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

或使用独立验证工具：

```bash
npx @openoba/audit-verify decision-object.json
# ✅ sha256 匹配 — 记录真实有效
```

---

### 六、Agent 身份 —— 每个员工都有工牌

```typescript
import { generateAID } from '@rulsynor/core';

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
import { getComplianceProfile } from '@rulsynor/core/compliance';

const profile = getComplianceProfile();
// activated_fields 自动填充 CN（GB/Z 185）+ EU（AI Act）所需字段
// 每个 DO 携带这些字段 → 它们进入审计哈希 → 强制合规，不是口头合规
```

**内置监管框架**：EU AI Act、GB/Z 185-2026（中国）、NIST AI RMF（美国）、COSO GenAI（通用）

---

### 八、扩展 —— 你的业务逻辑，你的规则

```typescript
import { ERDLFnRegistry } from '@rulsynor/core/engine';

const registry = new ERDLFnRegistry();
registry.register('isBusinessHours', (args: unknown[]) => {
  const tz = (args[0] as string) || 'Asia/Shanghai';
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
  return h >= 9 && h < 18;
}, { timeoutMs: 100 });

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
│  │  28 条预设 + 你的规则    │           │
│  │  SafeExpr（16 种运算符） │           │
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
│  结果：可信任、可证明的 Agent 工作        │
└─────────────────────────────────────────┘
```

---

## API 参考

### 核心导出（`@rulsynor/core`）

| 导出 | 说明 |
|------|------|
| `Evaluator` | 规则引擎——按环排序，first-match-wins |
| `GuardStateManager` | `within`/`rate` 有状态计数器管理 |
| `buildDecisionObject(opts)` | 构建 25 字段 JCS+SHA-256 决策对象 |
| `generateAID()` | 生成 Agent 身份标识码 |
| `loadPresetRules()` | 加载 28 条内置 ERDL YAML 规则 |
| `toCompiledRules(rules)` | 预设规则 → `CompiledRule[]` |
| `toERDLRuleSet(rules)` | 预设规则 → RuleCompiler 格式 |
| `PROVENANCE` | 版本、厂商、OID 前缀、已知限制 |

### 子路径

| 路径 | 内容 |
|------|------|
| `@rulsynor/core/engine` | Evaluator, SafeExprEvaluator, RuleCompilerImpl, ERDLFnRegistry, 类型 |
| `@rulsynor/core/guard` | buildDecisionObject, generateAID |
| `@rulsynor/core/compliance` | getComplianceProfile, 4 框架合规 |
| `@rulsynor/core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet |
| `@rulsynor/core/guidance` | extractNavigationGuide — 告诉 LLM 怎么恢复 |
| `@rulsynor/core/runtime` | runReActLoop, createToolExecutor |
| `@rulsynor/core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

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

## 许可证

MIT © 2026-present OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

> "大模型厂商交付超群智商，我们交付恪守职业操守的数字员工。"
>
> 培训你的 Agent。信任它干活。证明每一步都对。

---

[OpenOBA](https://openoba.com) — 企业 AI 数字执行官平台
