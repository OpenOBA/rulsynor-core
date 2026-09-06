# Roadmap — @openoba/rulsynor-core

> 版本路线遵循 [`VERSIONING.md`](./VERSIONING.md) 的生命周期阶段。
> 当前主线：**0.1.x**（引擎已对齐 ERDL Spec v2.1，DO 哈希模式已 v1.5，签名模式待完成）。

---

## 0.1.0-alpha（当前 · alpha 阶段）

**已达成**（引擎确定性内核）：

- [x] ERDL 表达式树内核：34 节点全量编码（10 组）
- [x] Simple 30 运算符（28 条件 + 2 修饰符 within/rate）
- [x] 25 字段 Decision Object（JCS + SHA-256 密码学审计）
- [x] 确定性内核单一事实源 `erdl-schema`（枚举 + `SCHEMA_COUNTS` 自证）
- [x] 定点小数（scale=14 half-even）+ 时间统一 UTC
- [x] Guard fail-close + 审计链锚定
- [x] 合规画像：14 框架 × 三层激活（法域/行业/风险）
- [x] GB/Z 185 AID 生成 + 导航引导 + 纠偏环 + REQUEST_HUMAN 解析
- [x] Minimal Chat Runtime（ReAct 环 + Guard + 工具执行）
- [x] Playground CLI
- [x] 655 测试
- [x] BSL 1.1 · 零框架依赖（仅 json-canonicalize + js-yaml）

## 0.1.0-beta（下一步 · beta 阶段）

- [ ] **Decision Object 签名模式**（哈希模式已对齐 v1.5 flat-hash；签名模式 ECDSA P-256 待完成，对齐 RFC-002 §10）
- [ ] 软件版本全生命周期管理落地（VERSIONING/RELEASING 已就位，补齐 CI 自动化发布）
- [ ] CI：GitHub Actions（lint/test/build 门禁 + npm 自动发布）
- [ ] 覆盖率提升至 80%+（补边界/异常分支）
- [ ] 公开测试 + 收口第三方反馈

## 0.1.0（stable）

- [ ] DO v1.5 完成冻结（`preimage_version` 定版）
- [ ] 无 P0/P1 缺陷 · 稳定期无回归
- [ ] 正式发布（`latest` tag）

## 0.2.x（minor · 功能扩展）

- [ ] `trustLabel()` / `parseToolCalls()` 完整实现（当前 stub）
- [ ] LangGraph 集成示例 + MCP server 集成指南
- [ ] 自定义业务规则热重载
- [ ] OpenTelemetry / Prometheus 指标导出
- [ ] 序列感知检测（多步攻击模式）

## 1.0.0（major · 完整稳定）

- [ ] 多 Agent 协作（对齐 SPEC 第十部分）
- [ ] 跨会话关联（跨任务风险检测）
- [ ] 蒸馏引擎（从审计历史自动优化规则）
- [ ] WASM 运行时（浏览器/边缘嵌入）

---

## 生命周期时间线

```
0.1.0-alpha ──▶ 0.1.0-beta ──▶ 0.1.0(stable) ──▶ 0.2.x ──▶ 1.0.0
   (当前)       (DO v1.5)      (正式发布)       (功能)    (完整稳定)
```
