# rulsynor-core 架构与开源决策

> 版本：1.0 · 2026-08-29
> 决策人：OpenOBA 维护者
> 性质：core 正式版上线的架构与开源边界权威文档
> 变更：2026-09-03 — 预设规则数 30→34（跨工具安全规则按工具拆分 + 补 tool.name 约束）

---

## 一、定位：完整 runtime，不是薄内核

**rulsynor-core 是一个完整的确定性 Agent runtime，不是一个内核库。**

OpenOBA 是「企业的 AI 执行官」，核心能力是「执行 + 护栏 + 审计」——这就是一个完整 runtime。用户装一个包，就能跑一个带确定性护栏、每一步可审计的 Agent。

```
CORE（完整 runtime，一个包）
├─ 确定性内核（心脏）       ← 表达式树 + 30 运算符 + gloss + DO 哈希，确定、可验证
├─ Guard 集成               ← 把内核接到执行循环，确定
├─ 执行脚手架               ← ReAct + 工具 + SSE，非确定（通用）
├─ 知识/引导                ← RAG + 导航，非确定（通用）
└─ 审计接口 AuditRecorder   ← 注入 DO 生成（私有）
```

**「确定性架构，而非 Prompt 工程」的准确含义**：不是「整个 runtime 都确定」，而是——LLM 的思考非确定，但它的「行动」被 Guard 确定性约束，「记录」被 DO 确定性约束。护栏和审计是确定的，这就够了。

---

## 二、开源边界

| 层 | 内容 | 许可证 |
|---|---|---|
| **确定性内核** | 34 节点表达式树 + 30 运算符 + gloss + decision-table + ExprTreeEvaluator + 定点小数 + 安全正则 + 223 向量 | BSL 1.1 |
| **验证工具** | `audit-verify` CLI + DO 规范 + 78 条冻结向量 | MIT（audit-verify）/ Apache-2.0（erdl-vectors） |
| **运行时框架** | ReAct + 工具引擎 + Guard 集成 + CORRECT 状态机 + 知识/引导 | BSL 1.1 |
| **前端（基本能力，全量开源）** | era-chat / 规则 / 工具 / 审计 / MCP / 侧边栏 / 侧边栏底部折叠栏 / chat 文件解析 / 产物交付 | MIT |
| **DO 生成**（buildDecisionObject v1.5） | 字段组装 + 合规画像 + JUR 裁剪 + 法域映射 | **私有**（License Key） |
| **合规画像**（14 框架） | 完整法域合规映射 | **私有**（Enterprise） |
| **行业蓝图**（ERP/OA/CRM） | 预置业务规则 | **私有**（Rule Store） |
| **前端（合规/企业）** | 合规设置、团队管理、报告导出、rule store 写端后台 | **私有**（Enterprise） |

**关键解耦**：运行时框架（BSL 1.1）不硬编码 DO 生成，注入审计钩子接口：

```ts
interface AuditRecorder {
  record(decision: string, ctx: GuardContext): { hash: string }
}
// 开源用户：自己实现（简单 hash）；付费用户：私有 buildDecisionObject（License Key 注入）
```

---

## 二·五、开箱即用（前端同步释放）

**目标：一条命令跑完整闭环，开发者装完立即能用，不用拼装。**

```bash
npx @openoba/rulsynor-core init   # 初始化项目
npm install
npm run dev                       # 同时起 runtime + 前端 + 34 预设规则
# → 浏览器 localhost:3000，立即能：
#   ① 写规则（era 创作工具，NL → ERDL）
#   ② 跑 Agent（runtime，带确定性护栏）
#   ③ 看审计（Dashboard，DO + 审计链，可离线验签）
```

- **前端与 core 同步释放**：以下 9 个基本能力模块与 core 同一版本号、同一发布节奏，不滞后。

**前端开源清单（基本能力，全部交付）**：

| # | 模块 | 说明 |
|---|---|---|
| 1 | **era-chat** | Agent 对话工作台（ReAct 时间线、SSE 流式） |
| 2 | **规则** | 规则管理 / 创作（NL → ERDL） |
| 3 | **工具** | 工具管理 / 注册 |
| 4 | **审计** | DO + 审计链查看 + 离线验签 |
| 5 | **MCP** | MCP server 管理 / 集成 |
| 6 | **侧边栏** | 导航 |
| 7 | **侧边栏底部折叠栏** | 折叠区 |
| 8 | **chat 区文件解析** | parse_pdf/excel/docx + 附件内联处理 |
| 9 | **产物交付** | deliverable 交付（提案/导出/执行总结） |

- **私有前端（不进开源包）**：合规设置、团队管理、报告导出、rule store 写端后台。

---

## 三、moat 分析

**框架不是 moat，内容是 moat。**

| 资产 | moat | 原因 |
|---|---|---|
| 运行时框架 | ❌ | 通用脚手架，人人都有 |
| ERDL 规则格式 | ❌ | MIT，任何人可独立实现 |
| **确定性内核** | ✅ 差异化 | 「确定性架构」的载体 |
| **规则内容**（行业蓝图 + 合规映射） | ✅ 核心 | 领域 know-how |
| **合规审计信任** | ✅ | 第三方可验证，对手没有 |
| **网络效应** | ✅ | 越多人用越强 |

行业先例：Terraform（Registry）、Ansible（Galaxy）、Docker（Hub）、npm（registry）——**引擎开源，内容/生态锁定。**

---

## 四、Rule Store 架构（内容 moat）

### 4.1 三层架构

```
开源 runtime（BSL 1.1，无密钥）
   │ ① 登录 cloud.openoba.com 拿 account token（opaque，绑定 device）
   │ ② 带 token 调 RuleSource 拉规则
   ▼
rule.openoba.com（规则分发，读端，私有）
   │ ③ 委托 cloud.openoba.com 验证 token → 账户 + 订阅层级
   │ ④ 按层级返回规则（Ed25519 签名 + 版本 + 水印）
   ▼
cloud.openoba.com（云端中台，写端 + 账户/订阅单一事实源）
```

### 4.2 认证：opaque token（有状态，可撤销），不是 JWT

- token = 随机串，中台 DB 存 hash，绑定 device instance id
- access token 24h + refresh token 30 天；退订/封禁 → 立即失效
- 为什么不用 JWT：订阅场景必须能「立即撤销」，JWT 无状态撤销难

### 4.3 规则完整性：Ed25519 非对称签名，不是 HMAC

- rule.openoba.com 私钥签名（HSM/离线），runtime 内置公钥验签
- 为什么不用 HMAC：HMAC 共享密钥，runtime 开源则密钥泄露
- 公钥轮换：私钥泄露 → /meta 端点下发新公钥

### 4.4 离线 + 降级 + 防时钟回滚

- 规则带 signedIssuedAt + 有效期；runtime 缓存 + `lastSeenServerTime` 锚定
- 本地时间 < lastSeenServerTime → 判时钟回滚 → 拒用缓存、强制回源
- 离线宽限：Pro token 到期 7 天宽限，超期降级 Free

### 4.5 诚实边界

规则是「内容」，一旦给到付费用户，**技术无法 100% 防复制**（npm/Docker/Ansible 同理）。靠「版权 + 水印溯源 + 拉取审计 + 品牌 + 网络效应」软守，不靠「加密」（runtime 开源，加密密钥泄露）。

---

## 五、域名规范

**原则：一个服务 = 一个 subdomain，禁用 path 嵌套。** 禁写 `openoba.com/cloud`、`openoba.com/api/...`。

| 域名 | 服务 | 职责 |
|---|---|---|
| `openoba.com` / `www.openoba.com` | 官网 | 品牌门户（英文） |
| `openoba.cn` | 官网 | 品牌门户（中文） |
| **`cloud.openoba.com`** | 云端中台 | 账户 / 订阅 / 认证 / License / LLM 代理 / 模型 / 升级 / 遥测 / 规则策展后台（写端 + 单一事实源） |
| **`rule.openoba.com`** | 规则分发 | 规则拉取（runtime 读端） |

- runtime 端点：登录/认证 → `cloud.openoba.com/auth/...`；拉规则 → `rule.openoba.com/v1/rules`；License 验证 → `cloud.openoba.com/license/verify`

---

## 六、分层授权

| 层 | 价格 | 包含 | 授权 |
|---|---|---|---|
| **L0 开源** | $0 | 确定性内核 + 验证工具 + 运行时框架 + 34 预设规则 | BSL 1.1（非生产免费） |
| **L1 Free** | $0 永久 | L0 + 无限个人本地规则 | 免费注册 |
| **L2 Pro** | $9.99/月 | + 行业蓝图 + 团队规则共享 + 完整 DO 生成 + 审计导出 | License Key |
| **L3 Enterprise** | 合同 | + 合规包（14 框架）+ 私有 Rule Store + SLA + SSO | 合同 |

**核心：源码可见，能力分层，信任换收入。** 34 预设规则匿名可拉（「不割韭菜」的技术落点），高价值规则（蓝图/合规）靠账户 + 订阅门禁。

---

## 七、落地路线图

1. **S1**：运行时框架从 `buildDecisionObject` 解耦（注入 `AuditRecorder` / `RuleSource` 接口）
2. **S2**：core 剥离/停更 DO 生成，只留「确定性内核 + Guard 求值 + 验证」
3. **S3**：版本号规划（试水 1.0.0 → 正式版，建议 `2.0.0` 避免与已发布 1.0.0 冲突；后续实际采用**延续线 `1.1.0`**，见 VERSIONING.md）
4. **S4**：Rule Store（`rule.openoba.com`）+ 中台（`cloud.openoba.com`）+ 分层授权落地
5. **S5**：商标注册 + 内容版权 + 规则签名（Ed25519）+ 拉取审计
6. **S6**：前端同步释放（era 创作 + dashboard）→ 开箱即用一条命令
7. **S7**：对外叙事更新（开放框架 + 内容 moat + 开箱即用）

---

## 八、版本历史

- `@openoba/rulsynor-core` v1.0.0（2026-08-07）为早期预览版，已被 `1.1.0` 取代。
- `1.1.0` 是延续版本线上的第一个正式发布（见 [`VERSIONING.md`](./VERSIONING.md) §6）。

---

> 本文档是 rulsynor-core 正式版架构与开源边界的权威来源。
> 任何偏离必须经维护者共同确认并更新。
> OpenOBA · 2026-08-29

## 参见

- [DEVELOPMENT.md](DEVELOPMENT.md) — 本地开发与扩展点
- [API.md](API.md) — 引擎公开 API
- [SPEC/erdl-language-spec-v2.1.md](SPEC/erdl-language-spec-v2.1.md) — ERDL 语言规范
