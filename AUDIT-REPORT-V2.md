# @rulsynor/core 上线前全量审计报告 V2（修复后复审）

> **审计对象**：`@rulsynor/core` v1.0.0
> **审计时间**：2026-08-07
> **审计性质**：第一轮审计（AUDIT-REPORT.md）后的修复复审 + 全量深度复检
> **审计结论**：**⚠️ 接近可发布，但仍有 1 项 P0 级回归和 4 项 P1 级新问题需修复**

---

## 一、执行摘要

### 验证基线

| 检查项 | 结果 |
|--------|:----:|
| `npx tsc --noEmit` | ✅ 0 错误 |
| `npm test` | ✅ 100 passed（5 suites，较首轮 76 增长 31%） |
| 实际预设规则数 | 29（新增 integrity.erdl.yaml） |

### 修复成果总览

| 类别 | 首轮发现 | 已修复 | 修复率 | 评价 |
|------|:------:|:------:|:------:|------|
| P0 阻断性 | 7 | **7** | **100%** ✅ | 全部修复，重大进步 |
| P1 重要 | 18 | 13 | 72% | 主体修复，7 项遗留 |
| P2 改进 | 10 | — | — | 未纳入本轮 scope |
| **新发现问题** | — | — | — | **1 项 P0 级回归 + 4 项 P1 + 5 项 P2** |

**积极评价**：P0 全部清除是硬核进步。新增 `safe-regex.ts` 模块设计干净，`commitTemporal` 读写分离思路正确，integrity 规则包把"职业化数字员工"概念落地为可执行规则——这些体现了对首轮反馈的深度理解。测试从 76 增至 100，新增 guard-state-manager 和 evaluator-adapter 两个测试套件，覆盖度显著提升。

**核心关切**：P0-05 修复引入了一个回归——`commitTemporal` 方法已实现但 `runtime.ts` 未调用它，导致 `within`/`rate` 时序规则在生产中**永不生效**。这不是设计缺陷，而是集成遗漏，修复成本极低（1 行代码），但必须修复才能发布。

---

## 二、P0 修复验证（7/7 全部通过）

| # | 首轮问题 | 修复方式 | 验证结果 |
|---|---------|---------|:------:|
| P0-01 | 正则注入+ReDoS | 新增 `safe-regex.ts`，3 处 `new RegExp` 全替换为 `safeRegExp()` | ✅ |
| P0-02 | Runtime 绕过 Guard | `runtime.ts:106` 传入 `opts.compiledRules`，新增 `compiledRules` 字段 | ✅ |
| P0-03 | VirtualClock 默认 | `guard-state-manager.ts:35` + `evaluator-adapter.ts:145` 改为 `new SystemClock()` | ✅ |
| P0-04 | ESM `__dirname` | 新增 `resolveRelative()` 用 `fileURLToPath(import.meta.url)`，2 处替换 | ✅ |
| P0-05 | Evaluator 副作用 | 重构为排序后遍历 + within/rate 只读查询 + `commitTemporal` 分离 | ✅* |
| P0-06 | 占位符合规声明 | `provenance.ts:55,61` 改为 `'NOT_FILED'`，knownLimitations 增补声明 | ✅ |
| P0-07 | AST 递归无深度限制 | `safe-expr.ts:14` `MAX_AST_DEPTH=50`，evalAnd/Or/Not 传递 depth | ✅ |

> *P0-05 设计修复正确，但集成层有回归——见下文 P0-N01。

---

## 三、新发现问题

### P0-N01 🔴 Runtime 未调用 commitTemporal —— within/rate 规则永不生效

**位置**：`src/runtime.ts:104-148`

**问题**：第一轮 P0-05 修复正确地将时序计数器从 evaluate（写）分离到 `commitTemporal`（调用方在 `actionTaken='allowed'` 后提交）。`evaluator.ts:254` 实现了 `commitTemporal` 方法。但 `runtime.ts` 在 ALLOW 分支执行工具后（第143行 `await executor.execute(tc.arguments)`），**未调用 `evaluator.commitTemporal()`**。

**后果**：`within`/`rate` 计数器永远不被递增 → `getWithinCount`/`getRateCount` 永远返回 0 → 时序规则永远不触发拦截。任何依赖速率限制或时间窗口的安全规则（如"60 秒内最多 10 次 exec"）在生产中完全失效。

**影响**：安全规则的时序维度形同虚设。这是 P0-05 修复引入的回归——原实现虽有副作用污染问题，但至少计数器能递增；现在读写分离了，却忘了在调用方提交写操作。

**修复方案**（1 行代码）：
```typescript
// runtime.ts 第 143-144 行之间插入
const toolResult = await executor.execute(tc.arguments);

// ↓ 新增：ALLOW 后提交时序计数器
evaluator.commitTemporal(ctx, opts.compiledRules);

onToolResult?.(toolResult, step);
```

**验证**：
```typescript
// 新增测试：验证 ALLOW 后 within 计数器递增
it('commits temporal counter after ALLOW', () => {
  const sm = new GuardStateManager(new VirtualClock(1000));
  const ev = new Evaluator(sm);
  const ctx = { toolName: 'exec', toolArgs: {}, sessionId: 's', agentId: 'a' };
  const rules = [{
    id: 'rate-limit', name: 'rate', priority: 100, ring: 1,
    decision: 'DENY', reason: 'rate exceeded',
    conditions: [{ field: 'toolName', operator: 'eq', value: 'exec' },
                 { field: 'toolName', operator: 'rate', value: 2, windowMs: 60000 }],
    conditionLogic: 'AND', enabled: true,
  }];
  // 第一次 ALLOW
  ev.evaluate(ctx, rules);
  ev.commitTemporal(ctx, rules);
  // 第二次 ALLOW
  ev.evaluate(ctx, rules);
  ev.commitTemporal(ctx, rules);
  // 第三次应 DENY（rate >= 2）
  const r3 = ev.evaluate(ctx, rules);
  expect(r3.decision).toBe('DENY');
});
```

---

### P1-N02 🟡 getRateCount 不检查窗口过期 —— rate 规则触发后永久误拦截

**位置**：`src/engine/guard-state-manager.ts:94-103`

**问题**：`getRateCount` 直接返回 `tracker.count`，不检查 `(now - tracker.windowStart)` 是否超过 `windowMs`。注释承认 "We can't know windowMs here"，但选择了返回旧 count。

**后果链**：
1. rate 规则触发 DENY（count >= limit）
2. 窗口过期后，`getRateCount` 仍返回旧 count
3. evaluator 的 `checkTemporalExceeded` 判定 count >= limit → 继续 DENY
4. DENY 不触发 `commitTemporal` → `recordRate` 不执行 → 窗口永不重置
5. **rate 规则永久误拦截，直到有 ALLOW 操作触发 recordRate 重置窗口**

**影响**：一旦 rate 规则触发，该工具的后续所有请求被永久拦截，即使窗口早已过期。

**修复方案**：`getRateCount` 需要接受 `windowMs` 参数以检查过期：
```typescript
// guard-state-manager.ts — 修改签名
getRateCount(key: string, windowMs: number = 60000): number {
  const tracker = this.rateTrackers.get(key);
  if (!tracker) return 0;
  const now = this.clock.now();
  if ((now - tracker.windowStart) > windowMs) {
    // 窗口已过期 — 返回 0（清理在下次 recordRate 时做）
    return 0;
  }
  return tracker.count;
}

// evaluator.ts checkTemporalExceeded — 传 windowMs
const count = this.stateManager.getRateCount(tKey, windowMs);
```

---

### P1-N03 🟡 Evaluator zero-condition 规则注释与代码不符

**位置**：`src/engine/evaluator.ts:107-111`
```typescript
// Rule with zero conditions → match-all (safety: require explicit ALLOW; deny by default for catch-all)
if (!rule.conditions || rule.conditions.length === 0) {
  totalMatched++;
  return this.buildResult(rule, totalEvaluated, totalMatched);
}
```

**问题**：注释说 "deny by default for catch-all"，但代码返回 `rule.decision`（可能是 ALLOW 也可能是 DENY）。如果一条 enabled 无条件规则的 decision=ALLOW，会直接放行所有请求；如果 decision=DENY，会拦截一切。注释与行为不符，误导维护者。

**修复方案**：修正注释，或实现真正的 fail-closed：
```typescript
// 方案 A：修正注释（保持当前行为）
// Rule with zero conditions → match-all. Returns the rule's own decision.
// WARNING: a zero-condition DENY rule will block everything; a zero-condition
// ALLOW rule will short-circuit to ALLOW. Use with care.

// 方案 B：fail-closed（更安全）
if (!rule.conditions || rule.conditions.length === 0) {
  // Zero-condition rules are dangerous — treat as no-op (skip) rather than match-all
  continue;
}
```

---

### P1-N04 🟡 Evaluator OR + temporal 组合语义可疑

**位置**：`src/engine/evaluator.ts:139-160`

**问题**：对于 `conditionLogic: 'OR'` 且同时含 stateless 和 temporal 条件的规则，当 stateless 匹配时（`statelessMatched=true`），`ruleMatched=true`，但随后进入 temporal 检查（第156-160行），如果 temporal 阈值未超，`continue` 跳过该规则。

按 OR 语义，stateless 匹配就应该触发规则。但当前实现是：只要有 temporal 条件，就必须 temporal 阈值超过才触发。这把 OR 退化成了类似 AND 的行为。

**影响**：边缘场景（实际规则极少把 stateless 和 temporal 用 OR 组合），但语义不符合预期。

**修复方案**：
```typescript
if (temporalConditions.length > 0) {
  // For OR logic: if stateless already matched, the rule fires regardless of temporal
  if (rule.conditionLogic === 'OR' && hasStateless && statelessMatched) {
    return this.buildResult(rule, totalEvaluated, totalMatched);
  }
  // For AND logic (or OR with only temporal): check threshold
  const temporalFired = this.checkTemporalExceeded(temporalConditions, rule, context);
  if (!temporalFired) continue;
  return temporalFired;
}
```

---

## 四、P1 遗留问题（首轮未修复，7 项）

| # | 问题 | 状态 | 评估 |
|---|------|:----:|------|
| P1-07 | `verifyEquivalence` symbolic 模式空实现，返回 `passed:true` | ❌ | 误导性仍在。建议改为 `throw new Error('symbolic mode not implemented')` 或返回 `{ passed: false, note: 'not implemented' }` |
| P1-10 | 缺 ESLint/Prettier/EditorConfig | ❌ | CONTRIBUTING 要求 strict/no-@ts-ignore 但无 lint 强制。已有 CI workflow，加一步 `npx eslint` 即可 |
| P1-11 | `as any` 大量残留（runtime:1, playground:3, rule-compiler:12 处） | ❌ | `buildDecisionObject` 仍返回 `Record<string, unknown>`，未定义强类型 `DecisionObject` interface。建议新增类型定义让调用方去除 `as any` |
| P1-13 | `toCoreContext` 平铺仅一层 | ❌ | 深层嵌套 context 丢失。低优先级（当前规则未用到深层嵌套） |
| P1-14 | `fn-registry.invoke` 超时未取消主 Promise + setTimeout 泄漏 | ❌ | `Promise.race` 超时后主 Promise 仍执行；且正常完成时 setTimeout 未 `clearTimeout`，每次 invoke 泄漏一个定时器 |
| P1-15 | `provenance.ts:48` knownLimitations 仍写 "English-language interface only" | ❌ | 与实际不符（有中文 README/注释/规则）。改为 "Bilingual (English + Chinese)" |
| P1-17 | experiments/ 含开发笔记 + .cjs 脚本 | ❌ | 新增了 `integrity.cjs`，问题扩大。建议转为 `test/` 下的集成测试 |
| P1-18 | overview.md / OPTIMIZATION_REPORT.md 残留 | ❌ | 开发产物未清理 |
| P1-22 | SECURITY.md 缺 PGP/Supported Versions/90天窗口 | ⚠️ | 已有 48h 响应承诺。补充 Supported Versions 表和 coordinated disclosure 窗口 |

### P1-14 详细修复方案（fn-registry 定时器泄漏）

```typescript
// fn-registry.ts invoke 方法重写
async invoke(name: string, ...args: unknown[]): Promise<unknown> {
  const reg = this.fns.get(name);
  if (!reg) throw new Error(`[ERDL FnRegistry] Function "${name}" is not registered`);

  const start = Date.now();
  const timeout = reg.timeoutMs || 5000;
  let timer: NodeJS.Timeout | undefined;

  try {
    const result = await Promise.race([
      Promise.resolve(reg.impl(...args)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Function "${name}" timed out after ${timeout}ms`)), timeout);
      }),
    ]);
    this.callLog.push({ fn: name, args, result, elapsedMs: Date.now() - start });
    if (this.callLog.length > 1000) this.callLog.splice(0, this.callLog.length - 1000);
    return result;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    this.callLog.push({ fn: name, args, result: undefined, error: err, elapsedMs: Date.now() - start });
    throw e;
  } finally {
    if (timer) clearTimeout(timer);  // ← 关键：无论成功/失败/超时都清理定时器
  }
}
```

---

## 五、P2 新发现

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| P2-N01 | package.json description 编码损坏 | `package.json:4` — `M-oM-?M-=?`（em-dash 乱码） | 改为 ASCII：`"ERDL deterministic Guard engine — open-source Agent runtime with cryptographic audit chain"` 用正确的 UTF-8 em-dash |
| P2-N02 | README 规则数 28 ≠ 实际 29 | `README.md:52,70`、`README.zh-CN.md:56,74` | 改为 29 |
| P2-N03 | SECURITY.md 测试数 67 ≠ 实际 100 | `SECURITY.md:62` | 改为 100 |
| P2-N04 | CHANGELOG 测试数 76 ≠ 实际 100 | `CHANGELOG.md:35` | 改为 100 |
| P2-N05 | README.zh-CN "大胆用" 表述回退 | `README.zh-CN.md:24` | 上一轮润色去除了"胆敢"，但新增的"大胆用"重新引入了类似口语化表述。建议改为"放心用、可靠用" |

---

## 六、首轮 P1 修复确认（13 项通过）

| # | 问题 | 修复验证 |
|---|------|:------:|
| P1-01 | 版本号不一致 | ✅ package.json `1.0.0` = provenance `1.0.0` = CHANGELOG `v1.0.0` |
| P1-02 | 规则数量不一致 | ⚠️ 部分（ROADMAP 29 ✅，但 README 仍说 28 → P2-N02） |
| P1-04 | Clock 接口双重定义 | ✅ types.ts 中 Clock/GuardStateManager 死代码已删 |
| P1-06 | GuardStateManager interface 死代码 | ✅ 同上 |
| P1-08 | verifyAgainstVectors 逻辑空洞 | ✅ 现在真正调用 `tree.traverse(context)` 比对 |
| P1-09 | .gitignore 排除 pnpm-lock.yaml | ✅ 已移除该行 |
| P1-12 | deepEquals 用 JSON.stringify | ✅ safe-expr.ts + runtime-evaluator.ts 均改为递归结构比较 |
| P1-16 | README.zh-CN 不在 files | ✅ package.json files 已含 README.zh-CN.md |
| P1-19 | test/*.bak 残留 | ✅ 已删除 |
| P1-20 | 缺社区标准文件 | ✅ CODE_OF_CONDUCT.md + ISSUE_TEMPLATE + PR_TEMPLATE + ci.yml |
| P1-21 | package.json 缺字段 | ✅ repository 改 object，新增 author/bugs/homepage，bin 只用 rulsynor |
| P1-23 | LICENSE 年份 | ✅ 改为 `2026-present` |
| P1-25 | runtime evaluationDurationMs 硬编码 | ✅ 改为 `performance.now()` 真实测量 |

---

## 七、发布就绪度评估

| 维度 | 就绪度 | 阻塞项 |
|------|:------:|--------|
| 类型安全 | ✅ 95% | tsc 0 错误，strict 模式通过 |
| 安全 | ⚠️ 90% | P0 全修，但 P0-N01 回归需修复 |
| 功能正确性 | ⚠️ 85% | within/rate 失效（P0-N01）、getRateCount 过期问题（P1-N02） |
| 测试覆盖 | ✅ 85% | 100 测试全绿，但缺 commitTemporal/ReDoS 回归测试 |
| 开源合规 | ✅ 90% | 社区文件齐全，版本一致，文档数量小偏差 |
| 代码风格 | ⚠️ 75% | as any 残留、缺 ESLint |

### 发布判定

**❌ 不建议立即发布**——P0-N01（commitTemporal 未调用）是 1 行代码的修复，但影响 within/rate 安全规则的正确性，必须修复。

### 最小发布路径（预计 2-3 小时）

| 步骤 | 问题 | 预估 | 必要性 |
|:----:|------|:----:|:------:|
| 1 | P0-N01 runtime 调用 commitTemporal | 0.5h | **必须** |
| 2 | P1-N02 getRateCount 检查窗口过期 | 1h | **必须** |
| 3 | P1-N03 evaluator 注释修正 | 0.2h | 建议 |
| 4 | P2-N01~N04 文档数量同步 | 0.5h | 建议 |
| 5 | 新增 commitTemporal 回归测试 | 1h | 建议 |

完成步骤 1-2 后即可发布。步骤 3-5 可在发布后 24h 内补齐。

---

## 八、肯定与鼓励

本轮修复展现了高质量的工程响应：

- **safe-regex.ts** 模块设计干净——`SafeRegExpError` 自定义错误类、长度+嵌套量词双重检测、try-catch 兜底，完全符合安全模块的设计标准
- **commitTemporal 读写分离**思路正确——把"评估时写"改为"决策后提交"，从架构层面消除了副作用污染，只是集成层漏了一步
- **integrity.erdl.yaml** 把"职业化数字员工"从营销概念落地为可执行规则（INT-C01 promise-readonly-writes），概念与代码统一
- **deepEquals 递归重写** 两处一致修改，消除了 JSON.stringify 的键顺序隐患
- **测试增长 76→100**，新增的 guard-state-manager 测试覆盖了 prune/freeze/snapshot 等关键路径

首轮 7 项 P0 全部清除，是硬核进步。剩余的 P0-N01 是集成遗漏而非设计缺陷——修复成本极低，修复后即可发布。

---

**报告完。建议修复 P0-N01 + P1-N02 后执行首次公开 tag。**
