# @rulsynor/core

> **不是又一个 AI 工具。这是一个数字员工的上岗资格证明系统。**
>
> 安装 SDK → 加载岗位规则 → 编译考核 → 生成员工证(AID) → 持证上岗 → 每步操作加密留痕 → 被拒绝时获得导航指引 → 形成成长档案 → 定期年审。

```bash
npm install @rulsynor/core
```

## 这不是一个"Guard"

市面上的 AI Agent 框架都在做同一件事：让 LLM 能调用工具。LangChain、CrewAI、AutoGen——它们解决的是"Agent 怎么做事"。

**rulsynor 解决的是"谁有资格做事"。**

区别在于：

| | 传统 Agent 框架 | rulsynor |
|------|------|------|
| 定位 | LLM + 工具 = Agent | 培训 + 考核 + 发证 + 上岗 + 留痕 = 数字员工 |
| 安全 | Prompt 里写"请不要删库" | 确定性规则引擎，16 运算符，代码级拦截 |
| 信任 | "我们用的是 GPT-4" | 每条决策生成 JCS+SHA-256 加密审计记录，第三方独立可验证 |
| 合规 | 无 | GB/Z 185 员工证(AID) + EU AI Act / NIST / COSO 四法规 × 四辖区合规矩阵 |
| 成长 | 无 | 被拦截 ≠ 结束——CORRECT 自动纠正、Guidance 导航指引、历史记录形成能力画像 |

## 数字员工全生命周期

```
📋 招聘(install)   →  npm install @rulsynor/core
📚 培训(loadRules)  →  32 条预设安全规则 + 自定义业务规则
🔍 考核(compile)    →  RuleCompiler 四产物编译 + Golden Tests
🪪 发证(generateAID) →  GB/Z 185 标准 Agent 身份码
🛡️ 上岗(evaluate)   →  每次工具调用前确定性评估：ALLOW / DENY / CORRECT / QUARANTINE / EMERGENCY_HALT
🧾 留痕(buildDO)    →  25 字段 Decision Object，JCS+SHA-256 加密哈希，防篡改
🧭 成长(guidance)   →  CORRECT 自动纠正 3 轮 → 升级人工；Navigation Guide 告诉 LLM 为什么被拒 + 怎么改正
📊 年审(audit)      →  审计链验证 (previous_hash 链)，audit-verify CLI 零依赖独立验证
```

## 30 秒体验

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 培训完成：32 条规则已加载
🛡️ Decision: DENY
📝 原因: Destructive command blocked. Use safe alternatives or request human approval.
🧾 审计哈希: sha256:d72a...
🪪 员工证: 1.2.156.3088.1.000001.000001.7521ba66
📊 辖区: CN
🧭 导航: 建议使用 read 工具代替 exec
```

## 快速开始 — 10 行代码

```typescript
import { Evaluator, GuardStateManager, buildDecisionObject } from '@rulsynor/core';

// 1. 员工上岗
const evaluator = new Evaluator(new GuardStateManager());

// 2. 评估每一步操作
const result = evaluator.evaluate(rules, {
  toolName: 'exec',
  toolArgs: { command: 'rm -rf /' },
  sessionId: 'session-1',
  agentId: 'my-agent',
});

// 3. 加密留痕（防篡改审计记录）
const do1 = buildDecisionObject({
  input: { runId: 'r1', step: 0, toolName: 'exec', toolArgs: { command: 'rm -rf /' },
           context: {}, agentId: 'my-agent', sessionId: 's1' },
  decision: result.decision,
  actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: result.reason,
  matchedRules: [],
  totalEvaluated: 1, totalMatched: 0,
  rules: [], evaluationDurationMs: 5,
});

console.log(result.decision);        // → 'DENY'
console.log(do1.audit.hash);         // → 'sha256:a1b2c3...'（防篡改）
console.log(do1.agent.aid);          // → '1.2.156.3088.1...'（员工证）
```

## 核心能力

### 📚 培训 — 32 条预设规则 + 自定义业务规则

员工上岗前必须通过培训。rulsynor 预置 32 条安全规则覆盖：

- 危险命令拦截（rm -rf、fork bomb、chmod 777）
- SSRF 防护（内网 IP、metadata 端点）
- 系统路径写保护（/etc/、/sys/、Windows 系统目录）
- SQL 注入 + XSS 检测
- 权限提升拦截（sudo、base64 编码执行）
- 速率限制 + 大文件写入拦截
- GDPR 删除人工审批

用 YAML 写你自己的业务规则：

```yaml
name: large-transaction-approval
category: compliance
ring: 1
priority: 500
description: "超过¥5,000 的交易需要人工审批"
when:
  conditions:
    - field: "context.amount"
      operator: gt
      value: 5000
then:
  decision: REQUEST_HUMAN
  instruction: "金额超限，请财务经理审批"
```

### 🔍 考核 — RuleCompiler 四产物编译

每条规则经过编译器生成四种并行产物：
- **ComplianceSchema**：JSON Schema 约束（可映射部分 60-70%）
- **GuidanceArtifact**：System Prompt 注入的风险画像
- **GuardDirective**：确定性决策树
- **AuditTemplate**：审计字段映射

### 🪪 发证 — GB/Z 185 Agent 身份码

每个数字员工拥有符合中国《人工智能 智能体互联互通》标准的唯一身份码：
`1.2.156.3088.1.<注册机构>.<申请机构>.<8位身份标识>`

### 🛡️ 上岗 — 确定性评估引擎

不是 LLM prompt 约束。"请不要删除文件"不是安全边界。

16 种 SafeExpr 运算符（eq, ne, gt, gte, lt, lte, in, not_in, contains, match, exists, starts_with, ends_with, and, or, not），纯递归下降解析器，零代码注入风险。

评估顺序：Ring 0（安全底线）→ Ring 3（默认策略）。按 Ring + Priority 排序，首条匹配生效。无匹配 → ALLOW（默认放行）。

### 🧾 留痕 — 加密防篡改审计记录

每次决策生成 25 字段 Decision Object：

```
audit.hash = SHA-256(JCS(25字段 - audit.hash - signature - signing_key_id))
```

任何字段被篡改 → hash 变化 → 可追溯。使用 `@openoba/audit-verify` 零依赖 CLI 独立验证，无需安装 Rulsynor。

### 🧭 成长 — 被拦截 ≠ 结束

- **CORRECT 循环**：3 轮自动纠正 → 升级人工审批
- **Navigation Guide**：DENY 不只是"不行"，还告诉 LLM 为什么、怎么改正、有什么替代方案
- **历史档案**：每条 DO 的 `audit.previous_hash` 链形成不可篡改的职业生涯档案

## API 参考

### 培训与考核

```typescript
import { loadPresetRules, toERDLRuleSet, RuleCompilerImpl } from '@rulsynor/core';
const rules = loadPresetRules();          // 加载 32 条预设规则
const ruleSet = toERDLRuleSet(rules);     // 转换为编译器格式
const compiled = new RuleCompilerImpl().compile(ruleSet);
```

### 上岗评估

```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';
const evaluator = new Evaluator(new GuardStateManager());
const result = evaluator.evaluate(rules, context);
// → { decision: 'DENY', reason: '...', matchedRuleId: '...', ring: 0 }
```

### 加密留痕

```typescript
import { buildDecisionObject, generateAID } from '@rulsynor/core';
const do1 = buildDecisionObject({ /* opts */ });
// → 25-field Decision Object with audit.hash
const aid = generateAID();
// → '1.2.156.3088.1.000001.000001.abcdef01'
```

### 成长导航

```typescript
import { extractNavigationGuide, advanceCorrectLoop, parseRequestHumanSignal } from '@rulsynor/core';
const guide = extractNavigationGuide({ matchedRules, decision, reason });
// → { blockedReasons: [...], corrections: [...], alternatives: [...] }
```

### 合规矩阵

```typescript
import { getComplianceProfile } from '@rulsynor/core';
const cp = getComplianceProfile();  // 环境变量 RULSYNOR_JURISDICTIONS=CN
// → { jurisdictions: ['CN'], activated_fields: ['agent.aid', ...], ... }
```

## 跨实现验证

任何第三方可用纯 JCS+SHA-256 独立验证你的员工的每一条操作记录。

```bash
npx @openoba/audit-verify single decision.json
# ✅ Status: PASS | Claimed: sha256:... | Recomputed: sha256:... | Match: YES
```

[ERDL Decision Object 向量集](https://github.com/OpenOBA/erdl-vectors)（101 条跨实现测试向量）提供标准化验证基准。

## 数字员工 vs 传统 Agent

| | 传统 Agent | rulsynor 数字员工 |
|------|------|------|
| 招聘 | pip install langchain | **npm install @rulsynor/core** |
| 培训 | 无 | **32 条预设规则 + YAML 自定义** |
| 考核 | 无 | **RuleCompiler 四产物编译** |
| 工牌 | 无 | **GB/Z 185 AID** |
| 上岗 | LLM prompt 约束 | **确定性规则引擎（16 op）** |
| 操作记录 | 日志（可篡改） | **JCS+SHA-256 加密 DO（防篡改）** |
| 被拒后 | 静默失败 | **CORRECT 纠正 + Guidance 导航** |
| 合规 | 无 | **4 法规 × 4 辖区矩阵** |
| 年审 | 无 | **previous_hash 审计链** |
| 第三方验证 | 不透明 | **audit-verify CLI 零依赖验证** |

## 许可证

MIT © 2026 OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

> "大模型厂商交付超群智商，我们交付恪守职业精神的员工。"

---

[OpenOBA](https://openoba.com) — 企业 AI 数字执行官平台
