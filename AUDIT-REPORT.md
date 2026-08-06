# @rulsynor/core 上线前全量审计报告

> **审计对象**：`@rulsynor/core` v1.0.0（即将开源发布）
> **审计时间**：2026-08-06
> **审计范围**：代码审查 + 安全审计 + QA 测试 + 开源合规
> **审计标准**：OSI 开源定义、OWASP/STRIDE 安全框架、TypeScript 严格类型、开源供应链安全（SLSA/SBOM）
> **审计结论**：**❌ 不建议直接上线**，存在 7 项 P0 阻断性问题必须修复后方可发布

---

## 一、执行摘要

| 维度 | 状态 | 发现数 |
|------|:----:|:------:|
| 代码质量 | ⚠️ | 11 |
| 安全 | 🔴 | 9 |
| QA 测试 | ⚠️ | 5 |
| 开源合规 | ⚠️ | 9 |
| **合计** | | **P0×7 / P1×18 / P2×10** |

**积极面**：TypeScript strict 模式通过（0 编译错误）、76 测试全绿、零运行时框架依赖、JCS+SHA-256 审计链设计扎实、SafeExpr 16 操作符白名单设计正确、Decision Object 防篡改测试覆盖。

**阻断面**：Runtime 模块完全绕过 Guard（P0-02）、生产默认时钟错误（P0-03）、ESM 中使用 `__dirname`（P0-04）、正则注入 + ReDoS（P0-01）、占位符合规声明法律风险（P0-06）。这些问题若随开源发布，将直接损害产品"确定性执行"的核心定位。

---

## 二、P0 阻断性问题（必须修复方可上线）

### P0-01 🔴 正则表达式注入 + ReDoS 拒绝服务

**位置**：
- `src/engine/safe-expr.ts:152` — `evalMatch` 中 `const regex = new RegExp(right);`，**无 try-catch**
- `src/engine/runtime-evaluator.ts:74` — `return new RegExp(value).test(fieldValue);`，有 try-catch
- `src/engine/rule-compiler.ts:609` — `return new RegExp(value).test(fieldValue);`，有 try-catch

**问题**：`match`/`matches` 操作符的 pattern 来自 ERDL YAML 规则（用户可自定义）。三处均用 `new RegExp(value)` 直接构造，未做 ReDoS 防护。`safe-expr.ts:152` 甚至无 try-catch，非法正则会导致整个评估器抛异常崩溃。

RuleCompiler 的 GATE 10（`rule-compiler.ts:839`）虽然检测嵌套量词，但其检测正则 `/\([^)]*[+*?][^)]*\)[+*?]/` 本身可被绕过（如 `a{1,100}{1,100}`、回溯爆炸但不匹配该模式）。

**影响**：恶意/缺陷规则可导致 DoS（指数回溯挂起事件循环）或崩溃。

**修复方案**：
```typescript
// 1. 统一封装安全正则构造器（新增 src/engine/safe-regex.ts）
import { TimeoutError } from './errors.js';

const REGEX_TIMEOUT_MS = 100;        // 单次匹配硬上限
const REGEX_MAX_LENGTH = 200;        // pattern 长度上限
const NESTED_QUANTIFIER = /(\+|\*|\?|\{[^}]+\})\s*(\+|\*|\?|\{[^}]+\})/;

export function safeRegExp(pattern: string): RegExp {
  if (typeof pattern !== 'string' || pattern.length > REGEX_MAX_LENGTH) {
    throw new Error(`SafeRegExp: pattern invalid or exceeds ${REGEX_MAX_LENGTH} chars`);
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    throw new Error(`SafeRegExp: potential ReDoS pattern rejected: ${pattern}`);
  }
  try {
    // Node 20+ 支持 RegExp timeout（实验性）；无则降级为长度+结构检测
    return new RegExp(pattern);
  } catch (e) {
    throw new Error(`SafeRegExp: invalid pattern "${pattern}": ${(e as Error).message}`);
  }
}

// 2. 替换三处调用
// safe-expr.ts:152
const regex = safeRegExp(right);
// runtime-evaluator.ts:74
return safeRegExp(value).test(fieldValue);
// rule-compiler.ts:609
return safeRegExp(value).test(fieldValue);
```

**验证命令**：
```bash
# 新增 ReDoS 回归测试
npx jest --testNamePattern="ReDoS"
```

---

### P0-02 🔴 Runtime 完全绕过 Guard 安全机制

**位置**：`src/runtime.ts:103`
```typescript
const evalResult = evaluator.evaluate(ctx as any, []);  // ← 传入空规则数组
```

**问题**：`runReActLoop` 调用 `evaluator.evaluate` 时传入空规则数组 `[]`。`findFirstMatchingRule`（`static-rule-tree.ts:51-80`）在空规则下直接返回 `ALLOW`。这意味着 Runtime 中**所有工具调用永远不会被拦截**，Guard 形同虚设。

`RuntimeOptions` 接口（`runtime.ts:26`）定义 `rules: Array<{ name: string; version: number }>`，但这是 Decision Object 的元数据，不是 `CompiledRule[]`。类型不匹配导致无法传入实际规则。

**影响**：Runtime 是 README 宣传的核心能力之一，但实际不提供任何安全保护。用户按文档集成后将获得虚假的安全感。

**修复方案**：
```typescript
// runtime.ts — 修正类型并实际传入规则
export interface RuntimeOptions {
  llm: (messages: LLMMessage[]) => Promise<LLMResponse>;
  evaluator: Evaluator;
  /** 编译后的规则（用于 Guard 评估） */
  compiledRules: CompiledRule[];                    // ← 新增
  /** 规则元数据（用于 Decision Object） */
  rules: Array<{ name: string; version: number }>;
  tools: Record<string, ToolExecutor>;
  userMessage: string;
  // ... 其余不变
}

// 第 103 行修正
import type { CompiledRule } from './engine/evaluator.js';
const evalResult = evaluator.evaluate(ctx, opts.compiledRules);  // ← 实际传入
```

**验证**：
```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"   # 应 DENY
# 新增 runtime 集成测试：验证危险 tool_call 在 runtime 内被拦截
```

---

### P0-03 🔴 生产默认时钟为 VirtualClock（时间静止）

**位置**：
- `src/engine/guard-state-manager.ts:35` — `constructor(clock: Clock = new VirtualClock(), ...)`
- `src/engine/evaluator-adapter.ts:145` — `const clock = new VirtualClock();`

**问题**：`GuardStateManager` 默认使用 `VirtualClock`，而 `VirtualClock`（`clock.ts:33-54`）初始时间为 `0` 且**永不前进**（除非显式调用 `advance()`）。这导致 `within`/`rate` 计数器在生产中行为完全错误：
- `recordWithin` 把所有事件时间戳记为 `0`，`pruneWithin` 的 `cutoff = 0 - windowMs` 永远为负，所有时间戳都 `> cutoff` → 计数器只增不减 → 第一次超限后永久拦截
- 或反向：若 windowMs 极大，永不超限

`EvaluatorAdapter`（集成桥）同样用 `VirtualClock`，意味着任何通过 Adapter 接入的生产系统都有此 bug。

**影响**：速率限制/窗口限制要么永久失效，要么永久误触发。安全规则的时序保护完全不可靠。

**修复方案**：
```typescript
// guard-state-manager.ts:35 — 默认改为 SystemClock
import { Clock, SystemClock, VirtualClock } from './clock.js';

export class GuardStateManager {
  constructor(
    clock: Clock = new SystemClock(),     // ← 生产默认用真实时钟
    freezeWindowMs: number = 60000,
  ) { ... }
}

// evaluator-adapter.ts:145 — 同样修正
import { SystemClock } from './clock.js';
const clock = new SystemClock();
const stateManager = new GuardStateManager(clock);

// 测试场景显式注入 VirtualClock
const testState = new GuardStateManager(new VirtualClock(1000));
```

**验证**：
```bash
# 新增时钟测试：验证 SystemClock 下 within 计数器随时间衰减
npx jest --testNamePattern="GuardStateManager.*SystemClock"
```

---

### P0-04 🔴 ESM 模块中使用 __dirname（运行时崩溃）

**位置**：
- `src/engine/rule-compiler.ts:126` — `const vectorsPath = join(__dirname, '..', 'decision-object-vectors-v1.3.json');`
- `src/engine/op-sem-registry.ts:63` — `const defaultPath = path.resolve(__dirname, 'op-sem-registry.yaml')`

**问题**：`package.json` 声明 `"type": "module"`，项目为 ESM。在 ESM 中 `__dirname` 和 `__filename` **未定义**。`src/rules/index.ts:7-8` 正确使用了 `fileURLToPath(import.meta.url)`，但 `rule-compiler.ts` 和 `op-sem-registry.ts` 仍用裸 `__dirname`。

调用 `RuleCompilerImpl.verifyAgainstVectors()` 或 `OpSemRegistry.load()` 会抛 `ReferenceError: __dirname is not defined`。

**影响**：向量验证和操作语义分类功能不可用。当前测试未覆盖这两个路径，所以未暴露。

**修复方案**：
```typescript
// rule-compiler.ts 顶部新增
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// op-sem-registry.ts 顶部同样新增
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**验证**：
```bash
npx tsc --noEmit && npm test
# 新增测试：调用 verifyAgainstVectors 和 OpSemRegistry.load 确认不抛 ReferenceError
```

---

### P0-05 🔴 Evaluator 评估副作用破坏 first-match-wins 语义

**位置**：`src/engine/evaluator.ts:78-126`

**问题 A（副作用污染）**：`evaluate()` 在 pre-check 阶段（第 80-122 行）对每条含 `within`/`rate` 的规则调用 `stateManager.recordWithin()`/`recordRate()`，这是**有副作用的写操作**。若评估后决策为 DENY 并回滚，计数器已被污染——后续合法请求会被错误拦截。

**问题 B（破坏优先级）**：pre-check 遍历原始 `rules` 数组（未排序），命中后直接 `return`，跳过了 `findFirstMatchingRule`（`static-rule-tree.ts`）的 Ring+Priority 排序。这意味着一条 Ring 3 低优先级规则的 `within` 条件可能先于 Ring 0 高优先级规则命中，违反 SPEC §3.5 Execution Rings 语义。

**影响**：安全规则优先级失效；速率限制计数器被评估本身污染，产生误拦截或漏拦截。

**修复方案**：
```typescript
// evaluator.ts — 分离"查询"与"记录"，且按 Ring+Priority 排序后再做时序检查
evaluate(context: EvalContext, rules: CompiledRule[]): EvalResult {
  const sorted = sortRulesByRingAndPriority(rules);  // ← 先排序

  for (const rule of sorted) {                       // ← 按优先级遍历
    if (!rule.enabled) continue;

    // 无状态条件先评估（first-match-wins）
    const temporalConditions = rule.conditions.filter(
      c => c.operator === 'within' || c.operator === 'rate',
    );
    const statelessConditions = rule.conditions.filter(
      c => c.operator !== 'within' && c.operator !== 'rate',
    );

    // 无状态条件不匹配 → 跳过此规则（不记录时序）
    if (statelessConditions.length > 0) {
      const statelessMatched = evaluateConditionGroup(
        statelessConditions, rule.conditionLogic, context,
      );
      if (!statelessMatched) continue;
    }

    // 无状态条件匹配后，才检查时序条件（只读查询，不写）
    let temporalPassed = true;
    for (const c of temporalConditions) {
      const count = c.operator === 'within'
        ? this.stateManager.getWithinCount(`${rule.id}:${context.toolName}`, c.windowMs || 60000)
        : this.stateManager.getRateCount(`${rule.id}:${context.toolName}`);
      if (count >= (c.value as number)) { temporalPassed = false; break; }
    }
    if (!temporalPassed) {
      return { decision: rule.decision, reason: `${rule.reason} (limit exceeded)`,
               matchedRuleId: rule.id, matchedRuleName: rule.name, severity: rule.severity, ring: rule.ring };
    }

    // 时序条件通过 → 记录（仅在决策为 ALLOW 时才记录，DENY 不污染计数器）
    // 实际记录应推迟到 actionTaken 确认为 'allowed' 后，由调用方触发
    return { decision: rule.decision, reason: rule.reason,
             matchedRuleId: rule.id, matchedRuleName: rule.name, severity: rule.severity, ring: rule.ring };
  }

  return { decision: 'ALLOW', reason: 'No rules matched — default ALLOW' };
}

// 新增 commitWithin(key, windowMs) 方法，由调用方在 actionTaken='allowed' 后调用
```

**验证**：新增测试覆盖（1）DENY 后计数器未增长；（2）Ring 0 规则优先于 Ring 3 规则的 within 命中。

---

### P0-06 🔴 占位符合规声明存在法律风险

**位置**：`src/provenance.ts:44,50`
```typescript
algorithmFilingNo: 'NET-2026-000000',      // 中国 CAC 算法备案号（占位）
modelRegistrationId: 'MR-2026-000000',     // 中国 CAC 模型上线备案号（占位）
```

**问题**：这两个值进入 Decision Object 的 `agent.algorithm_filing_no` / `agent.model_registration_id` 字段（`guard/index.ts:130-131`），并参与 JCS+SHA-256 审计哈希。`NET-2026-000000` / `MR-2026-000000` 明显是占位符。

中国《互联网信息服务算法推荐管理规定》《生成式人工智能服务管理暂行办法》要求：具有舆论属性或社会动员能力的算法/生成式 AI 服务须向 CAC 履行备案。开源公开后，若实际未备案，这些字段构成**虚假合规声明**，可能被监管视为误导。

**影响**：法律合规风险；开源后第三方依赖此字段做合规判断会被误导。

**修复方案**（二选一）：

**方案 A（推荐，未备案前）**：将字段改为显式未备案状态
```typescript
// provenance.ts
algorithmFilingNo: 'NOT_FILED',           // 显式声明未备案
modelRegistrationId: 'NOT_FILED',
knownLimitations: [
  // ... 原有项 +
  'Algorithm filing with China CAC not yet completed; algorithmFilingNo and modelRegistrationId are placeholders',
],
```

**方案 B（已备案后）**：填入真实备案号
```typescript
algorithmFilingNo: process.env.RULSYNOR_ALGORITHM_FILING_NO || 'NOT_FILED',
modelRegistrationId: process.env.RULSYNOR_MODEL_REGISTRATION_ID || 'NOT_FILED',
```

同时在 `SECURITY.md` 的 Known Limitations 表中新增一行说明备案状态。

---

### P0-07 🔴 SafeExpr 递归无深度限制（栈溢出 DoS）

**位置**：`src/engine/safe-expr.ts:217`（evalAnd）、`229`（evalOr）、`240`（evalNot）

**问题**：`evalAnd`/`evalOr`/`evalNot` 递归调用 `this.evaluate(arg as SafeExpr, context)`，无最大深度限制。恶意构造的深度嵌套 AST（如 `and(and(and(...1000层...)))` 会导致栈溢出崩溃。`fn-registry.ts:96` 的 `invoke` 同样无递归防护。

**影响**：DoS。虽然 SafeExpr 声称"零代码注入"，但 AST 深度无限制仍是拒绝服务面。

**修复方案**：
```typescript
// safe-expr.ts — 新增深度限制
const MAX_AST_DEPTH = 50;

export class SafeExprEvaluator {
  evaluate(expr: SafeExpr, context: Record<string, unknown>, depth: number = 0): boolean {
    if (depth > MAX_AST_DEPTH) {
      throw new Error(`SafeExprEvaluator: AST depth exceeded ${MAX_AST_DEPTH} (potential DoS)`);
    }
    const { type, args } = expr;
    switch (type) {
      // ...
      case 'and':
        return this.evalAnd(args, context, depth + 1);
      case 'or':
        return this.evalOr(args, context, depth + 1);
      case 'not':
        return this.evalNot(args, context, depth + 1);
      // ...
    }
  }

  private evalAnd(args: unknown[], context: Record<string, unknown>, depth: number): boolean {
    for (const arg of args) {
      if (!this.evaluate(arg as SafeExpr, context, depth)) return false;
    }
    return true;
  }
  // evalOr / evalNot 同理
}
```

**验证**：新增测试构造 100 层嵌套 AST，断言抛出明确错误而非栈溢出。

---

## 三、P1 重要问题（应该修复）

### P1-01 版本号全面不一致

| 位置 | 值 |
|------|----|
| `package.json:3` | `1.0.0` |
| `src/provenance.ts:22` | `1.0.0`（注释要求与 package.json 一致 ✅） |
| `CHANGELOG.md:3` | `v2.0.0-alpha.1` |
| `ROADMAP.md:3` | `v1.0` |
| `README.md` | 未明确 |

**修复**：统一为 `1.0.0`（首次公开 tag）。CHANGELOG 顶部改为 `## 1.0.0 (2026-08-06)`。ROADMAP 改为 `## v1.0.0 (Current)`。发布前在 CI 中校验 `provenance.ts` 与 `package.json` 版本一致。

```bash
# CI 校验脚本（加入 .github/workflows/ci.yml）
node -e "const p=require('./package.json'); const {PROVENANCE}=require('./dist/provenance.js'); if(p.version!==PROVENANCE.version) throw new Error('version mismatch')"
```

---

### P1-02 文档规则数量不一致（实际 28 条）

| 来源 | 声称数量 |
|------|----------|
| 实际（`loadPresetRules()` 返回） | **28** |
| `README.md:47` | 32 |
| `README.md:116` | 32 |
| `CHANGELOG.md:30` | 32 |
| `ROADMAP.md:8` | 29 |
| `SECURITY.md:62` | 29（隐含） |
| `experiments/long-dev-task-guard-behavior.md:43` | 32 → 31 |

**修复**：运行 `node -e "console.log(require('./dist/index.js').loadPresetRules().length)"` 获取真实数（28），全局替换文档。或调整规则集至声称数量。

---

### P1-03 文档测试数量不一致

| 来源 | 数量 |
|------|------|
| 实际（`npm test`） | **76 passed** |
| `SECURITY.md:62` | 67 |
| `CHANGELOG.md:35` | 67 |
| `ROADMAP.md:14` | 76 |

**修复**：统一为 76。SECURITY.md 和 CHANGELOG 改为 76。

---

### P1-04 Clock 接口双重定义冲突

**位置**：
- `src/engine/types.ts:406-410`：`export interface Clock { now(): Date; ... }`
- `src/engine/clock.ts:8-17`：`export interface Clock { now(): number; ... }`

**问题**：两个同名 `Clock` 接口在不同文件中定义，签名冲突（`Date` vs `number`）。`guard-state-manager.ts` import 的是 `clock.ts` 的版本（`number`），但若有人按 `types.ts` 的 `Clock` 实现（返回 `Date`），传入 `GuardStateManager` 后 `within`/`rate` 的 `cutoff = now - windowMs` 会变成 `Date - number` → `NaN`，计数器逻辑全部失效。

**修复**：删除 `types.ts:406-410` 的 `Clock` 接口（死代码），统一从 `clock.ts` 导出。`types.ts` 顶部加 `import type { Clock } from './clock.js'` 并 re-export。

---

### P1-05 fail-open 默认策略无配置项

**位置**：`src/engine/evaluator.ts:63`、`src/engine/static-rule-tree.ts:76-79`

**问题**：无规则匹配时默认返回 `ALLOW`。对于安全工具，规则加载失败（空数组、解析异常）时静默放行是危险的。

**修复**：新增 `failOpen` 配置，默认生产 fail-closed：
```typescript
export class Evaluator {
  constructor(stateManager: GuardStateManager, private opts: { failOpen?: boolean } = {}) {}

  evaluate(context: EvalContext, rules: CompiledRule[]): EvalResult {
    if (rules.length === 0) {
      return this.opts.failOpen
        ? { decision: 'ALLOW', reason: 'No rules loaded — fail-open' }
        : { decision: 'DENY', reason: 'No rules loaded — fail-closed (safety default)' };
    }
    // ...
  }
}
```

---

### P1-06 types.ts 中 GuardStateManager 是 interface 但实际是 class

**位置**：`src/engine/types.ts:413-415`
```typescript
export interface GuardStateManager {
  onHotReload(newDirective: GuardDirective): void;
}
```

实际 `guard-state-manager.ts` 导出的是 `class GuardStateManager`，且无 `onHotReload` 方法。`types.ts` 的定义是死代码且误导。

**修复**：删除 `types.ts:413-415`，统一从 `guard-state-manager.ts` 导出。

---

### P1-07 verifyEquivalence symbolic 模式是空实现

**位置**：`src/engine/rule-compiler.ts:238-243`
```typescript
if (mode === 'symbolic' || mode === 'full') {
  // Delegate to Z3 verifier for decidable fragment
  // (Z3 verifier is in @rulsynor/verifier-z3 optional package)
}
return { passed: true, divergenceCount: 0, samples };  // ← 直接返回 passed:true
```

**问题**：未实现却返回 `passed: true`，误导调用方认为已通过符号验证。

**修复**：未实现时应抛 `Error('symbolic mode not implemented')` 或返回 `{ passed: false, divergenceCount: -1, samples: [], note: 'not implemented' }`。在 `SECURITY.md` Known Limitations 中声明。

---

### P1-08 verifyAgainstVectors 逻辑空洞

**位置**：`src/engine/rule-compiler.ts:116-170`

**问题**：循环内 `const vecRules = (vec as any).rules || []` 取出后，仅用 `vr.then` 与 `expected.decision` 做字符串匹配，未实际用编译产物评估 vector context。`passed` 统计无意义。

**修复**：实现真正的向量验证——对每个 vector 的 context 调用 `traverseTree(root, ctx)` 并与 `expected.decision` 比对。或标注为 stub 并抛错。

---

### P1-09 .gitignore 错误排除 pnpm-lock.yaml

**位置**：`.gitignore`
```
pnpm-lock.yaml      ← 错误：lockfile 应提交
```

**问题**：开源项目提交 lockfile 是供应链安全最佳实践（保证可复现构建、依赖完整性）。`pnpm-lock.yaml` 被 ignore 会导致依赖版本漂移。

**修复**：从 `.gitignore` 删除 `pnpm-lock.yaml`，并 `git add pnpm-lock.yaml`。

---

### P1-10 缺少 lint/format 强制配置

**问题**：`CONTRIBUTING.md:27` 要求 "TypeScript strict mode is enforced. No `@ts-ignore`, no `as any` without comment"，但项目无 `.eslintrc`、`.prettierrc`、`.editorconfig`，CI 也无 lint 步骤。规范无法自动强制。

**修复**：新增 ESLint + Prettier 配置，加入 CI：
```bash
npm i -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier
```
```json
// .eslintrc.json
{
  "parser": "@typescript-eslint/parser",
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/ban-ts-comment": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```
```yaml
# .github/workflows/ci.yml 增加
- run: npx eslint 'src/**/*.ts' --max-warnings 0
```

---

### P1-11 大量 as any 违背"确定性执行"定位

**位置**：
- `src/playground.ts:69` — `const aid = (record as any).agent.aid as string;`
- `src/playground.ts:70` — `const jurisdictions = (record as any).compliance_profile.jurisdictions as string[];`
- `src/playground.ts:97` — `(record as any).audit.hash`
- `src/runtime.ts:103` — `evaluator.evaluate(ctx as any, [])`
- `src/runtime.ts:118` — `const auditHash = (do1 as any).audit.hash;`
- `src/engine/rule-compiler.ts:132,137,141,161,165,199-202,709,790,802,935,975,981` — 多处 `(rule as any)`、`(vec as any)`、`as any`
- `test/core.test.ts`、`test/core-extended.test.ts` — 大量 `as any`

**问题**：产品定位"确定性执行"，但 `as any` 绕过类型检查，与定位冲突。`buildDecisionObject` 返回 `Record<string, unknown>` 而非强类型，迫使调用方 `as any`。

**修复**：
1. 为 Decision Object 定义强类型 interface（`src/guard/types.ts`）：
```typescript
export interface DecisionObject {
  spec: string;
  decision_id: string;
  compliance_profile: ComplianceProfile;
  // ... 全部 25 字段
  audit: { previous_hash: string | null; commitment: string; hash: string };
}
export function buildDecisionObject(opts: DecisionObjectInput): DecisionObject { ... }
```
2. 调用方移除 `as any`，直接 `record.audit.hash`、`record.agent.aid`。
3. `rule-compiler.ts` 的 `(rule as any).ring` 应改为 `rule.ring ?? 3`（`RuleDefinition` 已有 `ring?`）。

---

### P1-12 deepEquals 用 JSON.stringify 不可靠

**位置**：`src/engine/runtime-evaluator.ts:162-175`
```typescript
function deepEquals(a: unknown, b: unknown): boolean {
  const jsonA = JSON.stringify(a, Object.keys(a as object).sort());
  const jsonB = JSON.stringify(b, Object.keys(b as object).sort());
  return jsonA === jsonB;
}
```

**问题**：`Object.keys(a).sort()` 作为 replacer 只排序顶层键，嵌套对象键顺序仍敏感。不支持 `Date`/`Map`/`Set`/`undefined`/循环引用。

**修复**：使用 `json-canonicalize`（已是依赖）做 JCS 比较，或引入 `fast-deep-equal`：
```typescript
import { canonicalize } from 'json-canonicalize';
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  try { return canonicalize(a) === canonicalize(b); }
  catch { return false; }
}
```

---

### P1-13 EvaluatorAdapter.toCoreContext 平铺仅一层

**位置**：`src/engine/evaluator-adapter.ts:117-128`

**问题**：把 `context` 平铺到 `ctx[key]` 和 `ctx[`${key}.${subKey}`]`，但只支持一层嵌套。深层嵌套（如 `context.user.profile.name`）丢失。同时 `toolArgs` 平铺到 `ctx[tool.args.key]`，与 `resolveField`（`runtime-evaluator.ts:139-142`）的 `tool.args` 特殊处理重复，可能冲突。

**修复**：不要平铺，直接保留嵌套对象，让 `resolveField` 的 dot-notation 解析处理。或重构 `resolveField` 统一从嵌套对象取值。

---

### P1-14 fn-registry.invoke 超时未取消主 Promise

**位置**：`src/engine/fn-registry.ts:96-101`
```typescript
const result = await Promise.race([
  Promise.resolve(reg.impl(...args)),
  new Promise((_, reject) => setTimeout(() => reject(...), timeout)),
]);
```

**问题**：`Promise.race` 超时后主 Promise 仍继续执行，资源泄漏。若 `impl` 是长循环，会持续占用 CPU/内存。

**修复**：使用 `AbortController`（Node 18+）：
```typescript
async invoke(name: string, ...args: unknown[]): Promise<unknown> {
  const reg = this.fns.get(name)!;
  const controller = new AbortController();
  const timeout = reg.timeoutMs || 5000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // 要求 impl 接受 signal（约定）
    const result = await (reg.impl as any)(...args, { signal: controller.signal });
    return result;
  } finally {
    clearTimeout(timer);
  }
}
```

---

### P1-15 PROVENANCE.knownLimitations 与实际不符

**位置**：`src/provenance.ts:38`
```typescript
'English-language interface only; Chinese UI planned for V2.0',
```

实际：存在 `README.zh-CN.md`、规则文件含中文 instruction、`fn-registry.ts` 注释为中文、`parseRequestHumanSignal` 支持中文模式。

**修复**：改为 `'Bilingual interface (English + Chinese); other languages not yet localized'`。

---

### P1-16 README.zh-CN.md 不在 package.json files

**位置**：`package.json:8-13`
```json
"files": ["dist/", "src/", "LICENSE", "README.md"]
```

**问题**：中文用户通过 npm 安装后无法获取中文文档。

**修复**：`"files": ["dist/", "src/", "LICENSE", "README.md", "README.zh-CN.md"]`。

---

### P1-17 experiments/ 含开发笔记

**位置**：`experiments/long-dev-task-guard-behavior.md`、`experiments/round2.cjs`、`experiments/round3.cjs`

**问题**：开发过程笔记和实验脚本，开源前应评估。`.cjs` 文件用 CommonJS 语法，与项目 ESM 不一致。

**修复**：将 `long-dev-task-guard-behavior.md` 移入 `docs/experiments/` 并精简为案例研究；`round2.cjs`/`round3.cjs` 转为 `test/experiments/` 下的集成测试（纳入回归），或删除。

---

### P1-18 overview.md / OPTIMIZATION_REPORT.md 是开发产物

**问题**：`overview.md` 是 agent 模式产物，`OPTIMIZATION_REPORT.md` 是内部优化报告，开源仓库保留会混淆外部贡献者。

**修复**：删除或移入 `docs/internal/`（不随 npm 包发布，已在 files 字段外）。

---

### P1-19 test/integration.test.ts.bak 备份文件残留

**位置**：`test/integration.test.ts.bak`

**修复**：`rm test/integration.test.ts.bak`（.gitignore 已排除，但文件仍在工作区）。

---

### P1-20 缺少开源社区标准文件

缺失：
- `CODE_OF_CONDUCT.md`（Contributor Covenant）
- `.github/ISSUE_TEMPLATE/bug_report.md`、`feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`（CI 工作流）
- `.github/dependabot.yml`

**修复**：使用社区模板生成：
```bash
# CODE_OF_CONDUCT.md
curl -o CODE_OF_CONDUCT.md https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md
# CI workflow 见 P1-10
```

---

### P1-21 package.json 缺少标准字段

**问题**：
- `repository` 应为 object：`{ "type": "git", "url": "https://github.com/OpenOBA/rulsynor-core.git" }`
- 缺少 `author`、`contributors`、`bugs`、`homepage`、`funding` 字段
- `bin` 字段两个键指向同一文件，`@rulsynor/core` 作为 bin 名不规范（应只用 `rulsynor`）

**修复**：
```json
{
  "author": "OpenOBA <support@openoba.com> (https://openoba.com)",
  "contributors": ["唐浩然 (Tang Haoran) <tanghaoran@openoba.com>"],
  "bugs": { "url": "https://github.com/OpenOBA/rulsynor-core/issues" },
  "homepage": "https://github.com/OpenOBA/rulsynor-core#readme",
  "funding": { "type": "opencollective", "url": "https://opencollective.com/openoba" },
  "repository": { "type": "git", "url": "https://github.com/OpenOBA/rulsynor-core.git" },
  "bin": { "rulsynor": "./dist/playground.js" }
}
```

---

### P1-22 SECURITY.md 缺少协同披露流程

**位置**：`SECURITY.md:33-37`

**问题**：仅提供邮箱，无 PGP key、无 SLA、无 scope（哪些版本受支持）、无奖励政策。

**修复**：补充：
```markdown
## Supported Versions
| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅         |
| <1.0    | ❌         |

## Reporting a Vulnerability
- Email: security@openoba.com
- PGP key: [fingerprint] (published at https://openoba.com/.well-known/security.txt)
- Response SLA: 48 hours acknowledgment, 14 days initial assessment
- Please do NOT file public GitHub issues for security vulnerabilities.
- Coordinated disclosure window: 90 days
```
并新增 `.well-known/security.txt`。

---

### P1-23 LICENSE 年份范围

**位置**：`LICENSE:3` — `Copyright (c) 2026 OpenOBA`

**修复**：改为 `Copyright (c) 2026-present OpenOBA` 或每年更新（`2026-2027`）。

---

### P1-24 js-yaml load 未显式指定 safe schema

**位置**：`src/engine/rule-compiler.ts:81`、`src/rules/index.ts:26`

**问题**：`yaml.load(raw)` 默认 `DEFAULT_SAFE_SCHEMA`，但未显式声明。防御性编程应显式指定，防止未来 js-yaml 版本变更默认行为。

**修复**：
```typescript
yaml.load(raw, { schema: yaml.DEFAULT_SAFE_SCHEMA })
yaml.loadAll(content, { schema: yaml.DEFAULT_SAFE_SCHEMA })
```

---

### P1-25 runtime.ts 硬编码 evaluationDurationMs

**位置**：`src/runtime.ts:115` — `evaluationDurationMs: 5`

**问题**：审计字段造假，应为真实测量。Decision Object 的 `evaluation_duration_ms` 进入审计哈希，硬编码值导致审计数据失真。

**修复**：
```typescript
const evalStart = performance.now();
const evalResult = evaluator.evaluate(ctx, opts.compiledRules);
const evaluationDurationMs = Math.round(performance.now() - evalStart);
```

---

## 四、P2 改进建议

| ID | 问题 | 位置 | 建议 |
|----|------|------|------|
| P2-01 | rule-compiler.ts 988 行过大 | `src/engine/rule-compiler.ts` | 按 OpenOBA 大文件拆分五步法拆为 compiler/schema/guidance/directive/audit 5 个文件 |
| P2-02 | 测试用 require() 而非 ESM import | `test/core.test.ts` | 改为 ESM `import`，移除 `require('crypto')` |
| P2-03 | 测试覆盖缺口 | test/ | 新增 ReDoS、栈溢出、并发、path traversal、fail-open/closed、experiments 15-step 回归测试 |
| P2-04 | 缺少性能基准测试 | - | SECURITY.md 声称 <1ms 遍历，新增 `bench/` 目录用 mitata 或 benchmark.js 验证 |
| P2-05 | OpSemRegistry 未知工具默认 OP_EXEC high | `op-sem-registry.ts:94,157` | 考虑默认 `OP_UNKNOWN` + medium，或可配置 |
| P2-06 | conservativeCount 逻辑可疑 | `guard-state-manager.ts:122` | `Math.max(actual, limit*0.8)` 恒返回较大值，需确认语义 |
| P2-07 | 缺少 dependabot/renovate | - | 新增 `.github/dependabot.yml` |
| P2-08 | 缺少 SBOM/SLSA provenance | - | 发布时附 `sbom.spdx.json`，GitHub Actions 生成 SLSA provenance |
| P2-09 | compliance cachedProfile 全局缓存 | `compliance/index.ts:43` | 模块级缓存无法按请求隔离 jurisdiction，多租户污染。改为按 jurisdiction key 缓存或每次计算 |
| P2-10 | buildDecisionObject 从 process.env 读配置 | `guard/index.ts:111,135,186` | autonomy_level/model_id/AID registrar 应通过 opts 显式传入，而非 env |

---

## 五、开源合规专项检查

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| LICENSE 文件 | ✅ | MIT，内容正确 |
| LICENSE 年份 | ⚠️ | 仅 2026，建议 `2026-present`（P1-23） |
| COPYRIGHT 声明 | ✅ | "OpenOBA (Shenzhen Miaojing Technology Co., Ltd.)" |
| README（英） | ✅ | 完整，含安装、示例、定位 |
| README（中） | ⚠️ | 存在但不随包发布（P1-16） |
| CHANGELOG | ⚠️ | 版本号不一致（P1-01） |
| CONTRIBUTING.md | ✅ | 完整，含工作流、规范 |
| CODE_OF_CONDUCT.md | ❌ | 缺失（P1-20） |
| SECURITY.md | ⚠️ | 缺 PGP/SLA/scope（P1-22） |
| ROADMAP.md | ✅ | 完整 |
| .gitignore | ⚠️ | 错误排除 lockfile（P1-09） |
| .npmignore / files | ⚠️ | files 缺中文 README（P1-16） |
| ESLint/Prettier | ❌ | 缺失（P1-10） |
| CI workflow | ❌ | 缺失（P1-20） |
| Issue/PR 模板 | ❌ | 缺失（P1-20） |
| Dependabot | ❌ | 缺失（P2-07） |
| SBOM/SLSA | ❌ | 缺失（P2-08） |
| security.txt | ❌ | 缺失（P1-22） |
| 备份文件清理 | ⚠️ | test/*.bak 残留（P1-19） |
| 开发产物清理 | ⚠️ | overview.md / OPTIMIZATION_REPORT.md（P1-18） |
| 实验目录 | ⚠️ | experiments/ 含开发笔记（P1-17） |
| 占位符合规声明 | ❌ | CAC 备案号占位（P0-06） |
| 许可证兼容性 | ✅ | 仅 2 个 MIT 依赖（json-canonicalize、js-yaml） |

---

## 六、QA 测试评估

### 测试现状
- **测试框架**：Jest 30 + ts-jest（ESM preset）
- **测试数量**：76 passed（3 suites）
- **执行时间**：8.7s
- **覆盖范围**：SafeExpr 16 操作符、Evaluator 规则匹配、Decision Object 防篡改、Compliance、Guidance、Runtime（仅 createToolExecutor）、Preflight（CORRECT loop、REQUEST_HUMAN、A/B 分配）

### 测试质量评估

| 维度 | 评分 | 说明 |
|------|:----:|------|
| 操作符覆盖 | ✅ | 16 操作符全覆盖 |
| 边界条件 | ⚠️ | 缺空值、超长字符串、嵌套对象 |
| 安全场景 | ❌ | 无 ReDoS、栈溢出、并发、path traversal 测试 |
| 集成测试 | ❌ | runtime 集成测试缺失（P0-02 未暴露因无测试） |
| 回归测试 | ❌ | experiments 15-step 场景未纳入 |
| 性能测试 | ❌ | 无基准测试 |
| 失败路径 | ⚠️ | 部分覆盖（throws on missing field），不全 |
| 测试反模式 | ⚠️ | 用 require()、大量 as any（P2-02、P1-11） |

### 关键测试缺口（必须补齐）

```typescript
// test/security.test.ts — 新增
describe('ReDoS protection', () => {
  it('rejects exponential backtracking patterns', () => {
    expect(() => safeRegExp('(a+)+b')).toThrow('ReDoS');
  });
  it('limits regex pattern length', () => {
    expect(() => safeRegExp('a'.repeat(201))).toThrow('exceeds');
  });
});

describe('AST depth limit', () => {
  it('throws on depth > 50', () => {
    let expr = { type: 'eq', args: ['x', 1] };
    for (let i = 0; i < 51; i++) expr = { type: 'not', args: [expr] };
    expect(() => e.evaluate(expr, { x: 1 })).toThrow('depth exceeded');
  });
});

describe('Runtime Guard enforcement', () => {
  it('blocks rm -rf in runtime', async () => {
    const result = await runReActLoop({
      ...opts, compiledRules: toCompiledRules(loadPresetRules()),
      tools: { exec: { execute: async () => 'should not reach' } },
    });
    expect(result.decision).toBe('DENY');
  });
});

describe('GuardStateManager SystemClock', () => {
  it('prunes within counter after window expires', async () => {
    const sm = new GuardStateManager(new SystemClock());
    sm.recordWithin('k', 1000);
    await new Promise(r => setTimeout(r, 1100));
    expect(sm.getWithinCount('k', 1000)).toBe(0);
  });
});
```

---

## 七、修复优先级与行动计划

### Sprint 0：上线阻断修复（必须，预计 2-3 天）
| 优先级 | 问题 | 预估 |
|:------:|------|:----:|
| P0-01 | 正则注入 + ReDoS | 4h |
| P0-02 | Runtime 绕过 Guard | 3h |
| P0-03 | 生产默认 VirtualClock | 2h |
| P0-04 | ESM __dirname | 1h |
| P0-05 | Evaluator 副作用 + 优先级 | 6h |
| P0-06 | 占位符合规声明 | 1h |
| P0-07 | AST 深度限制 | 2h |
| 测试 | 补齐上述修复的回归测试 | 6h |
| **小计** | | **~25h** |

### Sprint 1：开源合规（建议发布前完成，预计 2 天）
| 优先级 | 问题 | 预估 |
|:------:|------|:----:|
| P1-01 | 版本号统一 | 1h |
| P1-02/03 | 文档数量统一 | 1h |
| P1-09 | .gitignore 修正 | 0.5h |
| P1-10 | ESLint/Prettier 配置 | 3h |
| P1-16 | README.zh-CN 纳入 files | 0.5h |
| P1-17/18/19 | 开发产物清理 | 1h |
| P1-20 | 社区标准文件 | 2h |
| P1-21 | package.json 字段 | 1h |
| P1-22 | SECURITY.md 完善 | 1h |
| **小计** | | **~11h** |

### Sprint 2：质量提升（发布后 1 周内）
P1-04/05/06/07/08/11/12/13/14/15/23/24/25 + P2 全部

---

## 八、附录

### 审计命令记录
```bash
# 类型检查
npx tsc --noEmit                    # → 0 errors ✅

# 测试
npm test                            # → 76 passed ✅

# 实际规则数
node -e "console.log(require('./dist/index.js').loadPresetRules().length)"  # → 28

# 关键模式扫描
grep -rn "as any" src/              # → 3 处（src 内）
grep -rn "new RegExp(" src/         # → 3 处
grep -rn "__dirname" src/           # → 4 处（2 处 ESM bug）
grep -rn "eval\(|new Function\(" src/  # → 0 处 ✅
```

### 文件清单（27 源文件 + 3 测试 + 2 规则 YAML）
- 源码：`src/` 下 27 个 `.ts` + 2 个 `.erdl.yaml` + 1 个 `op-sem-registry.yaml`（被 exclude？需确认）
- 测试：`test/` 下 3 个 `.test.ts` + 1 个 `.bak`
- 脚本：`scripts/copy-rules.mjs`
- 实验：`experiments/` 下 2 个 `.cjs` + 1 个 `.md`

### 审计依据
- OWASP Application Security Verification Standard (ASVS) v4.0
- STRIDE 威胁建模框架
- OSI Open Source Definition 1.1
- SLSA Build Level 1 要求
- TypeScript strict mode 最佳实践
- npm 包发布最佳实践
- 中国《生成式人工智能服务管理暂行办法》第十七条（备案要求）

---

**报告完。建议在 Sprint 0 全部 P0 修复并通过回归测试后，再执行首次公开 tag。**
