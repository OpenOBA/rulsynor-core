# @rulsynor/core

> **开源确定性 Guard 引擎，为 AI Agent 而生。**
>
> Rulsynor 是 [OpenOBA](https://openoba.com) 平台的开源核心。它为你的 AI Agent 提供**确定性安全层**——每次工具调用在执行前被拦截、按 ERDL 规则评估、并生成加密可验证的审计记录。

```bash
npm install @rulsynor/core
```

## 快速开始

```typescript
import { Evaluator, GuardStateManager, buildDecisionObject } from '@rulsynor/core';

// 1. 创建 Guard 引擎
const evaluator = new Evaluator(new GuardStateManager());

// 2. 评估工具调用
const result = evaluator.evaluate(rules, {
  toolName: 'exec',
  toolArgs: { command: 'rm -rf /' },
  sessionId: 'session-1',
  agentId: 'my-agent',
});

// 3. 生成加密审计记录
const do1 = buildDecisionObject({
  input: { runId: 'r1', step: 0, toolName: 'exec', toolArgs: { command: 'rm -rf /' },
           context: {}, agentId: 'my-agent', sessionId: 's1' },
  decision: result.decision,
  actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: result.reason ?? null,
  matchedRules: result.matchedRuleId ? [{ ruleId: result.matchedRuleId, decision: result.decision }] : [],
  totalEvaluated: 1, totalMatched: result.matchedRuleId ? 1 : 0,
  rules: [],
  evaluationDurationMs: 15,
});

console.log('决策:', result.decision);                    // → 'DENY'
console.log('审计哈希:', do1.audit.hash);                  // → 'sha256:a1b2c3...'
console.log('Agent AID:', do1.agent.aid);                 // → '1.2.156.3088.1.000001.000001.abcdef01'
console.log('辖区:', do1.compliance_profile.jurisdictions); // → ['CN']
```

**就这些。** 30 秒内生成你第一条加密可验证的 Guard 评估记录。

### 终端体验

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
# 🛑 Decision: DENY
# 📝 Reason: Destructive command blocked.
# 🔐 audit.hash: sha256:...
```

## 核心能力

| 能力 | 说明 |
|------|------|
| **确定性 Guard** | 工具调用在**执行前**被拦截——不是在 LLM prompt 里约束。由 SafeExpr 安全表达式引擎评估规则，不是 LLM 说了算。 |
| **Decision Object（决策对象）** | 每次 Guard 评估生成 25 字段、[JCS (RFC 8785)](https://datatracker.ietf.org/doc/rfc8785/) + SHA-256 哈希的审计记录。防篡改、跨实现可验证。 |
| **内置安全规则** | 32 条预设安全规则即刻生效：危险命令拦截、系统路径写保护、SSRF 防护、SQL 注入检测、fork bomb 防御、权限提升拦截等。 |
| **法规合规矩阵** | 4 法规 × 4 辖区（EU AI Act / GB/Z 185 / NIST AI RMF / COSO GenAI × CN/EU/US/SG），按环境变量自动激活合规字段。 |
| **GB/Z 185 AID** | 符合中国《人工智能 智能体互联互通》标准的 Agent 身份码（OID 前缀 `1.2.156.3088`）。 |
| **零框架依赖** | 核心引擎零 NestJS/框架依赖。仅依赖 `json-canonicalize` + `js-yaml`。可在任何 Node.js 项目中使用。 |
| **Navigation Guide（导航指引）** | DENY 不只是一句"不行"——还告诉 LLM **为什么被拦、怎么改正、有什么替代方案**（`extractNavigationGuide()`）。 |
| **跨实现可验证** | 任何第三方可用纯 JCS+SHA-256 独立验证决策对象。`@openoba/audit-verify` CLI 提供零依赖参考实现。 |

## API 参考

### 引擎

#### `Evaluator`
```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';
const evaluator = new Evaluator(new GuardStateManager());
const result = evaluator.evaluate(rules, evalContext);
// → { decision: 'DENY', reason: '...', matchedRuleId: '...', ... }
```

评估顺序：Ring 0 最先（安全底线），Ring 3 最后（默认策略）。按 Ring + Priority 排序，首条匹配生效（first-match-wins）。无匹配规则 → ALLOW（默认放行）。

#### `SafeExprEvaluator`
```typescript
import { SafeExprEvaluator } from '@rulsynor/core';
const expr = new SafeExprEvaluator();
expr.evaluate(condition, context); // → boolean
```
安全表达式引擎——无 `eval()`，无代码注入风险。纯递归下降解析器，16 种白名单运算符。

#### `RuleCompilerImpl`
```typescript
import { RuleCompilerImpl } from '@rulsynor/core';
const compiler = new RuleCompilerImpl();
const compiled = compiler.compile(ruleSet); // → CompiledRuleSet（四产物）
```
ERDL YAML 规则 → 四种并行编译产物：ComplianceSchema、GuidanceArtifact、GuardDirective、AuditTemplate。

### 决策对象（Decision Object）

#### `buildDecisionObject(opts)`
```typescript
import { buildDecisionObject } from '@rulsynor/core';

const do1 = buildDecisionObject({
  input: { runId, step, toolName, toolArgs, context, agentId, sessionId, previousAuditHash? },
  decision: 'ALLOW' | 'DENY' | 'REQUEST_HUMAN' | 'ESCALATE' | 'CORRECT' | 'QUARANTINE' | 'EMERGENCY_HALT',
  actionTaken: 'allowed' | 'blocked' | 'paused' | 'halted' | 'quarantined' | 'escalated',
  reason: string | null,
  matchedRules: Array<{ ruleId: string; decision: string; ring?: number; reason?: string }>,
  totalEvaluated: number, totalMatched: number,
  rules: Array<{ name: string; version?: number }>,
  evaluationDurationMs: number,
  modelId?: string,
});
```
返回 25 字段 Decision Object。`audit.hash` = `SHA-256(JCS(除 audit.hash、signature、signing_key_id 之外的全部字段))`。

### 合规

#### `getComplianceProfile()`
```typescript
import { getComplianceProfile } from '@rulsynor/core';
const cp = getComplianceProfile();
// → { profile_id, jurisdictions, activated_fields, regulatory_references, ... }
```
读取 `RULSYNOR_JURISDICTIONS` 环境变量（默认 `CN`）。返回辖区内激活字段 + 法规引用。

### AID（Agent 身份码）

#### `generateAID()`
```typescript
import { generateAID } from '@rulsynor/core';
const aid = generateAID(); // → '1.2.156.3088.1.000001.000001.abcdef01'
```
GB/Z 185 Part 2 合规。OID 前缀 `1.2.156.3088`。

### Provenance（产品溯源）

```typescript
import { PROVENANCE } from '@rulsynor/core';
console.log(PROVENANCE.product);  // → 'Rulsynor Agent Engine'
console.log(PROVENANCE.license);  // → 'MIT'
```

### 规则加载

```typescript
import { loadPresetRules, toERDLRuleSet } from '@rulsynor/core';
const presetRules = loadPresetRules();    // 加载内置 .erdl.yaml 规则文件（32 条）
const ruleSet = toERDLRuleSet(presetRules); // 转换为 RuleCompiler 兼容格式
```

### Navigation Guide（导航指引）

```typescript
import { extractNavigationGuide } from '@rulsynor/core';
const guide = extractNavigationGuide({
  matchedRules: [{ ruleId: 'r1', decision: 'DENY', reason: 'Blocked' }],
  decision: 'DENY',
  reason: 'Blocked',
});
// → { blockedReasons: ['r1: Blocked'], corrections: [], alternatives: [] }
```

### CORRECT 循环

```typescript
import { advanceCorrectLoop, parseRequestHumanSignal } from '@rulsynor/core';
// 自动重试：3 轮 CORRECT → 升级人工
const result = advanceCorrectLoop(ctx, 'DENY');
// 检测 LLM 回复中的人工请求信号
const signal = parseRequestHumanSignal('请求人工审批：金额超限');
```

### Runtime（ReAct 运行时）

```typescript
import { runReActLoop, createToolExecutor } from '@rulsynor/core';
const result = await runReActLoop({
  llm: myLLMFunction,
  evaluator, rules, tools,
  userMessage: 'List files',
});
```

## Decision Object 结构（25 字段）

| # | 字段 | 类型 | 说明 |
|---|------|------|------|
| 1 | `spec` | `"decision-object-v1.0"` | 格式标识 |
| 2 | `decision_id` | UUID v7 | 唯一决策 ID |
| 3 | `compliance_profile` | object | 辖区合规配置 |
| 4 | `execution_trace_id` | UUID v7 | 全局追踪 ID |
| 5 | `timestamp` | ISO 8601 | 决策时间戳 |
| 6 | `evaluation_duration_ms` | integer | 评估耗时(ms) |
| 7 | `agent` | object (8 fields) | Agent 身份 + AID |
| 8-16 | (省略) | — | —
| 17 | `audit` | object (3 fields) | 防篡改审计 |
| 22 | `human_oversight` | boolean | 是否需人工介入 |
| 23 | `extensions` | array | 扩展区 |
| 24 | `signature` | string | ECDSA 签名(占位) |
| 25 | `signing_key_id` | string | 密钥标识 |

## 覆盖的法规

| 法规 | 辖区 | 激活字段 |
|------|:---:|------|
| EU AI Act (Regulation 2024/1689) | EU | `model_id`, `agent.known_limitations`, `confidence_score`, `fairness_assessment`, `impact_assessment_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| **GB/Z 185-2026** | **CN** | `agent.aid`, `agent.tool_registry_hash`, `agent.algorithm_filing_no`, `agent.model_registration_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| NIST AI RMF 1.0 | US | `model_id`, `confidence_score`, `fairness_assessment`, `impact_assessment_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| COSO GenAI 2026 | ALL | 全字段适用 |
| Singapore MGF | SG | `autonomy_level`, `confidence_score`, `data_modification_expected` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RULSYNOR_JURISDICTIONS` | `CN` | 辖区代码（逗号分隔：EU,CN,US,SG） |
| `RULSYNOR_INDUSTRY` | `financial-services` | 行业分类 |
| `RULSYNOR_RISK_LEVEL` | `high` | 风险等级（low/medium/high/critical） |
| `RULSYNOR_AUTONOMY_LEVEL` | `L2` | 自主等级（L0-L3） |

## 跨实现验证

`@rulsynor/core` 生成的每一条 Decision Object 都可以被 [ERDL Decision Object 向量集](https://github.com/OpenOBA/erdl-vectors)（101 条公共跨实现测试向量）独立验证。

验证公式：
```
audit.hash = SHA-256(JCS(25 字段 - audit.hash - signature - signing_key_id))
```

使用 `@openoba/audit-verify` 零依赖 CLI 即可独立验证，无需安装 Rulsynor。

[Concordia](https://github.com/OpenOBA/erdl-vectors)（Erik Newton）已使用洁净室 Python 实现独立验证了 ERDL Decision Object 格式——13/13 向量逐字节一致。

## 许可证

MIT © 2026 OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

---

[OpenOBA](https://openoba.com) — 企业 AI 数字执行官平台
