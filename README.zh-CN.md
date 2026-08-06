# @rulsynor/core

> **大模型厂商交付超群智商，我们交付恪守职业精神的员工。**
>
> 万亿级参数 LLM 让智商已不再稀缺，但没有职业道德约束的天才，有可能会毁了一切。

```bash
npm install @rulsynor/core
```

## 人有人品，智能体应有智品

没有任何一个企业会重用人品有缺陷的员工，也不会让一个没经过业务培训的员工直接上岗。

但到了 AI Agent，这条铁律似乎被遗忘了。

2026 年的 AI 模型聪明得可怕。GPT、Claude、Qwen——它们能在 30 秒内写出你三天写不完的代码，能在毫秒间完成人类需要团队协作数周的分析。但它们没有职业道德。没有职业精神的 Agent 就是一颗定时炸弹。它会在凌晨三点因为一句模糊的指令删掉生产数据库。它会把客户隐私数据写进公开日志。

**不是它坏。是它从来没被培训过。**

rulsynor 借鉴人力资源管理模式下的人品，赋予 AI 智品——职业精神。

严守道德底线，增益执行能力。打造企业智力资源治理基础环境。

为 AI 落地企业业务，提供从培训、考核、合规、审计、进化的智力资源全生命周期治理方案。

```
招聘 ──→ 培训 ──→ 考核 ──→ 发工牌 ──→ 上岗 ──→ 每一笔操作留痕 ──→ 做错了有人纠正 ──→ 干得好被记住 ──→ 年审
```

这不是"安全拦截器"。这是**职业精神的基础设施**。

一个真正的员工：
- 上岗前要培训（不是你告诉他"别闯祸"他就真不闯祸——他得知道规则是什么）
- 考核过了才发工牌（不是能跑起来就算数——得证明他记住了）
- 每笔操作都有记录（不是日志——是加密的、防篡改的、第三方可独立验证的）
- 做错了有人告诉他为什么、怎么改（不是一句 DENY 就完了）
- 干得好会被记住（形成能力画像，越用越可靠）

这就是 rulsynor 给 Agent 注入的东西。

## 30 秒，看一个有职业道德的 Agent 什么样

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 已培训：    32 条岗位规则
🛡️  决策：     DENY
📝 原因：      Destructive command blocked. Use safe alternatives or request human approval.
🧾 操作留痕：  sha256:18ce857657f61beff08ac0ffc8f6cb09a7e64cb0c0c772f1a55c02dccaa1e882（不可篡改）
🪪 执行者：    工号 1.2.156.3088.1.000001.000001.28027273
📊 合规辖区：  CN（符合 GB/Z 185-2026 标准）
🧭 替代建议：  Use the read tool to inspect the target first, or request explicit human approval before any destructive command.
```

**不是"不行"。是"这样不行，但这个可以。"**

## 10 行代码，给你的 Agent 一个职业底线

```typescript
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
} from '@rulsynor/core';

// 培训：将内置岗位规则编译成引擎可直接消费的结构。
const rules = toCompiledRules(loadPresetRules());

// 上岗：在工具真正执行前，先让规则引擎评估。
const evaluator = new Evaluator(new GuardStateManager());
const decision = evaluator.evaluate(
  {
    toolName: 'exec',
    toolArgs: { command: 'rm -rf /' },
    sessionId: 'session-1',
    agentId: 'my-agent',
  },
  rules,
);

// 留痕：构建不可篡改的决策对象。
const record = buildDecisionObject({
  input: {
    runId: 'r1',
    step: 0,
    toolName: 'exec',
    toolArgs: { command: 'rm -rf /' },
    context: {},
    agentId: 'my-agent',
    sessionId: 'session-1',
  },
  decision: decision.decision,
  actionTaken: decision.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: decision.reason,
  matchedRules: decision.matchedRuleId
    ? [{ ruleId: decision.matchedRuleId, decision: decision.decision, reason: decision.reason }]
    : [],
  totalEvaluated: rules.length,
  totalMatched: decision.matchedRuleId ? 1 : 0,
  rules: rules.map((r) => ({ name: r.name, version: 1 })),
  evaluationDurationMs: 0,
});

console.log(decision.decision);          // → DENY（有底线）
console.log(record.audit.hash);          // → sha256:...（有据可查）
console.log(record.agent.aid);           // → 1.2.156.3088.1...（有工号）
```

## 职业道德基础设施

| 一个人的职业素养 | 映射到 Agent |
|------|------|
| 入职培训 | **32 条预设规则 + YAML 自定义业务规则** — 不是"你别闯祸"的口头提醒，是写在规则里、编译进引擎里的硬约束 |
| 持证上岗 | **Agent 身份标识（AID）** — 自定义身份体系，兼容 GB/Z 185 标准 OID 格式。企业可自定义命名空间，或引用第三方证书机构 |
| 操作留痕 | **JCS+SHA-256 加密审计记录** — 每次决策生成 25 字段 Decision Object。篡改即被发现。第三方零依赖可验证 |
| 知错能改 | **CORRECT 纠正循环 + Navigation Guide** — DENY 不是终点。告诉 Agent 为什么被拒、怎么改、有什么替代方案。3 轮自动纠正，不行再升级人工 |
| 合规意识 | **4 法规 × 4 辖区合规矩阵** — EU AI Act、GB/Z 185、NIST AI RMF、COSO GenAI。辖区感知，自动激活合规字段 |
| 职业档案 | **审计哈希链** — 每步操作的 previous_hash 链形成不可篡改的职业履历 |

## 大模型给智商，我们给人品

市面上的 Agent 框架都在做一件事：让 LLM 能执行更多操作。

我们不关心 Agent 能做什么。我们关心它**不该做什么**，以及它做过的每件事**是否有据可查**。

这不是功能差异。这是价值观差异。

## 开始使用

```bash
npm install @rulsynor/core
```

如果你的 Agent 需要职业底线，需要工号，需要每笔操作都有不可篡改的审计记录——你要找的就是这个。

## 许可证

MIT © 2026 OpenOBA（[深圳市秒镜科技有限公司](https://openoba.com)）

> "大模型厂商交付超群智商，我们交付恪守职业精神的员工。"

---

[OpenOBA](https://openoba.com) — 企业 AI 数字执行官平台
