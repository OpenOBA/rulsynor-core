# OpenOBA 商业许可协议模板 — 中英对照版
# OpenOBA Commercial License Agreement Template

> 版本 Version: 1.0 | 生效 Effective: 2026-06-10
> 许可方 Licensor: 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)
> 适用软件 Applicable Software: **OpenOBA Core** (基于 BSL 1.1)
> 完整 License Key 机制详见 / Full License Key mechanism: [docs/operations/license-key-plan.md](./docs/operations/license-key-plan.md)

---

## 第一部分：中文版

### 一、背景

OpenOBA Core 仓库采用 **Business Source License 1.1 (BSL 1.1)** 许可证。**BSL 1.1 不是开源许可证**，但其 Additional Use Grant 允许**非生产、个人学习、学术研究、内部评估**等场景的免费使用。**生产环境的商业使用**需要**额外的商业许可**。

本协议是**生产环境商业使用 OpenOBA Core 的标准商业许可协议**。

### 二、协议条款

#### 第一条 定义

1.1 **"软件"** 指 OpenOBA Starter 仓库（[github.com/openoba/openoba-starter](https://github.com/openoba/openoba-starter)）中 `packages/core/` 目录下的全部源代码、文档、配置、相关工具。

1.2 **"许可方"** 指深圳市秒镜科技有限公司。

1.3 **"被许可方"** 指签署本协议并支付相应费用的自然人或法人。

1.4 **"生产环境"** 指为内部业务、对外服务、商业运营等用途**正式上线**的部署环境（区别于开发、测试、评估）。

1.5 **"BSL 1.1"** 指 [https://mariadb.com/bsl11/](https://mariadb.com/bsl11/) 中规定的 Business Source License 1.1 许可证。

1.6 **"生效日"** 指本协议双方签署之日。

1.7 **"License Key"** 指依 [operations/license-key-plan.md](../operations/license-key-plan.md) 签发的电子凭证。

#### 第二条 许可范围

2.1 **许可性质**：**非独占、不可转让、不可再许可**的普通许可（除非附件 A 明确同意）。

2.2 **许可范围**：被许可方可在**生产环境**使用软件，**包括**：
- （1）自行使用；
- （2）作为内部业务系统的组件使用；
- （3）作为对外 SaaS / PaaS 服务的底层组件使用（**不构成** "竞品" 用途时）。

2.3 **地域范围**：依附件 A 指定（默认：全球）。

2.4 **使用限制**：
- （1）被许可方**不得**将软件用于"竞品"用途（"竞品"定义见 LICENSE-BSL.txt）；
- （2）被许可方**不得**对软件进行反向工程（除为互操作性所必需）；
- （3）被许可方**不得**移除软件中的版权声明、水印（专业版 / 企业版已去除水印）。

#### 第三条 License Key

3.1 许可方**应**在收到本协议首期费用后 **3 个工作日内**签发 License Key。

3.2 License Key 的**技术实现**依 [operations/license-key-plan.md](../operations/license-key-plan.md)。

3.3 License Key **不可转让、不可出借、不可共享**。被许可方**应当**采取合理措施防止 License Key 泄露。

3.4 License Key **丢失或泄露**的，被许可方应**立即通知**许可方（postmaster@openoba.com），许可方在确认后**48 小时内**签发新 Key（**原 Key 自动吊销**）。

#### 第四条 期限

4.1 协议**自生效日起 1 年**（或附件 A 中约定的期限），**自动续签**但任一方可在到期前 **30 日** 书面通知不续签。

4.2 续签时，**费用按届时生效的 openoba.com/pricing** 计算。

#### 第五条 费用与支付

5.1 **费用**依附件 A 约定（默认：专业版 ¥9,900/年；企业版 ¥49,900/年起）。

5.2 支付方式：
- （1）**银行转账**：深圳市秒镜科技有限公司对公账户；
- （2）**第三方支付**：支付宝、微信支付（仅支持中国大陆）；
- （3）**境外支付**：PayPal、Stripe（仅支持境外客户）。

5.3 发票：许可方**应**在收到款项后 **15 个工作日内**开具增值税普通发票（企业版可开专用发票）。

#### 第六条 知识产权

6.1 软件的**一切权利**归属于许可方。

6.2 本协议**不构成**软件所有权的转让或许可方放弃权利的声明。

6.3 被许可方在**本协议项下使用软件产生的衍生作品、修改、集成**的**著作权**，依本协议归属**被许可方**，但**被许可方**不得将衍生作品再许可给**竞品**。

#### 第七条 维护与支持（SLA）

7.1 **专业版**：
- （1）邮件支持，**48 小时内首次响应**；
- （2）**安全漏洞修复** SLA：Critical 24h、High 30d、Medium 90d；
- （3）**社区优先**（在 GitHub Issue 中标识为付费客户）。

7.2 **企业版**：除专业版所有权利外，
- （1）**专属支持** + **24 小时 SLA**（Critical 4h、High 12h）；
- （2）**专属客户成功经理**；
- （3）**SOC2 合规证据**（年度审计报告 + 合规证书）；
- （4）**定制开发**（每年 ≤ 40 小时，免费）。

7.3 **SLA 不达成**的，按未达成时长**等比例延长**协议期作为补偿。

#### 第八条 保密

8.1 双方对在协议履行中获得的对方**保密信息**承担保密义务。

8.2 保密信息**不包括**：
- （1）已进入**公知领域**的信息（无接收方过错）；
- （2）**第三方合法**向接收方披露的信息；
- （3）**独立开发**获得的信息；
- （4）**法律要求**披露的信息（应**及时通知**对方）。

8.3 保密义务**在协议终止后继续有效 3 年**。

#### 第九条 数据保护

9.1 双方**分别**作为数据处理者 / 数据控制者，各自承担相应 PIPL / GDPR 责任。

9.2 **DPA（数据处理协议）**：[https://openoba.com/legal/dpa](https://openoba.com/legal/dpa)，构成本协议不可分割的一部分。

9.3 涉及**欧盟用户**数据的，**应**签署 **EU SCC（标准合同条款）**。

#### 第十条 免责与责任限制

10.1 软件**按"现状"许可**。

10.2 **责任上限**：许可方在本协议项下的**累计责任**不超过被许可方**过去 12 个月**实际支付的费用；但责任上限在任何情形下**不低于本协议约定年费的 50%**。对于许可方**故意或重大过失**造成的损失，**不适用**前述责任上限，许可方应承担全部赔偿责任；对于**一般违约**造成的损失，适用前述责任上限。

10.3 许可方**不对间接损失、利润损失、商誉损失**承担赔偿责任（除非法律另有规定）。

10.4 **排除条款**：前述责任限制和免责条款**不适用于**因许可方**故意或重大过失**造成的损失（《中华人民共和国民法典》第 506 条）。因故意或重大过失造成对方人身伤害或财产损失的，免责条款无效。

#### 第十一条 终止

11.1 协议**自然终止**：到期未续签。

11.2 **协商终止**：双方书面同意。

11.3 **违约终止**：任一方严重违约且未在 **30 日内**补正的，守约方有权终止。

11.4 **破产终止**：任一方破产、清算、吊销的，另一方有权立即终止。

11.5 终止**后果**：
- （1）被许可方**立即停止**使用软件（生产环境）；
- （2）License Key **自动吊销**；
- （3）已支付费用**不退还**（除非许可方违约）；
- （4）**保密义务、争议解决、知识产权条款继续有效**。

#### 第十二条 准据法与争议解决

12.1 本协议**适用中华人民共和国法律**。

12.2 争议**优先协商**（30 日）。

12.3 协商不成的，提交**深圳国际仲裁院 (SCIA)** 仲裁。

#### 第十三条 其他

13.1 本协议**自双方电子签署**（[doc.openoba.com](https://doc.openoba.com)）之日起生效。

13.2 附件 A、B、C **构成本协议不可分割的一部分**。

13.3 本协议的**任何变更**须以**书面形式**作出。

---

## 第二部分：English Version (Reference)

### 1. Background

The OpenOBA Core repository is licensed under the **Business Source License 1.1 (BSL 1.1)**. **BSL 1.1 is not an open source license**, but its Additional Use Grant permits free use in **non-production, personal study, academic research, internal evaluation** scenarios. **Production commercial use** requires an **additional commercial license**.

This Agreement is the **standard commercial license agreement for production commercial use of OpenOBA Core**.

### 2. Agreement Terms

#### Article 1 — Definitions

1.1 **"Software"** means all source code, documentation, configurations, and related tools in the `packages/core/` directory of the OpenOBA Starter repository ([github.com/openoba/openoba-starter](https://github.com/openoba/openoba-starter)).

1.2 **"Licensor"** means Shenzhen Miaojing Technology Co., Ltd.

1.3 **"Licensee"** means the natural person or legal entity that signs this agreement and pays the corresponding fees.

1.4 **"Production Environment"** means a deployment environment **formally launched** for internal business, external services, commercial operations, etc. (as opposed to development, testing, evaluation).

1.5 **"BSL 1.1"** means the Business Source License 1.1 specified at [https://mariadb.com/bsl11/](https://mariadb.com/bsl11/).

1.6 **"Effective Date"** means the date this agreement is signed by both parties.

1.7 **"License Key"** means the electronic certificate issued in accordance with [operations/license-key-plan.md](../operations/license-key-plan.md).

#### Article 2 — License Scope

2.1 **License nature**: **Non-exclusive, non-transferable, non-sublicensable** general license (unless expressly agreed in Annex A).

2.2 **License scope**: Licensee may use the Software in **production environments**, **including**:
- (1) Self-use;
- (2) Use as a component of internal business systems;
- (3) Use as a base component of external SaaS / PaaS services (when **NOT constituting** "Competitor" use).

2.3 **Territory**: As specified in Annex A (default: global).

2.4 **Use restrictions**:
- (1) Licensee **shall not** use the Software for "Competitor" purposes ("Competitor" defined in LICENSE-BSL.txt);
- (2) Licensee **shall not** reverse engineer the Software (except as necessary for interoperability);
- (3) Licensee **shall not** remove copyright notices or watermarks from the Software (Pro/Enterprise editions have watermarks removed).

#### Article 3 — License Key

3.1 Licensor **shall** issue a License Key within **3 business days** of receiving the first payment.

3.2 License Key **technical implementation** per [operations/license-key-plan.md](../operations/license-key-plan.md).

3.3 License Key is **non-transferable, non-lendable, non-shareable**. Licensee **shall** take reasonable measures to prevent License Key leakage.

3.4 In case of License Key **loss or leakage**, Licensee shall **immediately notify** Licensor (postmaster@openoba.com); Licensor shall issue a new Key within **48 hours** of confirmation (**original Key auto-revoked**).

#### Article 4 — Term

4.1 The agreement is for **1 year from the Effective Date** (or term specified in Annex A), **auto-renewing** but either party may give **30-day prior written notice** of non-renewal.

4.2 Upon renewal, fees are calculated **per the then-effective openoba.com/pricing**.

#### Article 5 — Fees and Payment

5.1 **Fees** as specified in Annex A (default: Professional ¥9,900/year; Enterprise ¥49,900/year and up).

5.2 Payment methods:
- (1) **Bank transfer**: Shenzhen Miaojing Technology Co., Ltd. corporate account;
- (2) **Third-party payment**: Alipay, WeChat Pay (mainland China only);
- (3) **Overseas payment**: PayPal, Stripe (overseas customers only).

5.3 Invoice: Licensor **shall** issue VAT ordinary invoice within **15 business days** of receiving payment (Enterprise may request VAT special invoice).

#### Article 6 — Intellectual Property

6.1 **All rights** in the Software belong to Licensor.

6.2 This agreement **does NOT constitute** a transfer of Software ownership or a waiver by Licensor.

6.3 **Copyright** in **derivative works, modifications, integrations** created by Licensee under this agreement **belongs to Licensee**, but **Licensee shall not** sublicense such derivative works to **Competitors**.

#### Article 7 — Maintenance and Support (SLA)

7.1 **Professional Edition**:
- (1) Email support, **48-hour first response**;
- (2) **Security vulnerability fix** SLA: Critical 24h, High 30d, Medium 90d;
- (3) **Community priority** (identified as paid customer in GitHub Issues).

7.2 **Enterprise Edition**: In addition to Professional Edition rights,
- (1) **Dedicated support** + **24-hour SLA** (Critical 4h, High 12h);
- (2) **Dedicated Customer Success Manager**;
- (3) **SOC2 compliance evidence** (annual audit report + compliance certificate);
- (4) **Custom development** (≤ 40 hours/year, free).

7.3 **SLA non-fulfillment**: Pro-rata extension of agreement term as compensation.

#### Article 8 — Confidentiality

8.1 Both parties shall keep confidential the other party's **Confidential Information** obtained during agreement performance.

8.2 Confidential Information **does not include**:
- (1) Information in the **public domain** (without fault of receiving party);
- (2) Information **lawfully disclosed by a third party** to the receiving party;
- (3) Information obtained through **independent development**;
- (4) Information **required by law** to be disclosed (shall **promptly notify** the other party).

8.3 Confidentiality obligations **survive for 3 years** after agreement termination.

#### Article 9 — Data Protection

9.1 Both parties are **separately** data controllers/processors, each assuming their respective PIPL / GDPR responsibilities.

9.2 **DPA (Data Processing Agreement)**: [https://openoba.com/legal/dpa](https://openoba.com/legal/dpa), an integral part of this agreement.

9.3 For **EU user** data, **shall** sign **EU SCC (Standard Contractual Clauses)**.

#### Article 10 — Disclaimer and Limitation of Liability

10.1 Software is licensed **"AS IS"**.

10.2 **Liability cap**: Licensor's **aggregate liability** under this agreement shall not exceed the **fees actually paid by Licensee in the past 12 months**; provided, however, that the liability cap shall **in no event be less than 50% of the annual fees** stipulated in this agreement. For losses caused by Licensor's **intentional misconduct or gross negligence**, the foregoing liability cap **shall not apply** and Licensor shall bear **full liability**; for losses caused by **ordinary breach**, the foregoing liability cap applies.

10.3 Licensor **shall not** be liable for indirect, consequential, or goodwill damages (unless otherwise required by law).

10.4 **Exclusion**: The foregoing limitation of liability and disclaimer **shall not apply** to losses caused by Licensor's **intentional misconduct or gross negligence** (Article 506 of the Civil Code of the People's Republic of China). Disclaimer clauses are invalid for personal injury or property damage caused intentionally or through gross negligence.

#### Article 11 — Termination

11.1 **Natural termination**: Expiration without renewal.

11.2 **Mutual termination**: Written agreement of both parties.

11.3 **Breach termination**: Either party materially breaches and fails to remedy within **30 days**; the non-breaching party may terminate.

11.4 **Bankruptcy termination**: Either party is bankrupt, liquidated, or has its business license revoked; the other party may terminate immediately.

11.5 Termination consequences:
- (1) Licensee **immediately ceases** using the Software (in production);
- (2) License Key **auto-revoked**;
- (3) **Paid fees non-refundable** (unless Licensor is in breach);
- (4) **Confidentiality, dispute resolution, IP clauses survive**.

#### Article 12 — Governing Law and Dispute Resolution

12.1 This agreement is **governed by the laws of the People's Republic of China**.

12.2 Disputes **prioritize negotiation** (30 days).

12.3 If negotiation fails, submit to **Shenzhen Court of International Arbitration (SCIA)** for arbitration.

#### Article 13 — Miscellaneous

13.1 This agreement **takes effect on the date of electronic signing** by both parties ([doc.openoba.com](https://doc.openoba.com)).

13.2 Annexes A, B, C **constitute integral parts** of this agreement.

13.3 **Any amendment** to this agreement must be made **in writing**.

---

## 附件 A / Annex A 模板

```
甲方 Licensor: 深圳市秒镜科技有限公司
乙方 Licensee: __________________________
USCC: __________________________
联系方式 Contact: __________________________

套餐 Tier:
  ☐ 专业版 Professional (¥9,900/year)
  ☐ 企业版 Enterprise (¥49,900/year+)
  ☐ 定制 Custom: ¥________

地域范围 Territory:
  ☐ 全球 Global
  ☐ 中国大陆 Mainland China
  ☐ 其他 Other: __________________________

期限 Term: ____ 年 years (起 Start: ____ 止 End: ____)

支付方式 Payment Method:
  ☐ 银行转账 Bank transfer
  ☐ 支付宝 Alipay
  ☐ 微信支付 WeChat Pay
  ☐ PayPal
  ☐ Stripe

发票类型 Invoice Type:
  ☐ 增值税普通发票 VAT ordinary invoice
  ☐ 增值税专用发票 VAT special invoice (企业版 only)

签章 Signatures:
甲方 Licensor: __________________________  日期 Date: ____
乙方 Licensee: __________________________  日期 Date: ____
```

---

## 第三部分：中英文文本优先级

**中文版为正本，英文版为参考。条款歧义以中文版为准。**

**The Chinese version is the master text. The English version is for reference. In case of ambiguity, the Chinese version shall prevail.**
