# OpenOBA 隐私政策 — 中英对照版
# OpenOBA Privacy Policy

> 版本 Version: 1.0 | 生效 Effective: 2026-06-10
> 数据处理者 Data Controller: 深圳市秒镜科技有限公司
> 联系方式 Contact: **postmaster@openoba.com**
> 完整 DPO 信息见 / Full DPO information: [DPO-APPOINTMENT.md](./DPO-APPOINTMENT.md)
> 遥测补充说明见 / See also: [TELEMETRY.md](./TELEMETRY.md)

---

## 第一部分：中文版（正本）

> 本政策**符合**《中华人民共和国个人信息保护法》(PIPL) 第 13、14、17、30、44-50 条与 **GDPR Articles 5, 6, 13, 14, 15-22, 28, 30, 32, 37**。

### 一、数据处理者

**深圳市秒镜科技有限公司**  
**统一社会信用代码**：91440300MAK2KM7J4X  
**注册地址**：中国广东省深圳市南山区  
**联系方式**：**postmaster@openoba.com**

### 二、个人信息保护负责人（DPO）

| 项目 | 内容 |
|------|------|
| 姓名 | **唐启鑫**（2026-06-15 公示） |
| 职务 | 数据保护官 (Data Protection Officer) |
| 邮箱 | postmaster@openoba.com |
| 电话 | +86 18026993237 |
| 工作时间 | 工作日 09:00-18:00 (GMT+8) |
| 详细公示 | [DPO-APPOINTMENT.md](./DPO-APPOINTMENT.md) |

### 三、本政策适用范围

本政策适用于您与我们之间因以下行为产生的个人信息处理：

1. **下载、安装、使用 OpenOBA 软件**（openoba-starter monorepo，含 packages/core/（BSL 1.1）、packages/backend/（MIT）、frontend/（MIT））；
2. **访问 OpenOBA 官方网站**（openoba.com 及子域）；
3. **注册账户、申请 License Key、提交 Bug、提交 Pull Request**；
4. **订阅邮件列表、参加社区活动**；
5. **联系我们**（含邮件、电话、社交媒体、GitHub Issue）。

### 四、我们收集哪些个人信息、为什么收集

| 场景 | 个人信息 | 目的 | 法律基础 | 保留期 |
|------|----------|------|----------|--------|
| **账户注册** | GitHub OAuth ID、邮箱、用户名 | 身份验证、CLA 签署 | PIPL 13(2)/GDPR 6(1)(b) 合同 | 账户存续期 + 5 年 |
| **CLA 签署** | GitHub ID、IP、时间戳、贡献范围 | 法律凭证 | PIPL 13(2)/GDPR 6(1)(b) 合同 | **永久**（证据保存） |
| **License Key 申请** | 公司英文名、统一社会信用代码、邮箱、营收规模 | 商业合同、发票 | PIPL 13(2)/GDPR 6(1)(b) 合同 | 合同期 + 7 年（依会计档案） |
| **遥测（opt-in）** | 部署 ID 哈希、版本、功能使用计数、错误类型 | 产品改进 | PIPL 13(1)/GDPR 6(1)(a) 同意 | **90 日**（自采集日） |
| **遥测同意凭证** | 弹窗选择、时间戳、IP | 合规证据 | PIPL 13(2)/GDPR 6(1)(c) 法律义务 | **3 年** |
| **访问官网** | IP、UA、Referer | 访问分析、安全防护 | PIPL 13(1)/GDPR 6(1)(a) 同意（Cookie 弹窗） | 30 日 |
| **Newsletter 订阅** | 邮箱 | 营销 | PIPL 13(1)/GDPR 6(1)(a) 同意 | 退订后 30 日 |
| **安全漏洞报告** | 报告者邮箱、IP、姓名（自愿） | 漏洞修复 | PIPL 13(2)/GDPR 6(1)(b) 合同 | 漏洞修复后 90 日 |
| **CoC 违规举报** | 举报者信息（可匿名）、被举报者信息 | 社区治理 | PIPL 13(2)/GDPR 6(1)(c) 法律义务 | 案件结束后 3 年 |
| **客服沟通** | 邮箱、电话、问题描述 | 客户支持 | PIPL 13(2)/GDPR 6(1)(b) 合同 | 最后联系后 2 年 |

### 五、我们绝不收集

- ❌ **业务数据**：客户订单、商品价格、库存、销售数据
- ❌ **内容数据**：ERDL 规则定义、Agent 对话内容、用户提示、模型回复
- ❌ **敏感个人信息**（PIPL 第 28 条 / GDPR Article 9）：生物特征、宗教信仰、特定身份、医疗健康、金融账户、行踪轨迹
- ❌ **14 周岁以下儿童**的个人信息

### 六、Cookie 与同类技术

6.1 我们仅在以下场景使用 Cookie / localStorage：
- （1）**严格必要 Cookie**：会话保持、CSRF Token、登录态（**无需同意**）；
- （2）**遥测同意凭证**（opt-in 弹窗选择，**无需同意**）；
- （3）**分析 Cookie**：Google Analytics 4（**需明确同意**，首次访问弹窗）。

6.2 我们**不**使用第三方广告 Cookie、社交媒体追踪 Pixel、再营销 Cookie。

6.3 Cookie 详细清单：[https://openoba.com/legal/cookies](https://openoba.com/legal/cookies)

### 七、我们如何共享您的信息

7.1 我们**不出售**（PIPL/GDPR/CCPA 全部语境下）任何个人信息。

7.2 我们**仅在以下情况**共享：

| 接收方 | 场景 | 数据范围 | 法律基础 |
|--------|------|----------|----------|
| **腾讯云** | 遥测存储、数据库 | 全部遥测 | DPA / GDPR Art 28 |
| **AWS** | 备份、灾备 | 备份遥测 | DPA / GDPR Art 28 |
| **Postmark / SendGrid** | 邮件发送 | 仅邮箱 | DPA / GDPR Art 28 |
| **GitHub** | 账户、Issue、PR、Advisory | 您主动提交的内容 | 您与 GitHub 之间的协议 |
| **支付服务（如 Stripe）** | License Key 付费 | 仅支付必要信息 | DPA |
| **司法机关** | 法定查询、刑事侦查 | 法定范围内 | 法律义务 |
| **监管机构** | 监督检查、GDPR 投诉响应 | 法定范围内 | 法律义务 |
| **收购方** | 公司并购、重组 | 全部个人信息 | PIPL 20/21、GDPR Art 6(1)(f)（合法利益） |

7.3 **DPA 全文**：[https://openoba.com/legal/dpa](https://openoba.com/legal/dpa)  
**Sub-Processor 清单**：[https://openoba.com/legal/sub-processors](https://openoba.com/legal/sub-processors)（**30 日变更预告**）

### 八、跨境数据传输

8.1 我们的**主服务器**位于**中国深圳（腾讯云）**，主处理在境内。

8.2 我们的**备份服务器**位于**新加坡（AWS）**。**中国大陆用户**的数据不传输至境外；**境外用户**数据就近处理。

8.3 计划 **2026-Q4** 启用**欧盟节点**（法兰克福 AWS）。

8.4 **跨境传输机制**：
- （1）**SCC（标准合同条款）2021/914**（欧盟用户）；
- （2）**个人信息保护认证**（PIPL 第 38 条）；
- （3）**安全评估**（CACP 联合工作组发布标准）。

8.5 跨境传输详细说明：[https://openoba.com/legal/data-transfer](https://openoba.com/legal/data-transfer)

### 九、您的数据主体权利

#### 9.1 PIPL 权利

| 权利 | 说明 | 行使方式 | 响应时间 |
|------|------|----------|----------|
| 知情权 | 了解处理情况 | 本政策 | 即时 |
| 决定权 | 同意、拒绝、撤回 | 关闭遥测 / 联系 DPO | 立即 / 7 日内 |
| 查询、复制权 | 获取您的个人信息 | postmaster@openoba.com | 30 日内 |
| 更正、补充权 | 更正不准确信息 | postmaster@openoba.com | 30 日内 |
| 删除权 | 删除您的信息 | postmaster@openoba.com | 30 日内 |
| 解释权 | 要求处理规则说明 | postmaster@openoba.com | 30 日内 |

#### 9.2 GDPR 权利

| 权利 | 说明 | 响应时间 |
|------|------|----------|
| Access (Art 15) | 访问您的数据 | 1 个月 |
| Rectification (Art 16) | 更正 | 1 个月 |
| Erasure / "Right to be forgotten" (Art 17) | 删除 | 1 个月 |
| Restriction of processing (Art 18) | 限制处理 | 1 个月 |
| Data portability (Art 20) | 可携 | 1 个月 |
| Object (Art 21) | 反对 | 即时 |
| Automated decision-making (Art 22) | 拒绝自动化决策 | 不适用 |
| Lodge complaint (Art 77) | 向监管机构投诉 | — |
| Withdraw consent (Art 7(3)) | 撤回同意 | 7 日内 |

#### 9.3 CCPA / CPRA 权利（加州用户）

| 权利 | 说明 |
|------|------|
| Right to Know | 知情权 |
| Right to Delete | 删除权 |
| Right to Opt-Out of Sale | **我们不出售**，链接仍公示于 [https://openoba.com/do-not-sell](https://openoba.com/do-not-sell) |
| Right to Non-Discrimination | 不因行使权利而歧视 |
| Right to Correct | 更正权 |
| Right to Limit Use of Sensitive PI | 限制敏感信息使用（不适用，我们不收集） |

### 十、安全措施

我们采取**业界领先**的安全措施：

1. **传输加密**：TLS 1.3+，HSTS 强制
2. **存储加密**：AES-256（数据库静态加密）
3. **密码哈希**：Argon2id（首选）/ bcrypt (cost ≥ 12）
4. **访问控制**：RBAC + 最小权限原则
5. **审计日志**：保留 ≥ 180 日
6. **备份**：每日全量 + 6 小时增量，加密异地存储
7. **漏洞管理**：见 [SECURITY.md](./SECURITY.md)
8. **员工培训**：每季度信息安全培训 + 签署保密协议

### 十一、未成年与儿童

11.1 OpenOBA **不针对 14 周岁以下儿童**。我们**不会故意**收集 14 周岁以下儿童的个人信息。

11.2 如发现 14 周岁以下儿童的个人信息被收集，我们将在 **7 个工作日内删除**。

11.3 如您是 14-18 周岁未成年人，请在**父母或监护人陪同**下使用 OpenOBA。

### 十二、自动化决策与画像

我们**不使用**您的个人信息进行自动化决策或用户画像（PIPL 第 24 条 / GDPR Article 22）。

### 十三、本政策的变更

13.1 本政策的修订**至少提前 30 日**在官网公告。

13.2 **实质性变更**（如新增收集项、改变用途、跨境传输机制变更、第三方处理者变更）将需要**重新获取同意**。

13.3 本政策的版本号、变更记录：[https://openoba.com/legal/privacy-changelog](https://openoba.com/legal/privacy-changelog)

### 十四、争议与申诉

14.1 您有权**通过 postmaster@openoba.com** 提交申诉。

14.2 申诉处理 SLA：7 个工作日内首次回复，30 个工作日内处理完毕。

14.3 您可向**所在地的个人信息保护监管机构**投诉（中国用户：网信办 / 行业主管部门；欧盟用户：当地数据保护机构；美国用户：FTC / 州 Attorney General）。

14.4 中国**国家网信办**：[www.cac.gov.cn](https://www.cac.gov.cn)  
欧盟数据保护委员会（EDPB）：[edpb.europa.eu](https://edpb.europa.eu)

### 十五、准据法

本政策**适用中华人民共和国法律**。涉及欧盟用户的部分，**同时适用** GDPR。

---

## 第二部分：English Version (Reference)

### 1. Data Controller

**Shenzhen Miaojing Technology Co., Ltd.**  
**USCC**: 91440300MAK2KM7J4X  
**Address**: Nanshan District, Shenzhen, China  
**Contact**: **postmaster@openoba.com**

### 2. Data Protection Officer (DPO)

| Item | Content |
|------|---------|
| Name | **Tang Qixin** |
| Title | Data Protection Officer |
| Email | postmaster@openoba.com |
| Phone | +86 18026993237 |
| Hours | Weekdays 09:00-18:00 (GMT+8) |
| Full disclosure | [DPO-APPOINTMENT.md](./DPO-APPOINTMENT.md) |

### 3. Scope

This policy applies to the processing of your personal information in the following scenarios:

1. Downloading, installing, using OpenOBA software (openoba-starter monorepo: packages/core/ (BSL 1.1), packages/backend/ (MIT), frontend/ (MIT));
2. Visiting openoba.com and subdomains;
3. Registering an account, applying for a License Key, submitting a bug, submitting a Pull Request;
4. Subscribing to mailing lists, participating in community events;
5. Contacting us (email, phone, social media, GitHub Issue).

### 4. What We Collect and Why

(See §4 of the Chinese version for the complete table. The English table mirrors the Chinese one with the same fields and content.)

### 5. What We Never Collect

- ❌ **Business data**: customer orders, product prices, inventory, sales data
- ❌ **Content data**: ERDL rule definitions, Agent conversation content, user prompts, model responses
- ❌ **Sensitive personal information** (PIPL Art 28 / GDPR Art 9): biometric, religious belief, specific identity, medical health, financial account, location tracking
- ❌ **Personal information of children under 14**

### 6. Cookies and Similar Technologies

6.1 We use cookies/localStorage **only** for:
- (1) **Strictly necessary cookies**: session, CSRF token, login state (**no consent required**);
- (2) **Telemetry consent record** (opt-in popup choice, **no consent required**);
- (3) **Analytics cookies**: Google Analytics 4 (**explicit consent required**, first-visit popup).

6.2 We do **NOT** use third-party advertising cookies, social media tracking pixels, or remarketing cookies.

6.3 Detailed cookie list: [https://openoba.com/legal/cookies](https://openoba.com/legal/cookies)

### 7. How We Share Your Information

(See §7 of the Chinese version for the complete table. English mirrors Chinese.)

### 8. Cross-Border Data Transfer

(See §8 of the Chinese version. English mirrors Chinese.)

### 9. Your Data Subject Rights

(See §9 of the Chinese version for full details. English mirrors Chinese with GDPR-specific and CCPA-specific tables.)

### 10. Security Measures

(Industry-leading: TLS 1.3+, AES-256, Argon2id, RBAC, audit log 180+ days, encrypted backup, vulnerability management per SECURITY.md, quarterly training.)

### 11. Minors and Children

OpenOBA is **not targeted at children under 14**. We **will not knowingly** collect personal information of children under 14. If discovered, deletion within **7 business days**. Users aged 14-18 should use OpenOBA **with parental or guardian accompaniment**.

### 12. Automated Decision-Making and Profiling

We **do not use** your personal information for automated decision-making or user profiling (PIPL Art 24 / GDPR Art 22).

### 13. Amendments

Material amendments announced **at least 30 days in advance**. **Material changes** require **re-consent**. Version history at [https://openoba.com/legal/privacy-changelog](https://openoba.com/legal/privacy-changelog).

### 14. Disputes and Appeals

Appeal via **postmaster@openoba.com**. SLA: first response 7 business days, resolution 30 business days. Right to lodge complaint with local supervisory authority.

- China CAC: [www.cac.gov.cn](https://www.cac.gov.cn)
- EU EDPB: [edpb.europa.eu](https://edpb.europa.eu)

### 15. Governing Law

Governed by the **laws of the People's Republic of China**. For EU users, **GDPR also applies**.

---

## 第三部分：中英文文本优先级

**中文版为正本，英文版为参考。条款歧义以中文版为准。**

**The Chinese version is the master text. The English version is for reference. In case of ambiguity, the Chinese version shall prevail.**
