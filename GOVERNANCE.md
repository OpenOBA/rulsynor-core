# OpenOBA Project Governance

> Version: 1.1 | Effective: 2026-06-10 | Updated: 2026-06-25
> Maintainer: Shenzhen Miaojing Technology Co., Ltd.

---

## 1. Governance Phases

OpenOBA is currently maintained by **Shenzhen Miaojing Technology Co., Ltd.** Governance will evolve with the community:

| Phase | Contributors | Decision Model |
|-------|-------------|----------------|
| **Phase 1 (current)** | Henry (Founder) + Tang Haoran (AI Executive Officer) + Core Team | **BDFL final adjudication + Lazy Consensus** |
| **Phase 2** | 5+ external contributors | Core Maintainer Team voting (2/3 majority) |
| **Phase 3** | 50+ external contributors | OpenOBA TSC (Technical Steering Committee) voting |
| **Phase 4** | 500+ external contributors | Foundation model (e.g., Apache, Linux Foundation) |

---

## 2. Roles

| Role | Responsibilities | Permissions | Appointment |
|------|-----------------|-------------|-------------|
| **Founder (BDFL)** | Strategic direction, final adjudication | All repo admin | Established at company founding |
| **BDFL Successor** | Takes over if Founder incapacitated or steps down | Same as Founder | Founder designates in writing + Board confirmation |
| **AI Executive Officer** | Architecture, process, CI/CD coordination. **AI Executive Officer（AI 执行官）为深圳市秒镜科技有限公司聘用的技术管理职位，由人类担任，负责项目架构设计、流程协调和 CI/CD 管理。该角色持有独立的判断权和执行权，但涉及法律决策的事项须经公司法定代表人批准。** | Per-repo maintainer | Company appointment |
| **Core Maintainer** | Code review, release management | Specific repo maintainer | BDFL nomination + core team acknowledgment |
| **TSC Member** (Phase 3+) | Major technical decisions | Voting rights | Committee election |
| **Contributor** | Submit PRs, report bugs | No merge rights | Granted after signing CLA |
| **Community Member** | Use, feedback, discussion | No code rights | Upon registration |

---

## 3. Decision Process

```
Proposal (Issue / PR / Discussion)
  ↓
Core Maintainer review (technical)
  ↓
Lazy Consensus
  ├─ No objection within 48h → Auto-approved
  └─ Objection → BDFL adjudication
      ↓
      Vote (Phase 2+)
      ├─ 2/3 majority → Execute
      └─ Rejected → Return to proposer
```

---

## 4. BDFL Exit Mechanism

- The BDFL role is **long-term but not lifetime**
- Founder stepping down: 90 days' written notice, designate a successor or initiate public election
- Founder incapacitation (180 days unable to perform): BDFL Successor automatically takes over; if none, Board of Directors acts as temporary decision-making body
- The Company **cannot revoke** the Founder's shareholder rights under Company Law (separate from the BDFL role)

---

## 5. Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

Enforcement and appeals: **postmaster@openoba.com**.

---

## 6. Copyright & Trademarks

- Source code: governed by respective LICENSE files (see [Contributing](./CONTRIBUTING.md) for the per-directory licensing table)
- Documentation (excluding code): **CC BY-SA 4.0**
- Trademarks: OpenOBA™, ERDL™, ERA-Chat™ are owned by Shenzhen Miaojing Technology Co., Ltd. See [TRADEMARK.md](./TRADEMARK.md)

---

## 7. Anti-Trust & Fair Participation

The project prohibits predatory pricing, refusal to deal, tying, or other conduct violating competition laws (PRC Anti-Monopoly Law, U.S. Sherman Act, EU TFEU Article 102).

The project commits to:
- Treat all licensees equally under equivalent conditions
- Not use community edition pricing to undermine competitors' legitimate commercial activities
- Not use trademark control to implement unfair competition

Suspected violations may be reported to **postmaster@openoba.com**. Response within 30 days.

---

## 8. Amendments

Amendments require BDFL or TSC (Phase 3+) adoption and take effect 30 days after public release.

---

## 9. Contact

| Matter | Email |
|--------|-------|
| Governance | postmaster@openoba.com |
| CoC violations | postmaster@openoba.com |
| Disputes & appeals | postmaster@openoba.com |

---

## 10. Governing Law

This governance document is governed by the laws of the People's Republic of China. The Chinese version is the master text; the English version is for reference.
