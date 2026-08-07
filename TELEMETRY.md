# OpenOBA 遥测与隐私声明 — 中英对照版
# OpenOBA Telemetry & Privacy Statement

> 版本 Version: 1.0 | 生效 Effective: 2026-06-10 | 维护方 Maintainer: 深圳市秒镜科技有限公司
> 适用仓库 Applicable Repos: openoba-starter (monorepo)
> 单独隐私政策见 / See also PRIVACY-POLICY.md for the complete privacy policy

---

## 第一部分：中文版

### 一、我们的承诺

OpenOBA **不是**一个监控工具。我们是 AI 原生自主执行体，我们的隐私承诺很简单：

> **我们绝不收集您的业务数据、客户信息或任何能识别到您企业的敏感内容。**

本声明**符合**《中华人民共和国个人信息保护法》(PIPL) 第 13、14 条与 **GDPR Article 13、14** 告知要求。

### 二、数据处理者与保护负责人

**数据处理者（Data Controller）**：

深圳市秒镜科技有限公司  
统一社会信用代码：91440300MAK2KM7J4X  
注册地址：中国广东省深圳市南山区

**个人信息保护负责人（DPO）**：

- 姓名：**唐启鑫**（2026-06-15 公示）
- 职务：**数据保护官**
- 邮箱：**postmaster@openoba.com**（CC 至 **dpo@openoba.com**，转发由 DPO 团队处理）
- 电话：+86 18026993237（工作日 09:00-18:00 GMT+8）

DPO 任命公告与详细联系方式见 **[DPO-APPOINTMENT.md](./DPO-APPOINTMENT.md)**。

### 三、我们收集什么（全部 opt-in，单独同意）

OpenOBA 包含一个 **opt-in（自主选择加入）** 的匿名使用统计功能。**首次启动时**，您将看到一个**独立的弹窗**（不与其他同意捆绑），明示以下收集项目，您可以**明确选择"同意"或"不同意"**。

| 收集项 | 数据示例 | 用途 | PIPL/GDPR 法律基础 |
|--------|---------|------|-------------------|
| 部署模式 | `operator` / `developer` | 功能使用分布分析 | 同意 (PIPL 13; GDPR 6(1)(a)) |
| OpenOBA 版本 | `v1.5.0` | 兼容性分析 | 同意 |
| 功能使用次数（计数） | Agent Chat 调用次数 | 改进高频功能 | 同意 |
| 错误类型 | `SyntaxError` | 修复 Bug | 同意 |
| 部署 ID（哈希） | SHA256(随机数 + 部署时间) | 区分部署实例 | 同意 |
| 操作系统与运行时 | `Linux 5.15 / Node 20.x` | 兼容性分析 | 同意 |
| 启动时间戳 | `2026-07-01T08:00:00Z` | 使用时段分析 | 同意 |

**弹窗选择的时间戳与选项将永久保留**，作为同意凭证（保存 3 年后自动删除）。

### 四、我们绝不收集

- ❌ **企业业务数据**（订单、客户、商品、价格、库存、财务数据）；
- ❌ **ERDL 规则内容或 Schema 定义**；
- ❌ **Agent 对话内容、用户提示、模型回复**；
- ❌ **客户/员工个人信息**（姓名、电话、邮箱、身份证号、生物特征）；
- ❌ **任何能定位到具体企业的元数据**（公司名、域名、IP 段）。

### 五、关闭遥测（用户权利）

您有**随时关闭**遥测的权利，关闭后**不影响产品其他功能**。

**方法一：环境变量**
```bash
export OPENOBA_TELEMETRY=0
```

**方法二：配置文件**
```json
// openoba.config.json
{ "telemetry": false }
```

**方法三：首次启动弹窗**
首次启动时会出现 opt-in 对话框，选择"不同意"即可。

**方法四：随时撤回**
您可在任何时间通过 **postmaster@openoba.com** 撤回同意；我们将在 7 个工作日内**永久删除**您的部署 ID 哈希与所有历史遥测数据。

### 六、技术实现细节

| 项目 | 详情 |
|------|------|
| 传输协议 | HTTPS（TLS 1.3+），强制 HSTS |
| 数据格式 | JSON over HTTPS POST |
| 端点 | `https://telemetry.openoba.com/v1/ingest` |
| **服务器位置** | **腾讯云 - 中国深圳**（详见跨境传输说明） |
| 数据保留期 | 90 日（自采集日算起）自动删除 |
| 部署 ID 处理 | SHA256(随机数 + 部署时间) 单向哈希，**不可逆** |
| IP 地址处理 | **server access log 在 24 小时后自动匿名化**（末位掩码为 0） |
| 与个人身份关联 | **不关联**（无 cookie、无 tracking pixel、无第三方分析 SDK） |

### 七、跨境数据传输

7.1 我们的**主服务器**位于**中国深圳**（腾讯云），主要在中国境内处理。

7.2 我们的**备份与灾备**服务器位于**新加坡**（AWS Singapore）。如您在中国大陆境内使用，**您的数据不会被传输至境外**（备份在大陆本地化）。如您在中国大陆境外使用，您的数据将**就近处理**（亚太地区用户在新加坡，欧洲用户在法兰克福 - 计划 2026-Q4 启用）。

7.3 **欧盟用户**：
- （1）欧盟数据驻留：法兰克福节点 📋 计划 2026-Q4 启用；
- （2）在欧盟节点启用前，欧盟用户数据**仅在亚太节点处理**；
- （3）我们已签署**欧盟标准合同条款 (SCC, 2021/914)** ✅ 已完成，作为跨境传输机制；
- （4）适用 GDPR Chapter V 全部要求。

7.4 **美国用户**：
- （1）适用 CCPA / CPRA 全部要求；
- （2）我们**不出售**任何个人信息（CCPA §1798.140(t) 出售定义）；
- （3）CCPA 要求的"Do Not Sell"链接虽不适用（我们不出售），但我们**在隐私政策中**明示。

### 八、第三方处理者（Sub-Processors）

| 处理者 | 服务 | 数据范围 | 位置 | DPA 状态 |
|--------|------|---------|------|----------|
| 腾讯云 | 服务器、数据库 | 全部遥测 | 中国深圳 | ✅ 已签 DPA |
| AWS | 灾备、SOC2 合规审计 | 备份遥测 | 新加坡 | ✅ 已签 DPA |
| 邮件服务（如 Postmark） | DPO 联系邮件 | 仅邮件地址 | 美国 | ✅ 已签 DPA |

**DPA 全文**：[https://openoba.com/legal/dpa](https://openoba.com/legal/dpa)  
**Sub-Processor 变更通知**：任何新增 / 更换 Sub-Processor 将**至少提前 30 日**在官网公告。

### 九、您的数据主体权利

依 PIPL 第 44-50 条与 GDPR Chapter III，您享有：

| 权利 | 行使方式 | 响应时间 |
|------|----------|----------|
| **知情权** | 本文件全文 | 即时 |
| **同意权 / 撤回同意** | 关闭遥测 / 联系 DPO | 立即生效 / 7 个工作日内 |
| **访问权** | postmaster@openoba.com | 30 日内 |
| **更正权** | postmaster@openoba.com | 30 日内 |
| **删除权** | postmaster@openoba.com | 30 日内 |
| **可携权** | JSON / CSV 导出 | 30 日内 |
| **拒绝自动化决策权** | 不适用（无自动化决策） | — |
| **投诉权** | 联系您所在地的监管机构 | — |

### 十、未成年与儿童

OpenOBA **不针对 14 周岁以下儿童**。如发现 14 周岁以下儿童的个人信息被收集，我们将在 7 个工作日内删除。

### 十一、变更

本声明的修订将**至少提前 30 日**在官网公告。**实质性变更**（如新增收集项、改变用途、跨境传输机制变更）将需要**重新获取同意**。

### 十二、准据法

本声明**适用中华人民共和国法律**。涉及欧盟用户的部分，**同时适用** GDPR。

---

## 第二部分：English Version

### 1. Our Commitment

OpenOBA is **NOT** a surveillance tool. We are an AI-Native Autonomous Executor. Our privacy commitment is simple:

> **We never collect your business data, customer information, or any content that could identify your enterprise.**

This statement **complies with** Articles 13 and 14 of the **Personal Information Protection Law of the People's Republic of China (PIPL)** and **GDPR Articles 13 and 14** notification requirements.

### 2. Data Controller and Data Protection Officer

**Data Controller**:

Shenzhen Miaojing Technology Co., Ltd.  
USCC: 91440300MAK2KM7J4X  
Registered Address: Nanshan District, Shenzhen, China

**Data Protection Officer (DPO)**:

- Name: **Tang Qixin**
- Title: **Data Protection Officer**
- Email: **postmaster@openoba.com** (CC **dpo@openoba.com**, forwarded to DPO team)
- Phone: +86 18026993237 (Business hours: 09:00-18:00 GMT+8)

For the full DPO appointment notice, see **[DPO-APPOINTMENT.md](./DPO-APPOINTMENT.md)**.

### 3. What We Collect (All opt-in, separately consented)

OpenOBA includes an **opt-in** anonymous usage statistics feature. **On first launch**, you will see a **standalone popup** (not bundled with other consents) explicitly stating the items below, and you may **clearly select "Agree" or "Decline"**.

| Item | Example | Purpose | Legal Basis (PIPL/GDPR) |
|------|---------|---------|------------------------|
| Deployment mode | `operator` / `developer` | Feature distribution analysis | Consent (PIPL 13; GDPR 6(1)(a)) |
| OpenOBA version | `v1.5.0` | Compatibility analysis | Consent |
| Feature usage count | Agent Chat call count | Improve high-frequency features | Consent |
| Error type | `SyntaxError` | Bug fixing | Consent |
| Deployment ID (hashed) | SHA256(random + deploy time) | Distinguish deployment instances | Consent |
| OS and runtime | `Linux 5.15 / Node 20.x` | Compatibility analysis | Consent |
| Launch timestamp | `2026-07-01T08:00:00Z` | Usage time analysis | Consent |

**The popup selection timestamp and choice are permanently retained** as consent evidence (auto-deleted after 3 years).

### 4. What We Never Collect

- ❌ **Enterprise business data** (orders, customers, products, prices, inventory, financial data);
- ❌ **ERDL rule content or schema definitions**;
- ❌ **Agent conversation content, user prompts, model responses**;
- ❌ **Customer/employee personal information** (name, phone, email, ID number, biometric);
- ❌ **Any metadata that could locate a specific enterprise** (company name, domain, IP range).

### 5. How to Disable Telemetry (Your Rights)

You have the right to **disable telemetry at any time**. Disabling does **NOT affect other product features**.

**Method 1: Environment variable**
```bash
export OPENOBA_TELEMETRY=0
```

**Method 2: Configuration file**
```json
// openoba.config.json
{ "telemetry": false }
```

**Method 3: First-launch popup**
Select "Decline" on the first-launch opt-in dialog.

**Method 4: Withdraw consent anytime**
Email **postmaster@openoba.com** to withdraw consent; we will **permanently delete** your deployment ID hash and all historical telemetry data within 7 business days.

### 6. Technical Implementation

| Item | Detail |
|------|--------|
| Transport | HTTPS (TLS 1.3+), HSTS enforced |
| Format | JSON over HTTPS POST |
| Endpoint | `https://telemetry.openoba.com/v1/ingest` |
| **Server location** | **Tencent Cloud - Shenzhen, China** (see cross-border section) |
| Retention | 90 days from collection, auto-deleted |
| Deployment ID | SHA256(random + deploy time) one-way hash, **irreversible** |
| IP handling | **Server access logs auto-anonymized after 24 hours** (last octet masked) |
| PII linkage | **Not linked** (no cookies, no tracking pixel, no third-party analytics SDK) |

### 7. Cross-Border Data Transfer

7.1 Our **primary servers** are located in **Shenzhen, China** (Tencent Cloud), with main processing in China.

7.2 Our **backup and DR servers** are located in **Singapore** (AWS). If you use OpenOBA in mainland China, **your data will NOT be transferred abroad** (backups are localized). If you use OpenOBA outside mainland China, your data will be **processed regionally** (APAC users in Singapore, EU users in Frankfurt - planned for 2026-Q4).

7.3 **EU Users**:
- (1) EU data residency: Frankfurt node 📋 planned for 2026-Q4;
- (2) Before EU node activation, EU user data is **processed only in APAC node**;
- (3) We have signed **EU Standard Contractual Clauses (SCC, 2021/914)** ✅ Completed, as the cross-border transfer mechanism;
- (4) All GDPR Chapter V requirements apply.

7.4 **US Users**:
- (1) All CCPA / CPRA requirements apply;
- (2) We **do not sell** any personal information (per CCPA §1798.140(t) sale definition);
- (3) Though the CCPA "Do Not Sell" link is not applicable (we do not sell), we **disclose this explicitly** in our privacy policy.

### 8. Sub-Processors

| Processor | Service | Data scope | Location | DPA status |
|-----------|---------|-----------|----------|-----------|
| Tencent Cloud | Server, database | All telemetry | Shenzhen, China | ✅ DPA signed |
| AWS | DR, SOC2 compliance audit | Backup telemetry | Singapore | ✅ DPA signed |
| Email service (e.g., Postmark) | DPO contact email | Email addresses only | USA | ✅ DPA signed |

**Full DPA text**: [https://openoba.com/legal/dpa](https://openoba.com/legal/dpa)  
**Sub-Processor change notice**: any new/replaced sub-processor will be announced at least **30 days in advance** on our website.

### 9. Your Data Subject Rights

Under PIPL Articles 44-50 and GDPR Chapter III, you have the right to:

| Right | How to exercise | Response time |
|------|----------------|---------------|
| **Right to be informed** | This document | Immediate |
| **Consent / Withdraw consent** | Disable telemetry / Contact DPO | Immediate / Within 7 business days |
| **Right of access** | postmaster@openoba.com | Within 30 days |
| **Right to rectification** | postmaster@openoba.com | Within 30 days |
| **Right to erasure** | postmaster@openoba.com | Within 30 days |
| **Right to data portability** | JSON / CSV export | Within 30 days |
| **Right to object to automated decision-making** | N/A (no automated decisions) | — |
| **Right to lodge a complaint** | Contact your local supervisory authority | — |

### 10. Minors and Children

OpenOBA is **not targeted at children under 14 years of age**. If we discover that personal information of children under 14 has been collected, we will delete it within 7 business days.

### 11. Amendments

Material amendments to this statement will be announced on our website **at least 30 days in advance**. **Material changes** (e.g., new collection items, purpose changes, cross-border transfer mechanism changes) will require **re-consent**.

### 12. Governing Law

This statement is **governed by the laws of the People's Republic of China**. For matters involving EU users, **GDPR also applies**.

---

## 第三部分：中英文文本优先级

**中文版为正本，英文版为参考。条款歧义以中文版为准。**

**The Chinese version is the master text. The English version is for reference. In case of ambiguity, the Chinese version shall prevail.**
