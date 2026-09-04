# Developer Guide — @openoba/rulsynor-core

> 面向扩展/二开 rulsynor-core 的开发者。规则创作见 [RULE-AUTHORING.md](./RULE-AUTHORING.md)，提交流程见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

## 架构总览

rulsynor-core 采用**单一求值核心**（Spec v2.1 §7.2 E7：Simple 与 Expression 编译到同一核心，禁止两个求值器）。

```
ERDL 规则（YAML / S-expression）
        │
        ▼
  simple-compiler.ts / rule-to-expr.ts   ← Simple 30 运算符 → 表达式树
        │
        ▼
  expr-tree/evaluator.ts                  ← 34 节点表达式树求值器（ExprTreeEvaluator）
        │
        ▼
  evaluator.ts                            ← 规则求值器（环排序 + first-match-wins + override）
        │
        ▼
  Decision Object（JCS + SHA-256 审计链）
```

| 模块 | 文件 | 职责 |
|------|------|------|
| **Evaluator** | `src/engine/evaluator.ts` | 规则求值编排：环排序、first-match-wins、override 语义 |
| **ExprTreeEvaluator** | `src/engine/expr-tree/evaluator.ts` | 34 节点表达式树求值（唯一求值核心） |
| **Simple 编译** | `src/engine/expr-tree/simple-compiler.ts` | Simple 30 运算符 → 表达式树编译映射 |
| **单一事实源** | `src/engine/erdl-schema.ts` | 运算符/决策/节点/分类枚举 + `SCHEMA_COUNTS` 自证 |
| **GuardStateManager** | `src/engine/guard-state-manager.ts` | within/rate 有状态计数器（树外状态） |
| **ERDLFnRegistry** | `src/engine/fn-registry.ts` | 函数委派（注册制 + 沙箱 + 确定性豁免） |
| **safeRegExp** | `src/engine/safe-regex.ts` | ReDoS 防护正则 |

> 内核显式排除：字符串拼接、正则替换、位运算、日期格式化、递归引用、用户自定义节点——以维持求值的封闭性与可验证性。

---

## 关键设计原则

1. **确定性**：同输入 → 同输出。求值路径无 `Date.now()`、无 `Math.random()`。时间用 `VirtualClock` 注入。
2. **单一事实源**：运算符/决策/节点/分类枚举只在 `erdl-schema.ts` 一处，`SCHEMA_COUNTS` 用 `.length` 自证，杜绝手写数字漂移。
3. **树即证据**：`canonical_tree`（树快照）进 DO 参与哈希；`eval_trace`/`gloss` 是可重算派生产物，不进 DO。
4. **叶子折叠（E11）**：比较节点把 Missing 折叠为 `false`；布尔算子两值；`exists` 是唯一感知字段存在性的算子。
5. **定点小数（E2）**：scale=14 + half-even，中间 128 位有理数，仅输出节点舍入。
6. **first-match-wins**：规则按 Ring（0 优先）→ priority（小优先）排序，首个命中即止。
7. **时序计数**：within/rate 计数由 GuardStateManager 维护，`evaluate()` 内自动检查（`checkRate`）并记录（`recordRate`）；窗口快照进 `evaluation.temporal_state`（RFC-002 §2.4）。
8. **审计哈希原像**：`audit.hash` / `signature` / `signing_key_id` 排除在原像外；其余（含 `audit.previous_hash` / `audit.commitment` / `extensions`）参与哈希。

---

## 项目结构

```
src/
├── index.ts                    # 公共 API barrel 导出
├── playground.ts               # CLI：npx @openoba/rulsynor-core
├── runtime.ts                  # 最小 ReAct 循环
├── provenance.ts               # 构建身份水印
├── engine/
│   ├── index.ts                # 引擎 barrel
│   ├── evaluator.ts            # 规则求值引擎（环排序 + override）
│   ├── erdl-schema.ts          # 单一事实源（运算符/决策/节点/分类）
│   ├── guard-state-manager.ts  # within/rate 计数器
│   ├── fn-registry.ts          # 函数委派注册表
│   ├── op-sem-registry.ts      # 操作语义分类器
│   ├── plan-parser.ts          # LLM 计划解析器
│   ├── rule-definition.ts      # 规则类型定义
│   ├── rule-validator.ts       # 规则校验（命名/结构/值域）
│   ├── rule-quality-gate.ts    # 规则质量门禁
│   ├── rule-yaml-serializer.ts # 规则 YAML 序列化
│   ├── template-engine.ts      # 规则模板引擎（LLM schema 注入）
│   ├── rule-config.ts          # 规则配置
│   ├── safe-regex.ts           # ReDoS 防护正则
│   ├── clock.ts                # 时钟抽象（System/Virtual）
│   ├── date-utils.ts           # 日期工具
│   ├── logger.ts               # 日志
│   └── expr-tree/
│       ├── evaluator.ts        # 表达式树求值器（34 节点）
│       ├── simple-compiler.ts  # Simple 30 运算符 → 树编译
│       ├── s-expression.ts     # S-expression 解析
│       ├── node-types.ts       # 20 判别式 type
│       ├── fixed-point.ts      # 定点小数（scale=14 half-even）
│       ├── gloss.ts            # 自然语言可读投影
│       ├── grade.ts            # 规则分级（A/B/C）
│       ├── limits.ts           # 资源上限（分级）
│       ├── eval-trace.ts       # 求值追踪
│       ├── eval-warning.ts     # 求值警告
│       ├── canonical.ts        # 规范化（JCS）
│       ├── normalize.ts        # NFC 规范化
│       ├── rule-to-expr.ts     # when → 表达式树
│       └── decision-table.ts   # 决策表投影
├── guard/index.ts              # buildDecisionObject + generateAID
├── compliance/index.ts         # 合规画像（6 框架三层激活）
├── guidance/index.ts           # extractNavigationGuide
├── preflight/                  # ReAct 辅助（纠偏环/人工裁决/A/B 臂/信任标签）
├── knowledge/                  # 知识模块（类型/工具）
└── rules/
    ├── index.ts                # loadPresetRules + to* 转换
    ├── security.erdl.yaml      # 安全规则
    ├── compliance.erdl.yaml    # 合规规则
    └── integrity.erdl.yaml     # 职业道德规则

test/
├── *.spec.ts                   # 顶层模块测试（clock/core/fn-registry/...）
└── engine/
    ├── evaluator.spec.ts       # 规则求值器
    ├── expr-tree-evaluator.spec.ts  # 表达式树求值器
    ├── simple-compiler.spec.ts # Simple 编译映射
    ├── erdl-schema.spec.ts     # 单一事实源一致性
    ├── s-expression.spec.ts    # S-expression
    └── ...                     # 其余模块测试
```

---

## 本地开发

### 环境要求

- Node.js ≥ 22.13.0
- pnpm（本项目用 pnpm，`pnpm-lock.yaml`）

### 初始化

```bash
git clone https://github.com/OpenOBA/rulsynor-core.git
cd rulsynor-core
pnpm install
pnpm run build
pnpm test
```

### 开发命令

| 命令 | 用途 |
|------|------|
| `pnpm run build` | tsc 编译 + 复制规则 YAML 到 dist/ |
| `pnpm run typecheck` | 仅类型检查（`tsc --noEmit`） |
| `pnpm test` | 跑全部 640 测试 |
| `pnpm run dev` | 监听模式 |
| `pnpm run lint` | ESLint（严格规则） |
| `pnpm run format` | Prettier 自动修复 |
| `pnpm run format:check` | Prettier 校验 |
| `pnpm run release:check` | 全门禁（typecheck+lint+test+build） |

### 调试技巧

- **时钟注入**：`new GuardStateManager(new VirtualClock(t))` 控制 within/rate 测试；`clock.advance(ms)` 模拟时间流逝。
- **状态重置**：`stateManager.reset()` 隔离测试用例。
- **Playground**：`node dist/playground.js --tool=exec --cmd="rm -rf /"` 快速冒烟。

---

## 扩展点

### 运算符与节点（FREEZE-2 冻结）

34 节点 / 30 运算符**已冻结**（Spec v2.1 §5.3 `[FREEZE-2]`）——已发布节点不改语义、不减配。新增节点走**版本升级 + 破坏性变更审批**，不在当前基线内随时增补。

若确需新增节点，路径为：

1. `erdl-schema.ts` — 更新 `SEMANTIC_NODES` + `EXPR_NODE_TYPES`（同步 SPEC 母本）
2. `expr-tree/evaluator.ts` — 加节点求值编码
3. `expr-tree/simple-compiler.ts` — 若属 Simple 投影，加编译映射
4. `test/engine/erdl-schema.spec.ts` — 更新一致性断言
5. 同步 SPEC + 向量（跨仓：erdl-landing / erdl-vectors）

> 内核无法完整表达的逻辑，优先走**函数委派**（`fn-registry.ts`）而非新增节点——注册制 + 沙箱 + 确定性豁免声明 + 审计可溯。

### 新增决策类型

1. `erdl-schema.ts` — 更新 `DO_DECISIONS`（进 DO 的 13 种）或 `ALL_DECISIONS`（引擎内部 21 种）
2. `guard/index.ts` — 决策类型映射
3. `runtime.ts` — 工具执行分发 switch
4. README 决策表 + 测试用例

> 决策类型是「单一事实源」的一部分，改动必须同步 `SCHEMA_COUNTS` + SPEC §6。

### 新增合规法域

1. `compliance/index.ts` — 加 framework 注册（framework/version/jurisdiction）
2. 更新环境变量 `RULSYNOR_JURISDICTIONS` 的法域码
3. 同步 SPEC 14 框架清单（如属）

> 合规画像原则（Human Sovereignty）：框架不替用户猜法域，「未配置即未选择」，由部署方显式声明。

### 修改 Decision Object 字段

**原像规则**（哪些字段参与审计哈希）：

| 动作 | 字段 |
|------|------|
| **排除在原像外** | `audit.hash`、`signature`、`signing_key_id` |
| **包含在原像内** | 其余全部，含 `audit.previous_hash`、`audit.commitment`、`extensions` |

规则：
- 新增字段：默认进原像，更新 `buildDecisionObject()`。
- 删除字段：破坏既有审计链，仅允许 major 版本升级 + 迁移文档。
- JCS 原像在 `buildDecisionObject()` 内计算，改动删除逻辑必须同步审计验证测试。

---

## 测试策略

| 层 | 内容 |
|----|------|
| **单元** | `engine/*.spec.ts`：每模块一测（求值器/编译/序列化/校验/模板…） |
| **一致性** | `engine/erdl-schema.spec.ts`：单一事实源 25 条断言（运算符逐个真过编译器等） |
| **集成** | `core.spec.ts`：Decision Object 全流程 + 审计链 |
| **冒烟** | CI smoke：playground CLI DENY 断言 |

### 测试时序规则

```typescript
const clock = new VirtualClock(1000);
const sm = new GuardStateManager(clock);
const ev = new Evaluator(sm);

for (let i = 0; i < 3; i++) {
  ev.evaluate(ctx, rules);  // 计数在求值时自动记录
}
const result = ev.evaluate(ctx, rules);  // 第 4 次触发 within/rate DENY
expect(result.decision).toBe('DENY');
```

---

## 构建与发布

构建管线：`src/*.ts → tsc → dist/*.js + *.d.ts`；`src/rules/*.erdl.yaml → copy-rules.mjs → dist/rules/`。

发布流程见 [`../RELEASING.md`](../RELEASING.md)，版本策略见 [`../VERSIONING.md`](../VERSIONING.md)。当前版本线 `0.1.x`（alpha 阶段）。
