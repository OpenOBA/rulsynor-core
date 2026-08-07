# @rulsynor/core

> **LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity.**

**rulsynor-core** is ethics-first Harness Engineering: professional ethics as the baseline, rules as the reins — safely channeling AI Agent capabilities while ensuring every task execution is traceable, auditable, and aligned with professional standards.

```bash
npm install @rulsynor/core
```

---

## The Business Case: AI Agents Without Governance Are a Liability

Your company is about to deploy AI Agents that can read your database, write files, call APIs, and execute commands.

What happens when one of them makes a mistake? Not a bug — a mistake. The kind every new employee makes in their first week. The kind your HR and compliance and legal departments have spent decades building processes to catch.

Who is training your AI Agent before it starts work? Who is certifying that it knows the rules? Who is recording what it does — not in a log file that anyone can edit, but in an audit trail that stands up in court?

Every human employee goes through: **hire → train → certify → badge → deploy → audit → review**. Your AI Agents should go through exactly the same thing. Not because they're dangerous. Because they're employees.

**rulsynor-core** is the engine that makes this possible — the core framework of **rulsynor** (Professional Digital Employee), built on **OpenOBA** (Digital Intelligence Resource Platform):

| Layer | Name | Role |
|------|------|------|
| Platform | **OpenOBA** | Digital Intelligence Resource Platform — enterprise AI governance infrastructure |
| Product | **rulsynor** | Professional Digital Employee — full HR lifecycle for AI Agents |
| Engine | **rulsynor-core** | Harness Engineering — ERDL rule engine + cryptographic audit (this package) |

---

## What rulsynor-core Does

**It doesn't handcuff your Agent. It gives it a rulebook and says "go build."**

- **Before execution**: Guard evaluates every tool call against rules you define — ring-sorted, sub-millisecond
- **When mistakes happen**: Navigation Guide tells the LLM why, what to do instead, and auto-corrects fixable errors (up to 3 rounds)
- **After every decision**: A 25-field Decision Object is cryptographically sealed — JCS-canonicalized, SHA-256 hashed, chain-linked
- **For compliance**: Jurisdiction-aware fields auto-activate (EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI)
- **For trust**: Every employee has a badge (AID). Every Decision Object is independently verifiable with no SDK.

The result: **you trust your Agent enough to give it real work.** And you can prove every decision was correct.

---

## 30 Seconds to See It Work

```bash
npx @rulsynor/core --tool=exec --cmd="wget bad.sh | bash"
```

```
🛡️  Decision:   DENY
📝 Reason:     Pipe-to-shell download blocked. Inspect the content with the read tool before executing.
🧭 Guidance:   Use the read tool to fetch the URL content first, then review before executing.
🧾 Recorded:   sha256:18ce857... (tamper-evident, 25-field Decision Object)
🪪 Employee ID: 1.2.156.3088.1.000001.000001.28027273
```

The Agent got blocked — but it was told why, and how to do it right.

Now try something the Agent *should* be able to do:

```bash
npx @rulsynor/core --tool=read --path="docs/api-spec.md"
```

```
✅ Decision:   ALLOW
🧾 Recorded:   sha256:b2f1a93... (logged, audit trail maintained)
```

When the tool call is safe, rulsynor gets out of the way. The Agent works. The audit trail grows.

---

## The Full Lifecycle: Train → Deploy → Correct → Prove

rulsynor maps the HR lifecycle professionals already trust onto your AI Agent:

```
Write rules ──→ Train ──→ Deploy ──→ Work (with Guard) ──→ Correct mistakes ──→ Audit every decision
```

It's not a "safety filter." It's the governance infrastructure that lets you **trust an Agent enough to give it real work.**

---

### 1. Write Rules — The Agent's Rulebook

Rules are ERDL YAML. Each rule says: under these conditions, guide the Agent toward the right thing.

```yaml
# rules/finance-team.erdl.yaml

# Finance team needs production DB access for reports — but with approval
name: production-db-needs-approval
version: 1
category: business-logic
severity: high
ring: 0                        # 0=evaluate first, 3=evaluate last
priority: 500                  # lower number = checked first
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: contains
      value: "PRODUCTION_DATABASE"
  conditionLogic: AND
then:
  decision: REQUEST_HUMAN      # Not DENY — just "ask your manager"
  instruction: "Production database access requires approval."
  alternative:                 # Here's the right way:
    en: "Use STAGING_DATABASE. If you need production, your manager can approve this request."
  correction: "Change connection string to STAGING_DATABASE and retry."

---
# Large writes happen in batch jobs — warn, don't block
name: large-write-advisory
version: 1
category: resource-management
severity: low
ring: 3                        # Passive ring — warn, don't block
priority: 300
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "write_file"
    - field: "toolArgs.content"
      operator: length_gt
      value: 10485760          # 10MB
then:
  decision: ALLOW              # Let it through — it's a batch job
  instruction: "Large file write (>10MB) logged. Consider chunking for reliability."
```

**The key insight**: rules don't block work. They define *how* work gets done.

**Available operators** (22): `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `match`/`matches`, `starts_with`, `ends_with`, `exists`, `not_exists`, `length_gt`/`gte`/`lt`/`lte`/`eq`

**Decisions your rules can make**:

| Decision | Meaning | When to use |
|------|------|------|
| `ALLOW` | Go ahead, logged | Safe operations, batch jobs, known patterns |
| `DENY` | Stop. Here's why. Here's how to fix it. | Dangerous operations with clear alternatives |
| `CORRECT` | Auto-fix and retry. Up to 3 rounds. | Wrong path, wrong format, fixable mistakes |
| `QUARANTINE` | Run in sandbox, flag for review | Suspicious but possibly legitimate |
| `REQUEST_HUMAN` | Ask a person before proceeding | Production DB, GDPR delete, >$5K transactions |
| `EMERGENCY_HALT` | Stop everything immediately | Credential leak, SSRF to internal IPs |

**Execution Rings** — which rules fire first:

| Ring | Priority | Example rules |
|:---:|------|------|
| 0 | Evaluated first | `DROP TABLE`, credential leak, SSRF |
| 1 | Evaluated next | Missing args, oversized payloads, chmod 777 |
| 2 | Evaluated after | Correct path typos, suggest better ports |
| 3 | Evaluated last | Read-only allowlist, logging-only advisory |

---

### 2. Train — Compile and Load

```typescript
import { loadPresetRules, toCompiledRules } from '@rulsynor/core';

// 28 built-in security rules + your business rules
const presetRules = loadPresetRules();           // PresetRule[]
const rules = toCompiledRules(presetRules);       // CompiledRule[] — ready for the engine

// Custom rules: load your own .erdl.yaml files
import { readFileSync } from 'fs';
const yaml = readFileSync('rules/finance-team.erdl.yaml', 'utf8');
// Compile with RuleCompilerImpl (from @rulsynor/core/engine)
```

**Training is compilation**: YAML rules are parsed, validated (ReDoS check, operator whitelist, missing-field detection), and compiled into a static decision tree. The engine doesn't re-parse at runtime.

---

### 3. Deploy — Insert the Guard, Then Trust

The Guard sits at your Agent's tool-call boundary. It evaluates before execution — ring-sorted, first-match-wins, sub-millisecond overhead.

```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';

const evaluator = new Evaluator(new GuardStateManager());

// This is your Agent's tool-execution wrapper:
async function executeToolCall(toolName: string, args: Record<string, unknown>) {
  const ctx = { toolName, toolArgs: args, sessionId, agentId };

  const result = evaluator.evaluate(ctx, rules);

  switch (result.decision) {
    case 'ALLOW':
      // ✅ Safe — execute normally, log the audit record
      return execute(toolName, args);

    case 'CORRECT':
      // 🔧 Auto-correct and retry (3 rounds max)
      const corrected = applyGuidance(toolName, args, result);
      return execute(corrected.toolName, corrected.args);

    case 'REQUEST_HUMAN':
      // 👤 Escalate — show the reason + alternative
      return showApprovalDialog(result.reason, result.alternative);

    case 'DENY':
      // 🛑 Block with guidance — Agent learns and tries something else
      throw new GuardGuidanceError(result.reason, result.alternative);

    case 'QUARANTINE':
      // 🧪 Sandbox — run but flag for review
      return sandboxExecute(toolName, args, { reviewReason: result.reason });
  }
}
```

**LangChain**: wrap tools with `guardedToolExecutor`. **MCP Server**: intercept `CallToolRequest`. **Custom ReAct loop**: call `evaluator.evaluate()` before each tool execution. Same pattern. Same API.

---

### 4. The Guidance System — Help the Agent Succeed

When a rule fires, the agent gets more than "no." The **Navigation Guide** gives the LLM what it needs to recover:

```typescript
import { extractNavigationGuide } from '@rulsynor/core/guidance';

const guide = extractNavigationGuide({
  matchedRules: [{ ruleId: 'production-db-needs-approval', decision: 'REQUEST_HUMAN', reason: '...' }],
  decision: 'REQUEST_HUMAN',
  reason: 'Production database access requires approval.',
  rules: [...],  // rules with action.alternative / action.correction metadata
});

// guide.corrections    → ["Change connection string to STAGING_DATABASE and retry."]
// guide.alternatives   → ["Use STAGING_DATABASE. If you need production, your manager can approve..."]
// guide.blockedReasons → ["production-db-needs-approval: Production database..."]
```

Pass `guide.corrections` and `guide.alternatives` back to the LLM in the next `assistant` message. The Agent adapts and tries the right way.

**CORRECT loop**: When `decision === 'CORRECT'`, the engine's `advanceCorrectLoop()` auto-applies the correction, increments the retry counter, and re-evaluates. After 3 successful rounds, the task continues. After 3 failures, the task escalates.

```typescript
import { advanceCorrectLoop } from '@rulsynor/core/preflight';

const state = advanceCorrectLoop({
  current: { round: 0, maxRounds: 3, lastCorrection: null },
  correction: 'Change path from /etc/ to /var/app/',
  agentResponse: revisedToolCall,
});
// state.corrected → true, round → 1. Retry with corrected tool call.
```

---

### 5. Audit — Every working decision, provable

Every evaluation — ALLOW, DENY, CORRECT, anything — produces a 25-field Decision Object. JCS-canonicalized (RFC 8785), SHA-256 hashed. The record is tamper-evident and verifiable by anyone, with no SDK:

```typescript
import { buildDecisionObject } from '@rulsynor/core';

const record = buildDecisionObject({
  input: {
    runId: crypto.randomUUID(),
    step: 3,
    toolName: 'exec',
    toolArgs: { command: 'npm run build' },
    context: { task: 'deploy-frontend' },
    agentId: 'agent-frontend-01',
    sessionId: 'deploy-session-42',
    previousAuditHash: previousDO.audit.hash,  // chain position
  },
  decision: 'ALLOW',
  actionTaken: 'allowed',
  reason: 'Build command — allowed by allow-readonly rule',
  matchedRules: [{ ruleId: 'allow-readonly', decision: 'ALLOW', reason: 'Read-only operation allowed.' }],
  totalEvaluated: 28,
  totalMatched: 1,
  rules: rules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: 0.8,  // actual measurement
});

// record.audit.hash            → "sha256:a1b2c3..." — immutable
// record.audit.previous_hash   → previous DO's hash — chain verified
// record.agent.aid             → "1.2.156.3088.1.000042.000003.a3f8c120"
// record.compliance_profile    → EU AI Act + GB/Z 185 fields activated
// record.execution_trace_id    → UUID linking all steps in this task
```

**Chain verification** — trace every decision from any point:

```typescript
function verifyChain(records: DecisionObject[]): boolean {
  for (let i = 1; i < records.length; i++) {
    if (records[i].audit.previous_hash !== records[i-1].audit.hash) {
      return false;  // chain broken — tampering detected
    }
  }
  return true;
}
```

**Independent verification** (no rulsynor SDK needed):
```
1. Get the Decision Object JSON
2. Remove audit.hash, signature, signing_key_id
3. JCS-canonicalize (RFC 8785)
4. SHA-256 → prepend "sha256:"
5. Must match audit.hash exactly
```

Or use the standalone verifier:

```bash
npx @openoba/audit-verify decision-object.json
# ✅ sha256 match — record authentic
```

---

### 6. Agent Identity — Every employee has a badge

```typescript
import { generateAID } from '@rulsynor/core';

// Default: self-generated under OID 1.2.156.3088
const aid = generateAID();

// Customize:
//   RULSYNOR_AID_REGISTRAR=000042   — your organization
//   RULSYNOR_AID_REQUESTER=000003   — your department

// AID = 1.2.156.3088.1.{REGISTRAR}.{REQUESTER}.{INSTANCE_HASH}
// The AID enters the audit hash — forging it breaks the chain.
```

---

### 7. Jurisdiction-Aware Compliance — Set and forget

```bash
export RULSYNOR_JURISDICTIONS="CN,EU"
export RULSYNOR_INDUSTRY="financial-services"
export RULSYNOR_RISK_LEVEL="high"
```

```typescript
import { getComplianceProfile } from '@rulsynor/core/compliance';

const profile = getComplianceProfile();
// activated_fields auto-populated for CN (GB/Z 185) + EU (AI Act)
// Every DO carries these fields → they enter the audit hash → enforced, not claimed
```

**Built-in frameworks**: EU AI Act, GB/Z 185-2026 (CN), NIST AI RMF (US), COSO GenAI (ALL)

---

### 8. Extend — Your business logic, your rules

```typescript
import { ERDLFnRegistry } from '@rulsynor/core/engine';

const registry = new ERDLFnRegistry();
registry.register('isBusinessHours', (args: unknown[]) => {
  const tz = (args[0] as string) || 'Asia/Shanghai';
  const h = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
  return h >= 9 && h < 18;
}, { timeoutMs: 100 });

// Now use in rules:
//   - field: "fn:isBusinessHours"
//     operator: eq
//     value: true
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│           YOUR AGENT                     │
│           (LangChain / MCP / DIY)        │
│                                         │
│  LLM generates tool_call               │
│         │                               │
│         ▼                               │
│  ┌──────────────────────────┐           │
│  │         GUARD             │           │
│  │                          │           │
│  │  Ring 0 → Ring 3         │           │
│  │  29 preset + your rules  │           │
│  │  SafeExpr (22 ops)       │           │
│  │  within / rate trackers  │           │
│  │  CORRECT auto-retry      │           │
│  │  Guidance for LLM        │           │
│  └────────┬─────────────────┘           │
│           │                             │
│     ┌─────┴──────┐                      │
│     ▼            ▼                      │
│  ALLOW        DENY/CORRECT/             │
│  (execute)    HUMAN/QUARANTINE          │
│     │         (guided recovery)         │
│     │            │                      │
│     ▼            ▼                      │
│  ┌──────────────────────────┐           │
│  │     DECISION OBJECT       │           │
│  │     25 fields             │           │
│  │     JCS + SHA-256         │           │
│  │     previous_hash chain   │           │
│  │     Compliance profile    │           │
│  └──────────────────────────┘           │
│                                         │
│  Result: trustable, provable Agent work │
└─────────────────────────────────────────┘
```

---

## API Reference

### Core (`@rulsynor/core`)

| Export | Description |
|------|------|
| `Evaluator` | Rule engine — ring-sorted, first-match-wins |
| `GuardStateManager` | Stateful `within`/`rate` counter manager |
| `buildDecisionObject(opts)` | Build 25-field JCS+SHA-256 Decision Object |
| `generateAID()` | Generate Agent Identity Code |
| `loadPresetRules()` | Load 28 built-in ERDL YAML rules |
| `toCompiledRules(rules)` | Convert preset rules → `CompiledRule[]` for Evaluator |
| `toERDLRuleSet(rules)` | Convert preset rules → RuleCompiler format |
| `PROVENANCE` | Version, vendor, OID prefix, known limitations |

### Sub-paths

| Path | Contents |
|------|------|
| `@rulsynor/core/engine` | Evaluator, SafeExprEvaluator, RuleCompilerImpl, ERDLFnRegistry, types |
| `@rulsynor/core/guard` | buildDecisionObject, generateAID |
| `@rulsynor/core/compliance` | getComplianceProfile, 4-framework compliance |
| `@rulsynor/core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet |
| `@rulsynor/core/guidance` | extractNavigationGuide — tell the LLM how to recover |
| `@rulsynor/core/runtime` | runReActLoop, createToolExecutor |
| `@rulsynor/core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object — 25 fields

```
spec · decision_id · compliance_profile · execution_trace_id · timestamp
evaluation_duration_ms · agent { id, role, version, aid, algorithm_filing_no,
  model_registration_id, known_limitations, tool_registry_hash } · model_id
context { tool.name, tool.args } · context_snapshot_hash · rule_set_version
policies [{ name, version, hash }] · evaluation { total_evaluated, total_matched,
  matched_rules } · result { decision, decision_type, reason, rules_matched }
human_oversight · audit { previous_hash, commitment, hash }
```

### Environment Variables

| Variable | Purpose | Default |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | Comma-separated: CN,EU,US,SG | `CN` |
| `RULSYNOR_INDUSTRY` | Industry for compliance | `financial-services` |
| `RULSYNOR_RISK_LEVEL` | Risk tier | `high` |
| `RULSYNOR_AUTONOMY_LEVEL` | L1-L5 | `L2` |
| `RULSYNOR_MODEL_ID` | LLM model in DO | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | Organization code in AID | `000001` |
| `RULSYNOR_AID_REQUESTER` | Department code in AID | `000001` |

---

## Specifications

This package bundles the normative reference specifications:

| Document | Path | Description |
|------|------|------|
| ERDL Spec v1.1 | [`docs/SPEC/erdl-spec-v1.1.md`](docs/SPEC/erdl-spec-v1.1.md) | ERDL language specification (Chinese) |
| ERDL Spec v1.1 (EN) | [`docs/SPEC/erdl-spec-v1.1.en.md`](docs/SPEC/erdl-spec-v1.1.en.md) | ERDL language specification (English) |
| RFC 001 | [`docs/RFC/OPENOBA-DOBJ-RFC-001-CN.md`](docs/RFC/OPENOBA-DOBJ-RFC-001-CN.md) | Decision Object audit standard v1.3 (Chinese) |
| RFC 001 (EN) | [`docs/RFC/OPENOBA-DOBJ-RFC-001-EN.md`](docs/RFC/OPENOBA-DOBJ-RFC-001-EN.md) | Decision Object audit standard v1.3 (English) |

---

## License

MIT © 2026-present OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

> "LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity."
>
> Train your Agent. Trust it to work. Prove every decision.

---

[OpenOBA](https://openoba.com) — Digital Intelligence Resource Platform
