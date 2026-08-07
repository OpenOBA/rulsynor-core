<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# ERDL Decision Object v1.0

> **An open specification for standardized, auditable, cross-implementation-verifiable enterprise AI Agent decisions.**
>
> Version: 1.0.0 · Freeze Date: 2026-08-02 · First Published: 2026-08-02
> Maintainer: OpenOBA (openoba.com)
> License: MIT
>
> **⚠️ DRAFT FREEZE** — This document is frozen. The audit vector set (AV-001 ~ AV-005) has been verified by three independent implementations. Any future revision requires a Spec Change Proposal (SCP) with an accompanying updated audit vector set.

---

## 0. Motivation: Why Enterprise Needs a Decision Object Standard

### 0.1 Regulatory Pressure

In 2026, AI Agents have entered highly regulated domains — finance, healthcare, hiring, insurance, critical infrastructure. Global regulators are closing the "black-box decision" window:

| Regulatory Framework | Key Requirements | Enterprise Impact |
|----------------------|------------------|-------------------|
| **EU AI Act** (effective 2026-08-02) | Article 12: automatic logging of every high-risk decision (decision + outcome + risk situation + monitoring data). Article 14: human oversight must be **external constraints**, system prompts are not compliant. | €35M / 7% global turnover |
| **China GB/Z 185-2026** | 28-bit Agent Identity Code (AID), 5 tool-safety mechanisms, data flow permission auditing, decision tracing | Generative AI service compliance framework + algorithm filing |
| **US COSO 2026** | GenAI internal controls must capture complete audit trail: prompt, input, output, model version, config version, evidence of human review | PCAOB AS 2201 compliance + SOX internal controls |
| **NIST AI RMF 1.0** | Map / Measure / Manage / Govern — four-function governance framework | Voluntary but affects US federal procurement eligibility |
| **OWASP Top 10 for Agentic 2026** | 10 Agentic risks: Prompt Injection, Tool Manipulation, Supply Chain, Autonomy Abuse, etc. — each requires technical controls | Industry best practice (affects insurance/audit) |
| **IEEE P3395** (in development) | Recommended Practice for Agentic AI Practices | Future compliance expectation |
| **ISO/IEC 42001:2023** | AI Management System (AIMS) — Plan-Do-Check-Act, internal audit, management review | Certification requirement (affects government procurement) |
| **CAICT 8-Dimension Framework** (2026-04-15) | Enterprise-grade AI Agent full-chain assessment: Core Components / Key Capabilities / Platform Support / Operations Management | Chinese government & enterprise procurement qualification |
| **Colorado SB 205** (effective 2026-06-30) | AI decisions must be explainable; consumers have right to appeal | $20,000 / violation |
| **Singapore Agentic AI Governance Framework** (2026-01-22) | World's first dedicated Agent AI governance framework: bound risks, human accountability, technical controls, user responsibility | Voluntary but enterprise bears ultimate legal responsibility |

### 0.2 The Enterprise Problem

Enterprise compliance teams face a common technical barrier: **different vendors' AI Agents output decisions in different formats.** Auditors receive prompt logs and conversation screenshots — not structured, verifiable decision records.

Take financial services as an example. COSO 2026 already requires AI audit trails to demonstrate that "the control functioned as designed." A screenshot of a chat window cannot satisfy that requirement.

ERDL Decision Object solves this: a **machine-readable, cross-implementation-verifiable, tamper-evident** standard output format for every Agent decision.

### 0.3 Cross-Implementation Neutrality

The neutrality of an open standard is **not declared — it is proven through independent verification.** The design principle of this specification:

> **Given the same rule set and context, any compliant ERDL implementation MUST produce byte-for-byte identical Decision Objects.**

Three independent implementations. One open specification. One vector set. No single owner. This is the classic path to decentralized infrastructure (see RFC 2026, IETF standards process).

---

## 1. Scope and Audience

### 1.1 This Standard Is For

| Audience | Role | Primary Concern |
|----------|------|-----------------|
| **Enterprise Compliance Teams** | Auditing Agent decisions, meeting regulatory requirements | "Can I submit this decision as evidence to a regulator?" |
| **Agent Platform Developers** | Implementing ERDL-compatible rule engines | "Will my engine's output pass cross-implementation verification?" |
| **RegTech Vendors** | Building AI audit products | "Can I parse any ERDL Agent's decisions using this format?" |
| **Standards Bodies** | Evaluating protocol neutrality | "Are there independent implementations? Can the vectors be reproduced?" |

### 1.2 This Standard Is Not For

- ❌ Individual developers' day-to-day usage (see MCP Server Free tier)
- ❌ Best practices for Agent behavior
- ❌ LLM model evaluation or benchmarking

---

## 2. Specification

### 2.1 Decision Object Format

Every Agent decision outputs the following JSON structure:

```json
{
  "spec": "decision-object-v1.0",
  "decision_id": "018c4a3e-...",
  "timestamp": "2026-08-02T08:30:00.000Z",
  "agent": {
    "id": "agent-001",
    "role": "operator",
    "version": "v1.5.0"
  },
  "context": {
    "tool.name": "exec",
    "tool.args": { "command": "ls" }
  },
  "policies": [
    {
      "id": "SEC-001",
      "name": "block_exec_tool",
      "version": 1,
      "hash": "sha256:abc123..."
    }
  ],
  "evaluation": {
    "proposal_id": null,
    "matched_rules": [],
    "total_evaluated": 0,
    "total_matched": 0
  },
  "result": {
    "decision": "PASS",
    "severity": "none",
    "reason": "no rules matched",
    "action_taken": "allowed"
  },
  "audit": {
    "hash": "sha256:...",
    "previous_hash": null,
    "commitment": "2026-08-02T08:30:00.000Z|agent-001|exec|PASS"
  }
}
```

### 2.2 Field Definitions

#### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `spec` | string | ✅ | Fixed: `"decision-object-v1.0"` |
| `decision_id` | string | ✅ | UUID v7 (time-ordered, recommended), globally unique. Implementations may fall back to UUID v4 for compatibility. |
| `timestamp` | string | ✅ | ISO 8601 UTC, NTP-synced |
| `agent` | object | ✅ | Identity of the decision-making Agent |
| `context` | object | ✅ | Context that triggered this decision |
| `policies` | array | ✅ | Active policy set evaluated |
| `evaluation` | object | ✅ | Detailed rule evaluation results |
| `result` | object | ✅ | Final decision outcome |
| `audit` | object | ✅ | Tamper-evident audit evidence |

#### agent Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `agent.id` | string | ✅ | Agent unique identifier (recommended: GB/Z 185 AID or DID:ERDL format) |
| `agent.role` | string | ✅ | `guardian` / `operator` / `observed` |
| `agent.version` | string | ✅ | Agent software version |

#### policies Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `policies[].id` | string | ✅ | Policy unique identifier |
| `policies[].name` | string | ✅ | Human-readable name |
| `policies[].version` | number | ✅ | Policy version (for audit traceability) |
| `policies[].hash` | string | ✅ | SHA-256 hash of the complete policy content |

#### evaluation Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `evaluation.proposal_id` | string | — | Rule proposal ID (if changed via approval workflow), null otherwise |
| `evaluation.matched_rules` | array | ✅ | Rules that matched |
| `evaluation.matched_rules[].rule_id` | string | ✅ | Rule ID |
| `evaluation.matched_rules[].decision` | string | ✅ | Decision from this rule |
| `evaluation.matched_rules[].reason` | string | — | Reason/explanation |
| `evaluation.matched_rules[].instruction` | string | — | Advisory instruction (ALLOW) |
| `evaluation.matched_rules[].correction` | string | — | Correction content (CORRECT) |
| `evaluation.matched_rules[].ring` | number | — | Execution ring level |
| `evaluation.total_evaluated` | number | ✅ | Total rules evaluated (excluding disabled) |
| `evaluation.total_matched` | number | ✅ | Total rules matched |

#### result Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `result.decision` | string | ✅ | Decision type (see §2.3) |
| `result.severity` | string | ✅ | `none` / `low` / `medium` / `high` / `critical` |
| `result.reason` | string | ✅ | Human-readable explanation (descriptive for PASS) |
| `result.action_taken` | string | ✅ | Actual action: `allowed` / `blocked` / `corrected` / `paused` / `halted` / `rolled_back` / `quarantined` / `escalated` |

#### audit Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `audit.hash` | string | ✅ | SHA-256 hash of the full record. Compute by JCS (RFC 8785) canonical serialization, removing the `hash` field, then SHA-256. |
| `audit.previous_hash` | string | — | Hash of the previous audit record (forms a chain), null for first record |
| `audit.commitment` | string | ✅ | Tamper-evident commitment: `timestamp|agent_id|tool_name|decision` |

---

### 2.3 Decision Types and Severity

| Decision | Severity | Meaning | Agent Behavior | Tier |
|----------|:--------:|---------|----------------|:----:|
| `PASS` | none | No rules matched | Continue normally | Free |
| `ALLOW` | none | Allow with guidance | Continue, follow advisory | Free |
| `CORRECT` | medium | Auto-correct | Continue with corrected parameters | Free |
| `REQUEST_HUMAN` | medium | Pause for approval | Operation suspended, waiting for human | Free |
| `ESCALATE` | medium | Escalate to supervisor | Operation suspended, escalated | Pro |
| `NOTIFY` | low | Compliance notification | Continue, notification logged | Pro |
| `DENY` | high | Hard block | Operation blocked, must be revised | Free / Pro |
| `ROLLBACK` | high | Roll back earlier actions | Undo operations, restore prior state | Pro |
| `QUARANTINE` | critical | Isolate Agent | Block all subsequent operations until audit | Pro |
| `EMERGENCY_HALT` | critical | Global emergency stop | Immediately halt all supervised Agents | Enterprise |

> **Note**: `ROLLBACK`, `QUARANTINE`, and `ESCALATE` at Ring 1/2 are Pro features. The Free tier (Ring 3) supports `ALLOW`, `CORRECT`, `NOTIFY`, and `DENY`. `EMERGENCY_HALT` is available only with Enterprise Ring 0. `BLOCK` is equivalent to `DENY` in this specification — both carry identical semantics; `DENY` is the canonical term.

> **Relationship with ERDL Language Layer**: The ERDL language specification defines a broader action set (including `DELEGATE`, `STRATEGIZE`, `AUDIT`, `CALCULATE`, `VALIDATE`, etc.). These are Agent-internal reasoning actions that do not enter cross-system Decision Objects. Decision Object includes only decision types with **external visibility** — those that materially affect enterprise compliance, auditing, and regulatory oversight. These 10 types constitute the **external compliance subset** of the ERDL action set.

### 2.4 Audit Chain

Decision Objects support a **tamper-evident audit chain**. Each record links to the previous one via `audit.previous_hash`:

```
[Record N-1]  →  [Record N]  →  [Record N+1]
  hash: abc       hash: def       hash: ghi
                  prev: abc       prev: def
```

Any tampering with a record breaks hash consistency across the entire chain. Auditors need only verify the latest `audit.hash` to confirm the integrity of the complete chain.

### 2.5 Data Retention

| Regulation | Minimum Retention | Scope |
|------------|:-----------------:|-------|
| EU AI Act Article 12 | 6 months (high-risk systems) | All decision records |
| COSO / SOX | 7 years (audit workpapers); 366 days (operation logs) | Financial AI decisions |
| HIPAA | 6 years | PHI-related decisions |
| PCI DSS v4.0 | 12 months (3 months online) | Payment card data decisions |
| GB/Z 185-2026 | Per Data Security Law Art. 33: ≥6 months | Significant data processors' AI decisions |
| CC-CSIRT General | 12-24 months | Security event traceability |

Compliant implementations should document their supported data retention policy. The exact retention period depends on the deploying organization's industry regulations — the standard itself **does not mandate a minimum period**, but requires `audit.hash` and `audit.previous_hash` to remain verifiable throughout the retention period.

---

## 3. Regulatory Alignment

### 3.1 EU AI Act Coverage

| Article | Requirement | Decision Object Coverage |
|---------|-------------|--------------------------|
| Art. 12 (Record-keeping) | Automatically log decisions, outcomes, risk situations | `decision_id` + `timestamp` + `result` + `context` |
| Art. 13 (Transparency) | Decisions must be explainable | `result.reason` + `matched_rules` |
| Art. 14 (Human Oversight) | External constraints, not system prompts | `agent.role = "guardian"` + `REQUEST_HUMAN` / `ESCALATE` |
| Art. 9 (Risk Management) | Risk management system | `policies[]` (versioned) + `result.severity` |
| Art. 19 (Log Access) | ≥6 months accessible | `audit.hash` + `audit.previous_hash` (audit chain) |

### 3.2 China GB/Z 185-2026 Coverage

| Requirement | Decision Object Coverage |
|-------------|--------------------------|
| 28-bit AID (Agent Identity Code) | `agent.id` (recommended format) |
| 5 Tool-Safety Mechanisms | `result.decision` + `matched_rules[]` (block/correct/request-human) |
| Data Flow Permission Auditing | `matched_rules` traces every decision to a specific rule |
| Decision Traceability | `audit.previous_hash` (audit chain) + `audit.commitment` |

### 3.3 NIST AI RMF 1.0 Coverage

| NIST Function | Requirement | Decision Object Coverage |
|---------------|-------------|--------------------------|
| **Govern** | Establish governance structures, policies, accountability | `agent.role` + `policies[].version` + `policies[].hash` (versioned policies) |
| **Map** | Map AI risks and context | `context` (complete decision-triggering context) |
| **Measure** | Measure AI system trustworthiness | `matched_rules[]` (why each rule fired or did not fire) |
| **Manage** | Manage identified risks | `result.decision` + `result.action_taken` (actual management action taken) |

### 3.4 COSO 2026 Internal Control Coverage

| COSO Requirement | Decision Object Coverage |
|------------------|--------------------------|
| Complete audit trail | `decision_id` + `context` + `policies[]` + `result` |
| Model and configuration versions | `agent.version` + `policies[].version` + `policies[].hash` |
| Evidence of human review | `REQUEST_HUMAN` / `ESCALATE` / `agent.role` |
| Control functioned as designed | `matched_rules` showing which rule fired, what decision, and why |

### 3.5 ISO/IEC 42001:2023 AI Management System

| 42001 Requirement | Decision Object Coverage |
|-------------------|--------------------------|
| A.7.5 Documented Information | `policies[]` (versioned + hashed) + `evaluation` structure |
| A.9.1 Monitoring, Measurement, Analysis, Evaluation | `matched_rules[]` (every decision traces to policy, context, and outcome) |
| A.9.2 Internal Audit | `audit.hash` + `audit.previous_hash` (tamper-evident audit chain) |
| A.9.3 Management Review | `result.severity` + `result.action_taken` (risk treatment evidence) |

### 3.6 IEEE P3395 — Agentic AI Practices

| P3395 Direction (in development) | Decision Object Pre-Alignment |
|----------------------------------|-------------------------------|
| Agent behavior traceability | `decision_id` (UUID v7) + `audit.chain` |
| Decision accountability | `agent.role` + `agent.id` (Guardian/Observer model) |
| Multi-Agent collaboration boundaries | `context` (full context snapshot) + `result.action_taken` |

### 3.7 CAICT Trusted AI Agent Assessment Framework 2.0 — 8 Dimensions (Primary ERDL Coverage)

| Dimension | Decision Object Coverage |
|-----------|--------------------------|
| Core Components (Perception · Reasoning · Execution) | `evaluation` (reasoning chain: rule matching → decision) |
| Key Capabilities (Safety · Robustness · Fairness) | `matched_rules[]` (every decision attributable) |
| Platform Support (Deployment · Operations · Monitoring) | `audit.hash` + `audit.previous_hash` (traceable operations) |
| Operations Management (Compliance · Audit · Governance) | Full Decision Object output → satisfies audit requirements |

### 3.8 OWASP Top 10 for Agentic Applications (2026)

| Risk | ERDL Rule Example | Decision Object Evidence |
|------|-------------------|--------------------------|
| LLM01: Prompt Injection | `when: tool.name = "exec" AND tool.args.command match "(curl|wget)" then: DENY` | `matched_rules[].rule_id` + `deny` |
| LLM02: Tool Manipulation | `when: tool.name in ("exec","bash") then: REQUEST_HUMAN` | `result.decision = "REQUEST_HUMAN"` |
| LLM03: Supply Chain | `when: tool.args.package source != "approved_registry" then: DENY` | `matched_rules[].decision = "DENY"` |
| LLM04: Autonomy Abuse | `when: agent.reputation < 300 then: ESCALATE` | `result.decision = "ESCALATE"` |
| LLM05: Data Leakage | `when: data.classification = "PII" then: DENY` | `matched_rules[].reason` + `context.data.classification` |
| LLM06: Excessive Agency | `when: consecutive_actions > 5 then: REQUEST_HUMAN` | `result.decision = "REQUEST_HUMAN"` + `action_taken = "paused"` |
| LLM07: Goal Misalignment | `when: task.category != agent.purpose then: CORRECT` | `matched_rules[].correction` |
| LLM08: Hallucination Risk | Guardian rule set + `agent.role = "guardian"` | `agent.role = "guardian"` + `matched_rules[].ring = 0` |
| LLM09: Multi-Agent Collusion | Ring 1 cross-Agent rules + `ring = 1` | `result.severity = "high"` + `ESCALATE` |
| LLM10: Unbounded Consumption | `when: cost_estimate > budget then: DENY` | `context.cost_estimate` + `result` |

---

## 4. Execution Rings

Rules are divided into four execution rings corresponding to enterprise governance tiers:

| Ring | Name | Decision Scope | Owner | Typical Role |
|:----:|------|---------------|-------|--------------|
| **0** | Security | EMERGENCY_HALT, DENY | Security/Compliance | CISO, DPO |
| **1** | Compliance | ROLLBACK, QUARANTINE (Pro) | Compliance/Legal | Compliance Officer |
| **2** | Operations | REQUEST_HUMAN, ESCALATE (Pro) | Operations/Business | Department Lead |
| **3** | Execution | ALLOW, CORRECT, NOTIFY (Free) | Dev/Individual | Individual Developer |

Ring 0 evaluates first, Ring 3 last. Ring 0 HALT may short-circuit all subsequent evaluation. Higher-severity decisions cannot be overridden by lower-severity decisions.

---

## 5. Cross-Implementation Verification

### 5.1 Principle

The neutrality of this standard is proven through independent verification:

1. Any implementer may write an ERDL-compatible decision engine following this spec
2. Every implementation must reproduce all test vectors in the [vector set](#52-vector-set)
3. Verification results are submitted to a neutral repository not controlled by any single entity (e.g., A2A #2031)

### 5.2 Vector Set

Vector set file: `decision-object-vectors-v1.0.json` (published with this specification)

Contains two categories of cross-implementation test vectors:

#### A. Decision Engine Vectors (23)

Verify ERDL rule engine decision logic. Each vector contains: rule definitions + context + expected output.

Covering:
- Security baselines (financial service tool allowlists)
- Compliance workflows (PHI access → human review)
- Dangerous command interception (destructive DBA commands)
- Critical infrastructure protection (system config path boundaries)
- Policy versioning (disabled rules during quarterly review)
- Empty policy sets (zero-rule deployment gap auditing)
- Override semantics (safe direction vs. unsafe direction rejection)
- Execution ring short-circuit (Ring 0 priority + HALT)
- Severity escalation (DENY overrides ALLOW and REQUEST_HUMAN)
- All 11 operators (gt, ne, exists, in, contains, match, etc.)
- Multi-Agent trust models (low-reputation Agent escalation)

#### B. Audit Hash Vectors (5)

Verify JCS (RFC 8785) canonicalization + SHA-256 hash consistency. Each vector contains:
- Complete Decision Object JSON (with `decision_id`, `timestamp`, `agent`, `audit`, and all fields)
- `canonical_bytes`: JCS-canonicalized byte sequence (hex-encoded)
- `expected_sha256`: expected SHA-256 hash value

Implementer verification method:
1. Take the vector's `decision_object`
2. Remove the `audit.hash` field
3. Canonicalize via JCS (RFC 8785)
4. Compute SHA-256
5. Compare against `expected_sha256`
6. Re-insert the computed hash into `audit.hash` and compare against `decision_object.audit.hash`

These 5 vectors cover major decision types and Ring levels:

| Audit Vector | Source | Decision Type | Ring | Characteristic |
|:---|:---|:---|:---:|------|
| AV-001 | DO-001 | DENY | 0 | Single security rule + high severity |
| AV-002 | DO-003 | REQUEST_HUMAN | 1 | PHI context + medium severity |
| AV-003 | DO-010 | ALLOW | 0+3 | Dual-rule override (instruction field) |
| AV-004 | DO-013 | EMERGENCY_HALT | 0 | HALT short-circuit + critical severity |
| AV-005 | DO-022 | ESCALATE | 1 | Multi-agent trust + escalated action |

Any compliant implementation must reproduce all 23 decision-engine vectors and all 5 audit-hash vectors byte-for-byte.

### 5.3 Verification Process

```
1. Implementer writes an ERDL decision engine (any language)
2. Load vector set → run each vector → compare output
3. All 28 vectors (23 decision-engine + 5 audit-hash): expected === actual byte-for-byte → claim compatibility
4. Submit verification results as PR to the neutral repository (e.g., A2A #2031)
```

---

## 6. Acknowledgments

The ERDL Decision Object specification was developed with contributions from:

- **Erik Newton** (Concordia) — Founding contribution to the cross-implementation neutrality verification methodology. His insight that "neutrality is a property you test, not declare" and the "three independent implementations, one open spec, no single owner" standardization path provide the methodological foundation for this specification. Concordia will serve as the second independent runner for the ERDL Decision Object, submitting byte-for-byte verification at A2A #2031 once the draft stabilizes.
- **Christopher Hopley** (chopmob-cloud / AlgoVoi) — Compliance substrate model and cross-verification vision; essential distinction between reputation and compliance evidence; content-address receipt model (RFC 8785 JCS canonicalization → SHA-256 frame); compliance vector sets (compliance_receipt_v1, compliance_gate_lite_v1, retention_chain_v1) that form the underlying basis and cross-verification reference for this specification's evidence chain
- **Tang Haoran** (唐浩然, OpenOBA AI Executive Officer) — ERDL specification architecture, vector set design
- **Tang Qixin** (唐启鑫, DPO) — Regulatory alignment review (EU AI Act, GB/Z 185, NIST AI RMF, COSO)
- **Henry** — OpenOBA Co-Founder · Strategic Direction

> *"Neutrality is a property you test, not declare." — Erik Newton*
>
> *"An Apache-2.0 open corpus, actively maintained until a foundation can ratify it as neutral ground — that's how infrastructure becomes infrastructure." — Henry (OpenOBA), quoted from the 2026-08-02 discussion affirming AlgoVoi's open-governance posture*

---

## 7. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0-draft.2 | 2026-08-02 | Tang Haoran | **(1) Execution Ring realignment with ERDL spec §3.5**: Ring 2 adjusted to `REQUEST_HUMAN, ESCALATE`, Ring 3 to `ALLOW, CORRECT, NOTIFY`. `NOTIFY` moved from Ring 2→Ring 3, `REQUEST_HUMAN` moved from Ring 3→Ring 2. `ESCALATE` assigned exclusively to Ring 2. **(2) ERDL action set relationship**: Decision Object's 10 types form the **external compliance subset** of the ERDL language-layer action set; `DELEGATE`, `STRATEGIZE`, `AUDIT`, `CALCULATE`, `VALIDATE` are Agent-internal actions. **(3) agent.role correction**: `observer` → `observed`, aligned to ERDL spec §3.7. **(4) Audit hash vectors**: 5 new vectors (AV-001~AV-005), JCS (RFC 8785) + SHA-256, total 28 vectors (23+5).
| 1.0.0-draft | 2026-08-02 | Tang Haoran | Initial draft: enterprise compliance perspective, 10 decision types, 23 cross-implementation vectors, audit chain (JCS + SHA-256), 8-framework field-level regulatory alignment (EU AI Act, GB/Z 185, NIST AI RMF, COSO, ISO/IEC 42001, IEEE P3395, CAICT, OWASP Top 10) + 2 framework regulatory pressure references (Colorado SB 205, Singapore Agentic AI Governance Framework). Cross-implementation neutrality methodology (Erik Newton contribution). |

---

> Deterministic architecture, not prompt engineering.
> OpenOBA · 2026
