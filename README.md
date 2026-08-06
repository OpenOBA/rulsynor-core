# @rulsynor/core

> **Open-source deterministic Guard engine for AI Agents.**
>
> Rulsynor is the open-source core of the [OpenOBA](https://openoba.com) platform. It gives your AI Agent a **deterministic safety layer** — every tool call is intercepted, evaluated against ERDL rules, and documented with cryptographically verifiable audit evidence.

```bash
npm install @rulsynor/core
```

## Quick Start

```typescript
import { Evaluator, GuardStateManager, buildDecisionObject, loadPresetRules, toRuleDefinitions } from '@rulsynor/core';

// 1. Load preset security rules
const presetRules = loadPresetRules();
const rules = toRuleDefinitions(presetRules);

// 2. Create the Guard engine
const state = new GuardStateManager();
const evaluator = new Evaluator(state);

// 3. Evaluate a tool call
const result = evaluator.evaluate(rules, {
  toolName: 'exec',
  toolArgs: { command: 'rm -rf /' },
  sessionId: 'session-1',
  agentId: 'my-agent',
});

// 4. Build a cryptographic Decision Object
const do1 = buildDecisionObject({
  input: { runId: 'r1', step: 0, toolName: 'exec', toolArgs: { command: 'rm -rf /' },
           context: {}, agentId: 'my-agent', sessionId: 's1' },
  decision: result.decision,
  actionTaken: result.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: result.primaryReason ?? null,
  matchedRules: result.matchedRules,
  totalEvaluated: result.totalEvaluated,
  totalMatched: result.totalMatched,
  rules,
  evaluationDurationMs: 15,
});

console.log('Decision:', result.decision);         // → 'DENY'
console.log('Audit hash:', do1.audit.hash);          // → 'sha256:a1b2c3...'
console.log('Agent AID:', do1.agent.aid);            // → '1.2.156.3088.1.000001.000001.abcdef01'
console.log('Compliance:', do1.compliance_profile.jurisdictions); // → ['CN']
```

**That's it.** 30 seconds to your first cryptographically verifiable Guard evaluation.

## What You Get

| Capability | Description |
|-----------|-------------|
| **Deterministic Guard** | Tool calls are intercepted BEFORE execution — not after. Rules are evaluated by a safe expression engine, not by LLM prompt constraints. |
| **Decision Object** | Every Guard evaluation produces a 25-field, [JCS (RFC 8785)](https://datatracker.ietf.org/doc/rfc8785/) + SHA-256 hashed audit record. Tamper-evident and cross-implementation verifiable. |
| **14-Regulation Compliance** | Pre-built jurisdiction-aware compliance profiles for EU AI Act, GB/Z 185, NIST AI RMF, COSO 2026, and more. |
| **GB/Z 185 AID** | OID-prefixed Agent Identity Codes (`1.2.156.3088.1.xxx.xxx.xxxxxxxx`) compliant with China's Agent Interconnection standard. |
| **Preset Rules** | 32 security rules out of the box: destructive commands, SSRF, SQL injection, path traversal, fork bombs, credential leaks, and more. |
| **Zero Framework Dependency** | Core engine has zero NestJS/framework dependencies. Use it in any Node.js project. |

## API Reference

### Engine

#### `Evaluator`
```typescript
import { Evaluator, GuardStateManager } from '@rulsynor/core';
const evaluator = new Evaluator(new GuardStateManager());
const result = evaluator.evaluate(rules, evalContext);
```
- `evaluate(rules: CompiledRule[], context: EvalContext): EvalResult`
- Returns `{ decision, matchedRules, totalEvaluated, totalMatched, primaryReason, primaryCorrection }`

#### `SafeExprEvaluator`
```typescript
import { SafeExprEvaluator } from '@rulsynor/core';
const expr = new SafeExprEvaluator();
expr.evaluate(condition, context); // → boolean
```
Safe expression evaluator — no `eval()`, no code injection. Pure recursive descent parser.

#### `RuleCompilerImpl`
```typescript
import { RuleCompilerImpl } from '@rulsynor/core';
const compiler = new RuleCompilerImpl();
compiler.compile(ruleDefinition); // → CompiledRule
```

### Decision Object

#### `buildDecisionObject(opts)`
```typescript
import { buildDecisionObject } from '@rulsynor/core';

const do1 = buildDecisionObject({
  input: { runId, step, toolName, toolArgs, context, agentId, sessionId, previousAuditHash? },
  decision: 'ALLOW' | 'DENY' | 'REQUEST_HUMAN' | 'ESCALATE' | 'CORRECT' | 'QUARANTINE' | 'EMERGENCY_HALT',
  actionTaken: 'allowed' | 'blocked' | 'paused' | 'halted' | 'quarantined' | 'escalated',
  reason: string | null,
  matchedRules: Array<{ ruleId: string; decision: string; ring?: number; reason?: string }>,
  totalEvaluated: number,
  totalMatched: number,
  rules: Array<{ name: string; version?: number }>,
  evaluationDurationMs: number,
  modelId?: string,
});
```
Returns a 25-field Decision Object with `audit.hash` = `SHA-256(JCS(all fields minus audit.hash, signature, signing_key_id))`.

### Compliance

#### `getComplianceProfile()`
```typescript
import { getComplianceProfile } from '@rulsynor/core';
const cp = getComplianceProfile();
// → { profile_id, jurisdictions, activated_fields, regulatory_references, ... }
```
Reads `RULSYNOR_JURISDICTIONS` env var (default: `CN`). Returns activated fields + regulatory references for the configured jurisdictions.

### AID

#### `generateAID()`
```typescript
import { generateAID } from '@rulsynor/core';
const aid = generateAID(); // → '1.2.156.3088.1.000001.000001.abcdef01'
```
GB/Z 185 Part 2 compliant Agent Identity Code using OID prefix `1.2.156.3088`.

### Provenance

```typescript
import { PROVENANCE } from '@rulsynor/core';
console.log(PROVENANCE.product);  // → 'Rulsynor Agent Engine'
console.log(PROVENANCE.version);  // → '1.0.0-alpha.1'
console.log(PROVENANCE.license);  // → 'MIT'
```

### Rules

```typescript
import { loadPresetRules, toRuleDefinitions } from '@rulsynor/core';
const presetRules = loadPresetRules();       // Load bundled .erdl.yaml files
const rules = toRuleDefinitions(presetRules); // Convert to Evaluator-compatible format
```

## Decision Object Schema

| # | Field | Type | Description |
|---|-------|------|-------------|
| 1 | `spec` | `"decision-object-v1.0"` | Format identifier |
| 2 | `decision_id` | UUID v7 | Unique decision ID |
| 3 | `compliance_profile` | object | Jurisdiction activation config |
| 4 | `execution_trace_id` | UUID v7 | Global correlation ID |
| 5 | `timestamp` | ISO 8601 | Decision timestamp |
| 6 | `evaluation_duration_ms` | integer | Evaluation time in ms |
| 7 | `agent` | object (8 fields) | Agent identity + AID |
| 8 | `model_id` | string | LLM model identifier |
| 9 | `context` | object | Evaluation context |
| 10 | `context_snapshot_hash` | `sha256:...` | Context hash |
| 11 | `sanitized_context` | string\|null | Sanitized context |
| 12 | `rule_set_version` | object | Rule set version |
| 13 | `policies` | array | Active policies |
| 14 | `evaluation` | object (3 fields) | Rule evaluation details |
| 15 | `result` | object (5 fields) | Final decision |
| 16 | `human_oversight` | boolean | Human intervention required |
| 17 | `audit` | object (3 fields) | Tamper-proof audit |
| 18 | `impact_assessment_id` | UUID v7 | Impact assessment |
| 19 | `fairness_assessment` | string | Fairness status |
| 20 | `autonomy_level` | L0-L3 | Autonomy level |
| 21 | `confidence_score` | 0-100 | Confidence score |
| 22 | `data_modification_expected` | boolean | Data modification flag |
| 23 | `extensions` | array | Extension zone |
| 24 | `signature` | string | ECDSA placeholder |
| 25 | `signing_key_id` | string | Key identifier |

## Regulations Covered

| Framework | Jurisdiction | DO Fields Activated |
|-----------|:---:|------|
| EU AI Act (Regulation 2024/1689) | EU | `model_id`, `agent.known_limitations`, `confidence_score`, `fairness_assessment`, `impact_assessment_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| GB/Z 185-2026 | CN | `agent.aid`, `agent.tool_registry_hash`, `agent.algorithm_filing_no`, `agent.model_registration_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| NIST AI RMF 1.0 | US | `model_id`, `confidence_score`, `fairness_assessment`, `impact_assessment_id`, `data_modification_expected`, `autonomy_level`, `context_snapshot_hash`, `sanitized_context`, `signature` |
| COSO GenAI 2026 | ALL | Cross-cutting — all fields applicable |
| Singapore MGF | SG | `autonomy_level`, `confidence_score`, `data_modification_expected` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RULSYNOR_JURISDICTIONS` | `CN` | Comma-separated jurisdiction codes (EU,CN,US,SG) |
| `RULSYNOR_INDUSTRY` | `financial-services` | Industry classification |
| `RULSYNOR_RISK_LEVEL` | `high` | Risk level (low/medium/high/critical) |
| `RULSYNOR_AUTONOMY_LEVEL` | `L2` | Autonomy level (L0-L3) |
| `RULSYNOR_MODEL_ID` | `unknown` | LLM model identifier |
| `RULSYNOR_AID_REGISTRAR` | `000001` | AID registrar code |
| `RULSYNOR_AID_REQUESTER` | `000001` | AID requester code |

## Cross-Implementation Verification

Every Decision Object produced by `@rulsynor/core` can be independently verified by the [ERDL Decision Object vector set](https://github.com/OpenOBA/erdl-vectors) — a public 101-vector cross-implementation test suite.

Verification formula:
```
audit.hash = SHA-256(JCS(all 25 fields minus audit.hash, signature, signing_key_id))
```

[Concordia](https://github.com/OpenOBA/erdl-vectors) (Erik Newton) has independently verified the ERDL Decision Object format using a clean-room Python implementation — 13/13 vectors byte-identical.

## License

MIT © 2026 OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

---

[OpenOBA](https://openoba.com) — Enterprise AI Digital Executor Platform
