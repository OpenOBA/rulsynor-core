# Roadmap — @openoba/rulsynor-core

> 版本路线遵循 [`VERSIONING.md`](./VERSIONING.md) 的生命周期阶段。
> 当前主线：**1.x**（版本延续自 1.0.0；引擎已对齐 ERDL Spec v2.1，DO 哈希模式已 v1.5，签名模式待完成）。

---

## 1.1.0（当前 · stable）

**已达成**（引擎确定性内核）：

- [x] ERDL 表达式树内核：34 节点全量编码（10 组）
- [x] Simple 30 运算符（28 条件 + 2 修饰符 within/rate）
- [x] Decision Object v1.5 扁平哈希（JCS + SHA-256 密码学审计）
- [x] 确定性内核单一事实源 `erdl-schema`（枚举 + `SCHEMA_COUNTS` 自证）
- [x] 定点小数（scale=14 half-even）+ 时间统一 UTC
- [x] Guard fail-close + 审计链锚定
- [x] 合规画像：14 框架 × 三层激活（法域/行业/风险）
- [x] GB/Z 185 AID 生成 + 导航引导 + 纠偏环 + REQUEST_HUMAN 解析
- [x] 开箱即用 CLI（chat / setup / rules / audit / mcp / demo）
- [x] CORRECT 3 轮纠正循环接入运行时
- [x] 审计持久化（SQLite）+ 用户规则目录加载
- [x] 655 测试
- [x] BSL 1.1 · 零框架依赖（仅 json-canonicalize + js-yaml）

## 1.2.0（下一步 · minor）

- [ ] **Decision Object 签名模式**（哈希模式已对齐 v1.5 flat-hash；签名模式 ECDSA P-256 待完成，对齐 RFC-002 §10）
- [ ] CI：GitHub Actions（lint/test/build 门禁 + npm 自动发布）
- [ ] 覆盖率提升至 80%+（补边界/异常分支）
- [ ] 公开测试 + 收口第三方反馈

## 1.3.x（minor · 功能扩展）

- [ ] `trustLabel()` / `parseToolCalls()` 完整实现（当前 stub）
- [ ] LangGraph 集成示例 + MCP server 集成指南
- [ ] 自定义业务规则热重载
- [ ] OpenTelemetry / Prometheus 指标导出
- [ ] 序列感知检测（多步攻击模式）

## 2.0.0（major · 完整稳定）

- [ ] 多 Agent 协作（对齐 SPEC 第十部分）
- [ ] 跨会话关联（跨任务风险检测）
- [ ] 蒸馏引擎（从审计历史自动优化规则）
- [ ] WASM 运行时（浏览器/边缘嵌入）

---

## 生命周期时间线

```
1.0.0 ──▶ 1.1.0 ──▶ 1.2.0 ──▶ 1.3.x ──▶ 2.0.0
(试水)   (当前)   (DO v1.5签名) (功能)   (完整稳定)
```

> 说明：`1.0.0`（2026-08-07）是引擎未对齐 Spec v2.0 时的过早发布，已废弃；`1.1.0` 延续版本线，取代 `1.0.0`。
