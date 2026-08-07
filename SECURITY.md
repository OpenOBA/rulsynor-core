# OpenOBA Security Policy

> Version: 1.1 | Effective: 2026-06-10 | Updated: 2026-06-25
> Maintainer: Shenzhen Miaojing Technology Co., Ltd.

---

## 1. Reporting a Vulnerability

**If you discover a security vulnerability in OpenOBA, do NOT report it in public Issues, Discussions, or PRs.**

Please report through:

📧 **postmaster@openoba.com** (PGP encryption strongly recommended)
🔑 **PGP Public Key URL**: `https://openoba.com/.well-known/security-pgp-key.asc`
🔒 **security.txt**: `https://openoba.com/.well-known/security.txt` (RFC 9116 compliant)

---

## 2. SLA Commitments

| Phase | SLA | Action |
|-------|-----|--------|
| Report received | Within 24 hours | Email confirmation, incident ID assignment |
| Initial assessment | Within 7 business days | Severity evaluation, impact scope, reproduction |
| Patch release | 30 days (High) / 90 days (Medium) | Patch version + security advisory |
| Public acknowledgement | With patch release | Release Note credit (unless anonymity requested) |

---

## 3. Severity Classification

We use **CVSS 3.1** scoring.

| Severity | CVSS Range | Patch SLA |
|----------|-----------|-----------|
| **Critical** | 9.0 - 10.0 | Patch within 24h, public advisory within 48h |
| **High** | 7.0 - 8.9 | Within 30 days |
| **Medium** | 4.0 - 6.9 | Within 90 days |
| **Low** | 0.1 - 3.9 | Next regular release |

---

## 4. Supported Versions

| Component | Supported Version |
|-----------|------------------|
| OpenOBA Starter (monorepo) | Latest release (V1.4.x) |
| `packages/core/` | Latest release (BSL 1.1) |

Only the latest release receives security patches. Earlier versions receive critical fixes only.

---

## 5. Safe Harbor

We will not pursue legal action against security researchers who act in good faith and comply with this disclosure policy.

Specifically, security research activities meeting the following conditions are not considered violations:
- Conducted for research purposes only, without actively exploiting vulnerabilities to cause harm
- Did not access, modify, retain, transmit, or resell user data
- Did not cause damage to service availability, performance, or integrity
- Strictly complied with the reporting process and timelines specified in this policy
- Provided at least 90 days for remediation before public disclosure

We will **not**:
- File DMCA takedown notices against good-faith researchers
- Pressure researchers' employers
- Deny researchers legitimate use of OpenOBA based on their research activities

---

## 6. CVE Numbering

We use **GitHub Security Advisories (GHSA)** for CVE assignment. Researchers do not need to apply for CVE numbers themselves — GHSA advisories automatically receive CVE numbers upon creation.

---

## 7. Production Deployment Best Practices

If you deploy OpenOBA in production:

1. **Never expose `.env` files** — excluded via `.gitignore`, CI scans with secrets detection
2. **Enable JWT token expiration** — default 24h; production: 1-2h with refresh mechanism
3. **Enforce HTTPS** — disable plaintext HTTP; CORS restricted to specified domains
4. **Subscribe to security alerts** — GitHub Watch → Custom → Security Alerts
5. **Audit logs** — cognitive audit trail; integrate with SIEM (Splunk / ELK) if available
6. **Rotate secrets** — every 90 days in production; purge old keys from Git history
7. **Encrypt backups** — AES-256 encryption for all database backups; key managed independently
8. **Network isolation** — expose only required ports; restrict everything else via firewall

---

## 8. Authentication & Data Protection

We commit to:

- No plaintext password storage
- All passwords hashed with **Argon2id** (preferred) or **bcrypt (cost ≥ 12)**
- All Core engine SQL operations validated through **Action Guard** whitelist
- ERDL rule changes validated via **SHA256 integrity check**

We recommend deployers:

- Enable **MFA** for administration panels
- **Login failure lockout** (5 failures → 30-minute lockout)
- **Session timeout** ≤ 24 hours
- **Audit log retention** ≥ 180 days

---

## 9. Hall of Fame

We publicly acknowledge all reporters (with their consent). Acknowledgements appear at:
- GitHub Security Advisories
- The version's Release Notes

We do not currently offer a bug bounty program, but are evaluating future options.

---

## 10. Amendments

Amendments to this security policy take effect 30 days after public release.

---

## 11. Governing Law

This security policy is governed by the laws of the People's Republic of China.
