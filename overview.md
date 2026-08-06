# 开源发布前优化概览

## 做了什么

对 `@rulsynor/core` 进行了开源发布前的叙事与实现对齐优化，重点修复 README 中无法运行的旗舰示例，并补齐代码中缺失的运算符、规则与元数据。

## 关键决策与修改

1. **修正 README 示例**：将 `toERDLRuleSet()` + `evaluate(rules, context)` 改为 `toCompiledRules()` + `evaluate(context, rules)`，新用户可直接复制运行。
2. **新增 `toCompiledRules()`**：在 `src/rules/index.ts` 中提供官方入口，把预设规则转成 `Evaluator` 消费的 `CompiledRule[]`。
3. **补齐运算符**：`SafeExprEvaluator`、`RuntimeEvaluator`、`RuleCompiler` 统一支持 `matches`、`neq`、`not_exists`、`not_contains`、`length_*`。
4. **修复静默失效规则**：将字符串上的 `gt` 改为 `length_gt`；新增 3 条规则，使总数达到宣传的 32 条。
5. **清理构建产物**：`copy-rules.mjs` 现在会先清空 `dist/rules/`，避免旧规则残留导致发布包膨胀到 35 条。
6. **Playground 输出真实替代建议**：从规则元数据中提取 `alternative`/`correction`， flagship 演示 `rm -rf /` 现在会给出具体可执行的替代方案。
7. **修正版本与仓库水印**：`provenance.ts` 与 `package.json` 对齐到 `2.0.0-alpha.1` 和 `rulsynor-core`。
8. **新增 bin 入口**：`package.json` 增加 `"@rulsynor/core"` bin，使 README 中的 `npx @rulsynor/core` 命令生效。

## 验证结果

- `npm run build` 通过
- `npx jest --passWithNoTests`：47 / 47 通过
- Playground 实际输出与 README 示例一致

## 后续建议

- 补充新增运算符的单元测试
- 为 32 条规则建立最小触发回归测试
- 增加 CI 步骤校验 `dist/rules/` 与 `src/rules/` 一致
- 添加 `CONTRIBUTING.md` 与决策对象字段文档
