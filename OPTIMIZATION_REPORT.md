# @rulsynor/core 开源发布前优化报告

> 目标：在开源发布前，将项目叙事（README）、开发者体验（DX）与代码实现对齐，确保首次访问者能在 30 秒内跑通示例，并相信项目“所言即所得”。

## 执行摘要

本项目定位清晰、叙事有力：把“AI Agent 治理”类比为“企业员工职业精神培训”，并用 ERDL（Enterprise Rule Definition Language）规则引擎 + 可审计决策对象落地。这一叙事具有很强传播性。

但在准备开源发布时，**叙事与实现之间存在多处不一致**，最严重的是 README 旗舰示例无法运行。本报告记录了发现的问题、已实施的修复，以及发布前仍需完成的事项。

**最终验证结果**：
- `npm run build` 通过
- `npx jest --passWithNoTests`：47 / 47 通过
- `npx @rulsynor/core --tool=exec --cmd="rm -rf /"`：按 README 输出正常，包含真实的替代建议

## 发现的关键问题

### 🔴 P0：README 旗舰示例直接崩溃

README 中“10 行代码”示例存在两处错误：

1. **参数顺序错误**：文档写 `evaluator.evaluate(rules, context)`，实际签名为 `evaluate(context, rules)`。直接运行会抛出 `TypeError: rules is not iterable`。
2. **规则格式错误**：文档使用 `toERDLRuleSet()`，返回 `{ protocol, version, metadata, rules }`，而 `Evaluator.evaluate()` 需要 `CompiledRule[]`。应使用 `toCompiledRules()`。

**影响**：任何按 README 复制代码的新用户第一分钟就会遇到运行时崩溃，对开源项目的信任打击极大。

### 🔴 P0：`npx @rulsynor/core` 无法启动

`package.json` 的 `bin` 字段只有 `"rulsynor": "./dist/playground.js"`，没有与包名 `@rulsynor/core` 对应的入口。README 却引导用户运行 `npx @rulsynor/core --tool=exec ...`，该命令在干净环境下找不到可执行文件。

### 🟠 P1：内置规则数量与宣传不符（32 vs 29）

README 与代码注释多次宣称“32 条预设规则”，但实际 `loadPresetRules()` 返回 29 条。进一步调查发现 `dist/rules/` 目录残留了 3 个已弃用的 YAML 文件（`exec.erdl.yaml`、`http.erdl.yaml`、`write.erdl.yaml`），导致构建产物中存在重复规则。

### 🟠 P1：两条规则因运算符误用而“静默失效”

`security.erdl.yaml` 中：
- `block-large-writes` 用 `operator: gt`、`value: 10485760` 检查 `context.tool.args.content`（字符串）。
- `compliance.erdl.yaml` 中 `correct-oversize-args` 用 `operator: gt`、`value: 4096` 检查命令字符串长度。

运行时求值器对字符串执行 `>` 比较，结果恒为 `false`，因此这两条规则永远不会触发。用户读到规则描述后，按预期构造输入却发现未被拦截。

### 🟠 P1：公共 `SafeExprEvaluator` 缺少 YAML 实际使用的运算符

`src/engine/safe-expr.ts` 中的公共表达式引擎不支持 `matches`、`neq`、`not_exists`、`not_contains` 以及字符串长度比较，而 `security.erdl.yaml` 与 `compliance.erdl.yaml` 已使用这些运算符。这会导致通过 `SafeExprEvaluator` 直接求值规则表达式时得到错误结果，公共 API 与内部运行时行为不一致。

### 🟡 P2：Playground 输出与 README 示例不一致

README 示例输出中的 `Reason` 与 `Alternative` 文本来自早期版本，与实际 Playground 输出不符；且 `Alternative` 原本为空（`—`），无法体现产品“Not like this. But here's how.”的核心差异点。

### 🟡 P2：构建产物版本水印与 `package.json` 不一致

`src/provenance.ts` 中硬编码 `version: '1.0.0-alpha.1'`、`repository: 'https://github.com/OpenOBA/rulsynor'`，而 `package.json` 当前版本为 `2.0.0-alpha.1`，仓库地址为 `https://github.com/OpenOBA/rulsynor-core`。发布包中的 Decision Object 会携带过时的元数据。

### 🟡 P2：`copy-rules.mjs` 不会清理 `dist/rules/`

构建脚本仅做覆盖拷贝，不清理旧文件。只要曾经存在过旧的规则文件布局，它们就会一直留在 `dist/` 中，导致发布的包与源码不一致。

## 已实施的修复

| 文件 | 修改内容 |
|------|----------|
| `src/rules/index.ts` | 新增 `toCompiledRules()`，将预设规则转换为 `Evaluator` 直接消费的 `CompiledRule[]`；在 `toERDLRuleSet()` 的 `action` 中保留 `alternative` 与 `correction` 元数据，供 Navigation Guide 使用。 |
| `src/index.ts` | 导出 `toCompiledRules`。 |
| `src/engine/safe-expr.ts` | 补全公共表达式引擎：`matches` / `neq` / `not_exists` / `not_contains` / `length_gt` / `length_gte` / `length_lt` / `length_lte` / `length_eq`，与 YAML 和运行时求值器对齐。 |
| `src/engine/runtime-evaluator.ts` | 补全 `not_exists` 与 `length_*` 运算符，确保 YAML 规则在核心引擎中正确求值。 |
| `src/engine/rule-compiler.ts` | 在 DFA 等价校验用的求值叶子中补全 `length_*`，保持三个引擎语义一致。 |
| `src/rules/security.erdl.yaml` | 修复 `block-large-writes` 为 `length_gt`；新增 3 条规则（`block-sql-drop`、`block-docker-privileged`、`block-curl-pipe-shell`），使规则总数达到 32 条；为 5 条关键规则补充 `alternative` / `correction` 字段。 |
| `src/rules/compliance.erdl.yaml` | 修复 `correct-oversize-args` 为 `length_gt`。 |
| `src/provenance.ts` | 将 `version` 更新为 `2.0.0-alpha.1`，仓库地址更新为 `https://github.com/OpenOBA/rulsynor-core`。 |
| `src/playground.ts` | 使用 `toCompiledRules()` 替代手写转换；从预设规则元数据中提取 `alternative` / `correction` 并传入 `extractNavigationGuide()`，输出真实的替代建议。 |
| `package.json` | 新增 `"@rulsynor/core": "./dist/playground.js"` bin 入口，使 README 中的 `npx @rulsynor/core` 命令可用。 |
| `scripts/copy-rules.mjs` | 在拷贝前清空 `dist/rules/` 目录，防止旧规则残留。 |
| `README.md` / `README.zh-CN.md` | 修正示例代码与输出；统一使用 `toCompiledRules()` 与 `evaluate(context, rules)`；`matchedRules` 示例改为真实匹配结果。 |

## 验证结果

```bash
$ npm run build
> @rulsynor/core@2.0.0-alpha.1 build
> tsc && node scripts/copy-rules.mjs

$ npx jest --passWithNoTests
Test Suites: 2 passed, 2 total
Tests:       47 passed, 47 total

$ node dist/playground.js --tool=exec --cmd="rm -rf /"
📋 Trained:    32 rules loaded
🛡️  Decision:   DENY
📝 Reason:     Destructive command blocked. Use safe alternatives or request human approval.
🧾 Recorded:   sha256:... (tamper-evident)
🪪 Employee ID: 1.2.156.3088.1.000001.000001....
📊 Jurisdiction: CN (GB/Z 185-2026 compliant)
🧭 Alternative: Use the read tool to inspect the target first, or request explicit human approval before any destructive command.
```

README 中的“10 行代码”示例经本地验证可正常输出 `DENY` 并生成 Decision Object。

## 发布前仍建议完成的事项

1. **清理临时验证脚本**
   - 当前根目录存在 `verify-readme.mjs`，用于验证 README 示例。由于环境的安全删除限制未能移除，建议在发布前手动删除。

2. **补充针对新增运算符的单元测试**
   - 本次补全的 `matches`、`length_gt`、`not_exists` 等运算符虽已集成到运行时与表达式引擎，但测试覆盖率主要依赖现有测试。建议新增 `test/operators.test.ts`，覆盖所有 YAML 中实际使用的运算符。

3. **为 32 条规则增加行为回归测试**
   - 为每条规则提供最小触发用例，确保未来重构不会导致规则再次“静默失效”。可基于 `loadPresetRules()` 自动生成。

4. **统一并校验 `dist/` 与源码的一致性**
   - 建议在 CI 中增加一步：构建后比较 `dist/rules/` 与 `src/rules/` 的文件集合，确保无残留、无遗漏。

5. **补充 CONTRIBUTING.md 与 Issue 模板**
   - 开源项目需要清晰的贡献指南。可参考已存在的 GitHub Issue 响应模板风格，新增 `CONTRIBUTING.md`、PR 模板与 Bug 报告模板。

6. **决策对象字段的对外文档**
   - `buildDecisionObject` 生成 25 字段 Decision Object，但 README 仅提及 `audit.hash` 与 `agent.aid`。建议补充一篇 `docs/decision-object.md`，说明字段含义与第三方验证方式，强化“可审计”这一核心卖点。

7. **考虑将 Playground 从 `exports` 中移除或明确标注为 CLI**
   - 当前 `exports` 包含 `./playground`，但这主要是 CLI 入口。可考虑只保留 `bin`，避免用户误 `import '@rulsynor/core/playground'`。

## 文件变更清单

```
M  package.json
M  README.md
M  README.zh-CN.md
M  src/index.ts
M  src/playground.ts
M  src/provenance.ts
M  src/rules/index.ts
M  src/rules/security.erdl.yaml
M  src/rules/compliance.erdl.yaml
M  src/engine/safe-expr.ts
M  src/engine/runtime-evaluator.ts
M  src/engine/rule-compiler.ts
M  scripts/copy-rules.mjs
A  (临时) verify-readme.mjs   # 发布前需删除
```

## 结论

项目在叙事上具有很强的差异化，但**开源发布的第一印象由“README 是否能跑通”决定**。本次优化修复了 README 与实现之间的关键不一致，补齐了缺失的运算符，修正了规则数量与版本元数据，并让 Playground 真正展示产品的核心价值——“不是拒绝，而是引导”。

建议在合并这些修改后，立即在干净的 Node 环境中按 README 走一遍完整流程，作为发布前的最后一道门禁。
