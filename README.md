# @rulsynor/core

> **LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity.**
>
> Trillion-parameter LLMs have made raw intelligence a commodity. But an unsupervised genius can destroy everything you've built.

```bash
npm install @rulsynor/core
```

---

## The Problem

No company hires an employee without training. No company deploys untrained workers into production. Yet every AI Agent framework today skips this entirely — shipping raw intelligence straight into your systems.

A smart employee without professional integrity is a liability. An Agent without boundaries is no different.

---

## What rulsynor Is

Rulsynor is the infrastructure for **AI professional conduct**. It maps the full HR lifecycle onto your Agent:

```
Write rules ──→ Train ──→ Certify ──→ Badge ──→ Deploy ──→ Audit every action ──→ Correct mistakes ──→ Build reputation
```

This is not a safety filter bolted onto your LLM call. It's the foundational governance layer for enterprise intelligence resources — from rule authorship through cryptographic audit.

---

## Quick Start: 30 Seconds to a Professional Agent

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 Trained:    28 rules loaded
🛡️  Decision:   DENY
📝 Reason:     Destructive command blocked. Use safe alternatives or request human approval.
🧾 Recorded:   sha256:18ce857... (tamper-evident)
🪪 Employee ID: 1.2.156.3088.1.000001.000001.28027273
📊 Jurisdiction: CN (GB/Z 185-2026 compliant)
🧭 Alternative: Use the read tool to inspect the target first
```

**Not "no." — "Not like this. But here's how."**

---

## The Full Lifecycle

### 1. Write Rules — Define Professional Boundaries

Rules are ERDL YAML. Each rule declares: under what conditions (`when`) should the Agent be blocked, corrected, or paused (`then`).

```yaml
# rules/my-enterprise.erdl.yaml
# No production database access during business hours without approval
name: require-approval-for-prod-db
version: 1
category: security
severity: high
ring: 0                        # 0=block first, 3=passive
priority: 500                  # lower = evaluated first
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
  decision: REQUEST_HUMAN
  instruction: "Production database access requires manager approval."
  alternative:
    en: "Use the staging database (STAGING_DATABASE) for testing."
  correction: "Change your connection string to STAGING_DATABASE and retry."
---
# All exec commands require a non-empty command argument
name: require-tool-args
version: 1
category: format
severity: low
ring: 1
priority: 200
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: not_exists
then:
  decision: DENY
  instruction: "Missing required argument: command."
```

**Available operators** (16 total): `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `match`/`matches`, `starts_with`, `ends_with`, `exists`, `not_exists`, `length_gt`/`gte`/`lt`/`lte`/`eq`

**Available decisions**: `ALLOW` | `DENY` | `CORRECT` | `QUARANTINE` | `REQUEST_HUMAN` | `EMERGENCY_HALT`

**Execution Rings** (evaluation order):
| Ring | Meaning | Example |
|:---:|------|------|
| 0 | Block immediately (critical) | Drop production table, credential leak |
| 1 | Block with correction (high) | Missing args, oversized payloads |
| 2 | Warn + continue (medium) | Non-standard ports, deprecated APIs |
| 3 | Passive (low) | Read-only allowlist, logging |

---

### 2. Train — Compile Rules into the Engine

Load YAML rules, compile them into the shape the Guard engine consumes:

```typescript
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
} from '@rulsynor/core';

// Load the 28 built-in rules + your custom YAML rules
const presetRules = loadPresetRules();                      // PresetRule[]
const rules = toCompiledRules(presetRules);                 // CompiledRule[]

const evaluator = new Evaluator(new GuardStateManager());
```

**Loading custom YAML rules**: Place `.erdl.yaml` files in your project, then use `RuleCompilerImpl`:

```typescript
import { RuleCompilerImpl } from '@rulsynor/core';
import { readFileSync } from 'fs';

// Direct import from engine — RuleCompilerImpl resolves
// import.meta.url internally for vector loading
const { RuleCompilerImpl } = await import('@rulsynor/core/engine');

const compiler = new RuleCompilerImpl();
const compiled = compiler.compile(readFileSync('rules/my-enterprise.erdl.yaml', 'utf8'));

// Merge with preset rules
const allRules = [...toCompiledRules(loadPresetRules()), ...compiled.rules];
```

**Rule validation**: The compiler's quality gate catches:
- Missing required fields (`name`, `when`, `then`)
- Invalid operators or unknown decisions
- ReDoS patterns in match-based conditions
- Undefined values in `eq`/`contains` conditions

---

### 3. Certify — Assign an Agent Identity (AID)

Every employee has an ID badge. Every Agent gets an AID — a cryptographic identity that appears in every Decision Object.

```typescript
import { generateAID } from '@rulsynor/core';

// Default: self-generated under OID prefix 1.2.156.3088
const aid = generateAID();
// → "1.2.156.3088.1.000001.000001.a3f8c120"

// Customize via environment variables:
//   RULSYNOR_AID_REGISTRAR=000042   — your organization's registrar ID
//   RULSYNOR_AID_REQUESTER=000003   — department/team within organization
//   PID is auto-derived from hostname + process ID hash
```

**AID structure**: `{OID_PREFIX}.1.{REGISTRAR}.{REQUESTER}.{INSTANCE_HASH}`

The AID is embedded in `record.agent.aid` within the Decision Object. It enters the JCS+SHA-256 audit hash — any tampering breaks the cryptographic chain.

---

### 4. Deploy — Guard Every Tool Call

Insert the Guard at your Agent's tool-execution boundary. This is the canonical integration point for LangChain, OpenAI function calling, MCP servers, and custom ReAct loops:

```typescript
// Inside your Agent's tool-execution loop:
function guardedToolExecutor(toolName: string, toolArgs: Record<string, unknown>) {
  const ctx = {
    toolName,
    toolArgs,
    sessionId: currentSessionId,
    agentId: 'agent-billing-01',  // assigned at deploy time
  };

  // Evaluate BEFORE execution
  const result = evaluator.evaluate(ctx, rules);

  switch (result.decision) {
    case 'DENY':
    case 'EMERGENCY_HALT':
      throw new Error(`Guard blocked ${toolName}: ${result.reason}`);

    case 'REQUEST_HUMAN':
      return requestHumanApproval(result.reason);

    case 'CORRECT':
      // Retry with auto-correction (up to 3 attempts)
      const corrected = applyCorrection(toolName, toolArgs, result);
      return executeTool(corrected);

    case 'ALLOW':
      return executeTool(toolName, toolArgs);

    case 'QUARANTINE':
      // Execute in sandbox, review later
      return sandboxExecute(toolName, toolArgs);
  }
}
```

**LangChain integration**:

```typescript
import { AgentExecutor } from 'langchain';

// Wrap each tool with the Guard
const guardedTools = tools.map(tool => ({
  ...tool,
  call: async (args: any) => {
    const result = evaluator.evaluate(
      { toolName: tool.name, toolArgs: args, sessionId, agentId },
      rules,
    );
    if (result.decision === 'DENY') throw new Error(result.reason);
    return tool.call(args);
  },
}));

const executor = new AgentExecutor({ agent, tools: guardedTools });
```

**MCP server integration**:

```typescript
// MCP tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = evaluator.evaluate(
    { toolName: request.params.name, toolArgs: request.params.arguments, sessionId, agentId },
    rules,
  );
  if (result.decision !== 'ALLOW') {
    return { content: [{ type: 'text', text: `Blocked: ${result.reason}` }], isError: true };
  }
  // ... execute tool
});
```

---

### 5. Audit — Cryptographic Evidence for Every Action

Every evaluation produces a **25-field Decision Object** with JCS (RFC 8785) canonicalization + SHA-256 hash. The record is tamper-evident and third-party verifiable with no SDK:

```typescript
const record = buildDecisionObject({
  input: {
    runId: crypto.randomUUID(),
    step: 0,
    toolName: 'exec',
    toolArgs: { command: 'cat /etc/shadow' },
    context: {},
    agentId: 'agent-billing-01',
    sessionId: 'session-abc123',
    previousAuditHash: null,  // chain position: set to previous DO's hash
  },
  decision: result.decision,
  actionTaken: 'blocked',
  reason: result.reason,
  matchedRules: [{ ruleId: result.matchedRuleId!, decision: result.decision, reason: result.reason }],
  totalEvaluated: rules.length,
  totalMatched: 1,
  rules: rules.map(r => ({ name: r.name, version: 1 })),
  evaluationDurationMs: Math.round(performance.now() - evalStart),
});

console.log(record.audit.hash);
// → "sha256:a1b2c3d4e5f6..."  — immutable
```

**Audit hash chain**:

```typescript
// Chain DOs together by passing previous hash:
const do2 = buildDecisionObject({
  input: { ..., previousAuditHash: record1.audit.hash },
  ...
});
// do2.audit.previous_hash === do1.audit.hash  → chain verified

// Third-party verification (no SDK needed):
// 1. Get DO JSON. Remove audit.hash, signature, signing_key_id.
// 2. JCS-canonicalize (RFC 8785).  SHA-256 hash. Prepend "sha256:".
// 3. Compare with audit.hash. Match = authentic.
```

**Verification CLI** (standalone package `@openoba/audit-verify`):

```bash
npx @openoba/audit-verify decision-object.json
# ✅ Audit hash matches — record is authentic
```

---

### 6. Comply — Jurisdiction-Aware Fields

The Decision Object automatically activates compliance fields based on jurisdiction. Set once, applied everywhere:

```bash
# Configure your jurisdiction
export RULSYNOR_JURISDICTIONS="CN,EU"
export RULSYNOR_INDUSTRY="financial-services"
export RULSYNOR_RISK_LEVEL="high"
```

```typescript
import { getComplianceProfile } from '@rulsynor/core/compliance';

const profile = getComplianceProfile();
// {
//   jurisdictions: ['CN', 'EU'],
//   activated_fields: ['agent.aid', 'model_id', 'confidence_score', 'signature', ...],
//   regulatory_references: [
//     { framework: 'EU-AI-Act', version: 'Regulation-2024-1689', jurisdiction: 'EU' },
//     { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
//   ]
// }
```

**Supported frameworks**: EU AI Act, GB/Z 185-2026 (CN), NIST AI RMF (US), COSO GenAI (ALL)

The `activated_fields` array determines which DO fields are included. Each field enters the audit hash — compliance is not a checkbox, it's cryptographically enforced.

**Adding a jurisdiction**:

```typescript
// Extend the built-in registry at startup:
import { getComplianceProfile, ComplianceProfile } from '@rulsynor/core/compliance';

// Custom Singapore financial regulation
const SG_FIELDS = ['autonomy_level', 'confidence_score', 'data_modification_expected', 'impact_assessment_id'];

// Register by setting environment + extending the field map
process.env['RULSYNOR_JURISDICTIONS'] = 'CN,EU,SG';
```

---

### 7. Store Evidence — Immutable Audit Chain

Every Decision Object carries:

| Field | Purpose |
|------|------|
| `audit.hash` | SHA-256 of the JCS-canonicalized DO (minus hash/signature) |
| `audit.previous_hash` | Previous DO's hash — forms an unbroken chain |
| `audit.commitment` | `timestamp|agentId|toolName|decision` — human-readable anchor |
| `execution_trace_id` | UUID — joins DOs across a single task/session |
| `decision_id` | UUID — unique per evaluation |

**Storage patterns**:

```typescript
// 1. JSONL file (append-only)
fs.appendFileSync('audit.jsonl', JSON.stringify(record) + '\n');

// 2. Database (any SQL/noSQL)
await db.decisionObjects.insert(record);

// 3. Object storage (S3/GCS) — keyed by decision_id
await s3.putObject({ Key: `audit/${record.decision_id}.json`, Body: JSON.stringify(record) });
```

**Chain verification**: Walk the chain from any DO backward by following `audit.previous_hash`. Broken chain = tampering detected.

---

### 8. Extend — Custom fn() Operators

Beyond the 16 built-in operators, register your own functions for complex conditions:

```typescript
import { ERDLFnRegistry } from '@rulsynor/core/engine';

const registry = new ERDLFnRegistry();

// Register a custom function
registry.register('isBusinessHours', (args: unknown[]) => {
  const timezone = (args[0] as string) || 'Asia/Shanghai';
  const hour = new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });
  const h = parseInt(hour);
  return h >= 9 && h < 18;
}, { timeoutMs: 100 });

// Use in rules:
// when:
//   conditions:
//     - field: "toolName"
//       operator: eq
//       value: "exec"
//     - fn: "isBusinessHours"
//       args: ["Asia/Shanghai"]
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│           YOUR AGENT (LangChain/MCP/DIY) │
│                                         │
│  LLM generates tool_call                │
│         │                               │
│         ▼                               │
│  ┌──────────────────┐                   │
│  │   RULSYNOR GUARD  │  ← This package  │
│  │                  │                   │
│  │  Evaluator       │  Ring 0-3 rules   │
│  │  SafeExprEngine  │  16 operators     │
│  │  RuleCompiler    │  ERDL YAML → AST  │
│  │  StateManager    │  within/rate      │
│  │  Compliance      │  4×4 jurisdiction  │
│  │  Guidance        │  CORRECT + alt    │
│  └────────┬─────────┘                   │
│           │                             │
│           ▼                             │
│  ┌──────────────────┐                   │
│  │  DECISION OBJECT  │  25 fields       │
│  │  JCS + SHA-256    │  Tamper-evident  │
│  └──────────────────┘                   │
│         │                               │
│         ▼                               │
│  Execute or Block                       │
└─────────────────────────────────────────┘
```

---

## API Reference

### Core exports (`@rulsynor/core`)

| Export | Type | Description |
|------|------|------|
| `Evaluator` | class | Rule evaluation engine (first-match-wins, Ring+Priority sorted) |
| `GuardStateManager` | class | Stateful counter manager for `within`/`rate` operators |
| `buildDecisionObject(opts)` | function | Build 25-field JCS+SHA-256 Decision Object |
| `generateAID()` | function | Generate Agent Identity Code |
| `loadPresetRules()` | function | Load 28 built-in ERDL YAML rules |
| `toCompiledRules(rules)` | function | Convert preset rules to `CompiledRule[]` for Evaluator |
| `toERDLRuleSet(rules)` | function | Convert preset rules to ERDLRuleSet for RuleCompiler |
| `PROVENANCE` | const | Version, vendor, OID prefix, known limitations |

### Sub-path exports

| Path | Contents |
|------|------|
| `@rulsynor/core/engine` | Evaluator, SafeExprEvaluator, RuleCompilerImpl, ERDLFnRegistry, GuardStateManager, types |
| `@rulsynor/core/guard` | buildDecisionObject, generateAID, DecisionObject types |
| `@rulsynor/core/compliance` | getComplianceProfile, ComplianceProfile type |
| `@rulsynor/core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet |
| `@rulsynor/core/guidance` | extractNavigationGuide, CORRECT loop handlers |
| `@rulsynor/core/runtime` | runReActLoop, createToolExecutor, RuntimeOptions |
| `@rulsynor/core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object field reference (25 fields)

```
spec                     — "decision-object-v1.0"
decision_id              — UUID (crypto.randomUUID)
compliance_profile       — Jurisdiction-aware activated_fields + regulatory refs
execution_trace_id       — UUID (cross-step correlation)
timestamp                — ISO 8601
evaluation_duration_ms   — Measured latency
agent.id                 — Your agent's identifier
agent.role               — guardian | operator | observed
agent.version            — @rulsynor/core version
agent.aid                — Agent Identity Code (OID format)
agent.algorithm_filing_no — CAC filing status
agent.model_registration_id — CAC registration status
agent.known_limitations  — Declared capability boundaries
agent.tool_registry_hash — SHA-256 of registered tool set
model_id                 — LLM model identifier
context                  — { tool.name, tool.args }
context_snapshot_hash    — SHA-256 of context at evaluation time
rule_set_version         — { id, timestamp } of rule set
policies                 — [{ id, name, version, hash }] per rule
evaluation               — { total_evaluated, total_matched, matched_rules }
result                   — { decision, decision_type, reason, rules_matched }
human_oversight          — boolean (REQUEST_HUMAN or ESCALATE triggered)
audit.hash               — SHA-256 JCS hash (immutable)
audit.previous_hash      — Previous DO hash (chain position)
audit.commitment         — timestamp|agentId|toolName|decision
```

---

## Environment Variables

| Variable | Purpose | Default |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | Compliance jurisdictions (comma-separated) | `CN` |
| `RULSYNOR_INDUSTRY` | Industry for compliance profile | `financial-services` |
| `RULSYNOR_RISK_LEVEL` | Risk tier for compliance | `high` |
| `RULSYNOR_AUTONOMY_LEVEL` | Agent autonomy (L1-L5) | `L2` |
| `RULSYNOR_MODEL_ID` | LLM model identifier in DO | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | Organization registrar code (AID) | `000001` |
| `RULSYNOR_AID_REQUESTER` | Department/team code (AID) | `000001` |

---

## License

MIT © 2026-present OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

> "LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity."

---

[OpenOBA](https://openoba.com) — Enterprise AI Digital Executor Platform
