# @rulsynor/core

> **Not another AI tool. This is a digital employee onboarding and qualification system.**
>
> Install SDK → Load job rules → Compile certification → Issue employee ID (AID) → Deploy to work → Every action cryptographically recorded → Guidance on rejection → Growth archive → Annual audit.

```bash
npm install @rulsynor/core
```

## This is Not a "Guard"

Every AI Agent framework does the same thing: let LLMs call tools. LangChain, CrewAI, AutoGen — they solve "how an Agent does things."

**Rulsynor solves "who is qualified to do things."**

The difference:

| | Traditional Agent Frameworks | Rulsynor |
|------|------|------|
| Positioning | LLM + Tools = Agent | Train + Certify + Deploy + Audit = Digital Employee |
| Safety | "Please don't delete the database" in a prompt | Deterministic rule engine, 16 operators, code-level interception |
| Trust | "We use GPT-4" | Every decision produces a JCS+SHA-256 cryptographic audit record, third-party independently verifiable |
| Compliance | None | GB/Z 185 Employee ID (AID) + EU AI Act / NIST / COSO compliance matrix across 4 jurisdictions |
| Growth | None | CORRECT auto-fix loop, Navigation Guide, performance history |

## Digital Employee Lifecycle

```
📋 Hire (install)     →  npm install @rulsynor/core
📚 Train (loadRules)   →  32 preset security rules + custom business rules
🔍 Certify (compile)   →  RuleCompiler 4-product compilation + Golden Tests
🪪 ID Badge (AID)      →  GB/Z 185 standard Agent Identity Code
🛡️ Deploy (evaluate)   →  Deterministic evaluation before every tool call: ALLOW / DENY / CORRECT / QUARANTINE / EMERGENCY_HALT
🧾 Record (buildDO)    →  25-field Decision Object, JCS+SHA-256 cryptographic hash, tamper-evident
🧭 Grow (guidance)     →  CORRECT auto-fix (3 rounds → escalate to human); Navigation Guide tells LLM why + how to fix
📊 Audit (verify)      →  Audit chain via previous_hash; audit-verify CLI for zero-dependency independent verification
```

## 30-Second Experience

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 Training: 32 rules loaded
🛡️ Decision: DENY
📝 Reason: Destructive command blocked.
🧾 Audit hash: sha256:d72a...
🪪 Employee ID: 1.2.156.3088.1.000001.000001.7521ba66
📊 Jurisdiction: CN
🧭 Guidance: Use read tool instead of exec
```

## Quick Start — 10 Lines

```typescript
import { Evaluator, GuardStateManager, buildDecisionObject } from '@rulsynor/core';

// 1. Deploy your employee
const evaluator = new Evaluator(new GuardStateManager());

// 2. Evaluate every action
const result = evaluator.evaluate(rules, {
  toolName: 'exec',
  toolArgs: { command: 'rm -rf /' },
  sessionId: 'session-1',
  agentId: 'my-agent',
});

// 3. Cryptographic audit record
const do1 = buildDecisionObject({
  input: { runId: 'r1', step: 0, toolName: 'exec', toolArgs: { command: 'rm -rf /' },
           context: {}, agentId: 'my-agent', sessionId: 's1' },
  decision: result.decision,
  actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: result.reason,
  matchedRules: [],
  totalEvaluated: 1, totalMatched: 0,
  rules: [], evaluationDurationMs: 5,
});

console.log(result.decision);        // → 'DENY'
console.log(do1.audit.hash);         // → 'sha256:a1b2c3...' (tamper-evident)
console.log(do1.agent.aid);          // → '1.2.156.3088.1...' (employee ID)
```

## Core Capabilities

### 📚 Train — 32 Preset Rules + Custom Business Rules

Employees must be trained before deployment. 32 preset security rules cover:

- Destructive commands (rm -rf, fork bomb, chmod 777)
- SSRF prevention (internal IPs, metadata endpoints)
- System path write protection (/etc/, /sys/, Windows system dirs)
- SQL injection + XSS detection
- Privilege escalation (sudo, base64-encoded payloads)
- Rate limiting + large file write prevention
- GDPR deletion human approval

Write your own business rules in YAML:

```yaml
name: large-transaction-approval
category: compliance
ring: 1
priority: 500
description: "Transactions over $5,000 require human approval"
when:
  conditions:
    - field: "context.amount"
      operator: gt
      value: 5000
then:
  decision: REQUEST_HUMAN
  instruction: "Amount exceeds threshold. Financial manager approval required."
```

### 🔍 Certify — RuleCompiler 4-Product Compilation

Every rule is compiled into four parallel products:
- **ComplianceSchema**: JSON Schema constraints (60-70% mappable)
- **GuidanceArtifact**: Risk profile for System Prompt injection
- **GuardDirective**: Deterministic decision tree
- **AuditTemplate**: Audit field mapping

### 🪪 ID Badge — GB/Z 185 Agent Identity Code

Every digital employee gets a unique identity code compliant with China's Agent Interconnection standard:
`1.2.156.3088.1.<registrar>.<requester>.<8-hex-id>`

### 🛡️ Deploy — Deterministic Evaluation Engine

Not an LLM prompt constraint. "Please don't delete files" is not a security boundary.

16 SafeExpr operators (eq, ne, gt, gte, lt, lte, in, not_in, contains, match, exists, starts_with, ends_with, and, or, not). Pure recursive descent parser. Zero code injection surface.

Evaluation order: Ring 0 (security baseline) → Ring 3 (default policy). First-match-wins by Ring + Priority. No match → ALLOW (default).

### 🧾 Record — Cryptographic, Tamper-Evident Audit

Every decision produces a 25-field Decision Object:

```
audit.hash = SHA-256(JCS(25 fields - audit.hash - signature - signing_key_id))
```

Any field tampered → hash changes → traceable. Verify with `@openoba/audit-verify` — zero-dependency CLI, no Rulsynor required.

### 🧭 Grow — Rejection is Not the End

- **CORRECT Loop**: 3 rounds of auto-correction → escalate to human
- **Navigation Guide**: DENY includes why, how to fix, and alternatives
- **Career Archive**: Every DO linked via `audit.previous_hash` forming an immutable career record

## API Reference

### Train & Certify

```typescript
import { loadPresetRules, toERDLRuleSet, RuleCompilerImpl } from '@rulsynor/core';
const rules = loadPresetRules();
const ruleSet = toERDLRuleSet(rules);
const compiled = new RuleCompilerImpl().compile(ruleSet);
```

### Deploy

```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';
const evaluator = new Evaluator(new GuardStateManager());
const result = evaluator.evaluate(rules, context);
```

### Record

```typescript
import { buildDecisionObject, generateAID } from '@rulsynor/core';
const do1 = buildDecisionObject({ /* opts */ });
const aid = generateAID();
```

### Grow

```typescript
import { extractNavigationGuide, advanceCorrectLoop, parseRequestHumanSignal } from '@rulsynor/core';
const guide = extractNavigationGuide({ matchedRules, decision, reason });
```

### Compliance

```typescript
import { getComplianceProfile } from '@rulsynor/core';
const cp = getComplianceProfile();
```

## Decision Object Schema (25 Fields)

| Field | Type | Description |
|-------|------|-------------|
| `spec` | `"decision-object-v1.0"` | Format identifier |
| `decision_id` | UUID v7 | Unique decision ID |
| `compliance_profile` | object | Jurisdiction activation config |
| `agent` | object (8 fields) | Agent identity + AID |
| `audit` | object (3 fields) | Tamper-proof audit (hash + previous_hash + commitment) |
| `context` | object | Evaluation context snapshot |
| `result` | object (5 fields) | Final decision + applied rule |
| ... | ... | 25 fields total |

## Cross-Implementation Verification

Any third party can independently verify your employee's actions using pure JCS+SHA-256:

```bash
npx @openoba/audit-verify single decision.json
# ✅ Status: PASS
```

[ERDL Decision Object Vector Set](https://github.com/OpenOBA/erdl-vectors) — 101 cross-implementation test vectors.

## Digital Employee vs Traditional Agent

| | Traditional Agent | Rulsynor Digital Employee |
|------|------|------|
| Hiring | pip install langchain | **npm install @rulsynor/core** |
| Training | None | **32 preset rules + YAML custom** |
| Certification | None | **RuleCompiler 4-product compilation** |
| Badge | None | **GB/Z 185 AID** |
| Deployment | LLM prompt constraint | **Deterministic engine (16 op)** |
| Records | Logs (mutable) | **JCS+SHA-256 DO (tamper-evident)** |
| On rejection | Silent failure | **CORRECT loop + Guidance** |
| Compliance | None | **4 regulations × 4 jurisdictions** |
| Audit | None | **previous_hash chain** |
| Third-party verify | Opaque | **audit-verify CLI** |

## License

MIT © 2026 OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

> "LLM vendors deliver IQ. We deliver employees."

---

[OpenOBA](https://openoba.com) — Enterprise AI Digital Executor Platform
