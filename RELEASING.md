# 发布流程（Releasing）

> 发布 `@openoba/rulsynor-core` 的完整步骤与门禁。所有发布必须走本流程，禁止跳过门禁。
> 版本号规则见 [`VERSIONING.md`](./VERSIONING.md)。

---

## 1. 发布前 Checklist

发布前逐项确认：

- [ ] `pnpm run release:check` 全绿（typecheck + lint + test + build 四道门禁）
- [ ] `pnpm run format:check` 通过（Prettier 无格式漂移）
- [ ] CHANGELOG 已按 [Keep a Changelog](https://keepachangelog.com/) 更新（`Added/Changed/Deprecated/Removed/Fixed/Security`）
- [ ] 版本号已提升（`package.json` `version` 字段）
- [ ] 公共 API 变更已在 CHANGELOG `Changed`/`Removed` 声明（如有 breaking）
- [ ] 无未提交改动（`git status` clean）
- [ ] README / 文档同步更新（如 API 变更）

---

## 2. 发布步骤

```bash
# ① 版本号提升（示例：0.1.0-alpha → 0.1.0-beta）
#    编辑 package.json 的 version 字段

# ② 更新 CHANGELOG（将 [Unreleased] 段重命名为新版本号）

# ③ 全量门禁（prepublishOnly 会自动再跑一遍）
pnpm run release:check
pnpm run format:check

# ④ 构建产物
pnpm run build

# ⑤ 干跑检查打包内容
npm pack --dry-run

# ⑥ git 提交 + 打 tag
git add -A
git commit -m "chore(release): v0.1.0-beta"
git tag v0.1.0-beta

# ⑦ 推送到 GitHub
git push origin master
git push origin --tags

# ⑧ 发布到 npm
npm publish          # 正式版
# npm publish --tag next   # 预发布版（alpha/beta/rc 用 next tag）
```

> **预发布 tag 约定**：`alpha`/`beta`/`rc` 用 `npm publish --tag next`，这样 `npm install` 默认不装预发布版，用户需显式 `npm install @openoba/rulsynor-core@next`。

---

## 3. 发布后验证

发布完成后：

- [ ] `npm view @openoba/rulsynor-core version` 返回新版本号
- [ ] 干净环境 `npm install @openoba/rulsynor-core` 能装且可 import
- [ ] 冒烟测试：`node dist/playground.js` 正常运行
- [ ] GitHub Release 页已创建（附 CHANGELOG 摘要 + 产物）

---

## 4. 门禁说明

| 门禁 | 命令 | 拦截什么 |
|------|------|---------|
| 类型检查 | `pnpm run typecheck` | TS 类型错误 |
| Lint | `pnpm run lint` | 代码规范 + `as any`/`ts-ignore` 违规 |
| 测试 | `pnpm test` | 639 测试回归 |
| 构建 | `pnpm run build` | tsc 编译 + 规则产物复制 |
| 格式 | `pnpm run format:check` | Prettier 格式漂移 |

`prepublishOnly` 钩子已绑定 `release:check`，`npm publish` 前自动执行四道门禁，任一失败则中止发布。

---

## 5. 回滚

- **npm 撤回**：发布后 72 小时内可 `npm unpublish @openoba/rulsynor-core@<version>`（正式版不建议）；超时后只能发新版本修复，不能删除。
- **git 回滚**：`git revert <commit>` 或打补丁版本 `0.1.x` 修复。

> npm 与 PyPI 不同：npm 版本号**不可覆盖**（同号不能重发），发错只能升号。
