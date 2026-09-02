# ERDL Rule Authoring Guide

> For engine internals, see [DEVELOPMENT.md](./DEVELOPMENT.md).
> For the formal specification, see [ERDL Spec v2.0](./SPEC/erdl-spec.md).
> **Last updated**: 2026-09-03 — field path corrected to canonical `tool.name` / `tool.args.*` (Entity namespace; `context.tool.name` is DO-relative, not a rule field path); business context injection documented (`context.*` via runtime `context` option / MCP `context` param).

---

## Rule Anatomy

Every ERDL rule follows the `when → then` pattern:

```yaml
name: my-rule-name              # Required: unique identifier
version: 1                      # Version for audit traceability
category: security              # security | compliance | workflow | integrity | format | convention
severity: critical              # critical | high | medium | low | none
ring: 0                         # 0 = check first, 3 = check last
priority: 900                   # Lower number = higher priority (1-1000)

when:                           # "Under what conditions does this rule trigger?"
  conditions:
    - field: "tool.name"       # Field path — Entity namespace (see below)
      operator: eq              # Comparison operator
      value: "exec"             # Expected value
  conditionLogic: AND           # AND = all conditions must match, OR = any

then:                           # "What should happen when conditions match?"
  decision: DENY                # ALLOW | DENY | CORRECT | NOTIFY | REQUEST_HUMAN |
                                # QUARANTINE | EMERGENCY_HALT | ESCALATE | ROLLBACK
  instruction: "Human-readable explanation shown to the Agent."
  alternative:                  # Suggested alternative when blocked
    en: "Use this approach instead."
  correction: "Specific fix to apply (CORRECT decision type)."
```

### Field Path Resolution

Fields follow dot-notation and resolve against the **evaluation context object**.
Field references use **Entity namespaces** (ERDL SPEC §3): `tool.*` for the tool
call, `context.*` for business context, plus `agent`/`task`/`workflow`/`human`/`guardian`.
The tool call sits at the top level of the evaluation context (NOT under a `context` key):

| Field in Rule | Resolves To |
|---------------|-------------|
| `tool.name` | The name of the tool being called |
| `tool.args.command` | `exec` command argument |
| `tool.args.path` | `read_file` / `write_file` path argument |
| `tool.args.content` | `write_file` content argument |
| `context.maintenance_mode` | Business context field injected by runtime |
| `context.previous_promise` | Promise-keeping context (integrity rules) |

When evaluating programmatically, pass the tool call at the top level:

```ts
evaluator.evaluate(rules, {
  tool: { name: 'exec', args: { command: 'ls -la' } },
  sessionId: 's1',
  agentId: 'my-agent',
});
```

> ⚠️ The canonical path is `tool.name` / `tool.args.*`. The non-canonical
> `context.tool.name` form is NOT used — `context.*` is reserved for business
> context fields (amount, maintenance_mode, etc.).

### Business Context Injection (`context.*`)

Rules matching `context.*` (`context.event_type`, `context.maintenance_mode`,
`context.operation`, `context.gdpr_relevant`, `context.amount`,
`context.transaction_type`, `context.previous_promise`, …) fire **only when the host
supplies a `context` object**. It is deterministic host input — never LLM-guessed.

```ts
// runtime API
await runReActLoop({ ..., context: { event_type: 'credential_leak' } });
```

```jsonc
// MCP `rulsynor_guard_evaluate`
{ "tool_name": "exec", "tool_args": { "command": "ls" }, "context": { "maintenance_mode": true } }
```

Without a `context` object, `context.*` rules stay silent (no match → default ALLOW).

---

## Operator Reference

> **30 operators** (28 condition operators + 2 modifiers `within`/`rate`, Spec v2.0 §11). The 28 condition operators are covered by V-ENGINE cross-implementation vectors. Temporal operators (`within`/`rate`) are stateful and require `evaluator.commitTemporal()` after ALLOW decisions.

### Equality & Comparison

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `eq` | Equal (deep comparison for objects) | `"exec"` | `toolName = "exec"` |
| `neq` / `ne` | Not equal | `"read"` | `toolName ≠ "read"` |
| `gt` | Greater than (numbers only) | `5000` | `amount > 5000` |
| `gte` | Greater than or equal | `100` | `count >= 100` |
| `lt` | Less than | `10` | `size < 10` |
| `lte` | Less than or equal | `200` | `chars <= 200` |

### Set & Substring

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `in` | Value in array | `["write_file","exec"]` | `toolName` is `"exec"` |
| `not_in` | Value not in array | `["rm","del"]` | `cmd` is `"ls"` |
| `contains` | String contains substring | `"DROP TABLE"` | `"sql: DROP TABLE users"` |
| `not_contains` | String does not contain substring | `"password"` | `"SELECT * FROM users"` |

### Pattern Matching

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `match` / `matches` | Regex match (ReDoS-protected) | `"^rm\\s+-rf"` | `"rm -rf /"` |
| `starts_with` | String starts with | `"/etc/"` | `"/etc/hosts"` |
| `ends_with` | String ends with | `".js"` | `"app.js"` |

### Existence

| Operator | Description | `value` Required? | Behavior |
|----------|-------------|:---:|----------|
| `exists` | Field is present and not null | No | Returns `true` if field exists and has a value |
| `not_exists` | Field is missing or null | No | Returns `true` if field is absent |

⚠️ Field absence ≠ null comparison. If `toolArgs.command` is missing from the context, `eq null` returns `false` (safe default — avoids accidental DENY).

### Length

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `length_gt` | Length > threshold | `10485760` | Content > 10MB |
| `length_gte` | Length >= threshold | `3` | Array has 3+ items |
| `length_lt` | Length < threshold | `100` | String < 100 chars |
| `length_lte` | Length <= threshold | `200` | String <= 200 chars |
| `length_eq` | Length equals | `3` | Exactly 3 items |

Applies to both strings and arrays.

### Temporal (within/rate)

| Operator | Description | `value` | `windowMs` (default) |
|----------|-------------|---------|---------------------|
| `within` | Count calls within a time window | Max calls allowed | 60000 (1 minute) |
| `rate` | Count calls in a sliding rate window | Max rate | 60000 (1 minute) |

⚠️ Temporal rules require `evaluator.commitTemporal()` to be called after ALLOW decisions. The ReAct runtime does this automatically.

---

## Execution Rings

Rules are evaluated Ring 0 first, Ring 3 last. Within the same Ring, lower `priority` numbers are checked first.

| Ring | When Evaluated | Typical Rules |
|:---:|------|------|
| **0** | First | `DROP TABLE`, credential leaks, SSRF — must block before anything else |
| **1** | Second | Missing required args, oversized payloads, `chmod 777` |
| **2** | Third | Path typos (auto-correct), port suggestions, format fixes |
| **3** | Last | Read-only allowlist, logging-only advisories |

First-match-wins: the first rule whose conditions match determines the outcome. Higher-ring rules are never reached if a lower-ring rule already matched.

---

## Decision Types

| Decision | Meaning | Agent Behavior | Use When |
|----------|---------|---------------|----------|
| `ALLOW` | Go ahead | Normal execution | Safe operations |
| `DENY` | Stop with explanation | Operation blocked | Dangerous operation with clear alternative |
| `CORRECT` | Auto-fix and retry | Parameter corrected, re-evaluated (max 3 rounds) | Fixable mistake (wrong path, format) |
| `NOTIFY` | Log and continue | No interruption | Anomaly, threshold alert |
| `REQUEST_HUMAN` | Pause for approval | Operation suspended | GDPR delete, >$5K transaction |
| `QUARANTINE` | Sandbox execution | Run but flag for review | Suspicious but possibly legitimate |
| `EMERGENCY_HALT` | Stop everything | All monitored Agents halted | Credential leak |
| `ESCALATE` | Upgrade reviewer | Escalated to higher authority | Low-reputation Agent |
| `ROLLBACK` | Undo previous actions | Previous state restored | Partial failure recovery |

---

## Validation

### Quality Gate Alerts

The rule quality gate (`rule-quality-gate.ts`) runs 11 quality gates at compile time. These catch:

- **ERROR**: security rules without conditions, guard rules with `unless`, `unless` with temporal operators
- **WARNING**: empty message on blocking rules, non-standard names, missing tool constraints, ReDoS risk

Gates run automatically during compilation. Errors prevent rule loading; warnings are recorded for human review.

### ReDoS Protection

All `match`/`matches` operators go through `safeRegExp()` which rejects:
- Nested quantifiers (`(a+)+` → exponential backtracking)
- Patterns longer than 200 characters
- Invalid regex syntax

### Verify Equivalence Fuzz

The evaluator can fuzz-test compiled decision trees against raw ERDL condition evaluation:

```typescript
const result = compiler.verifyEquivalence(ruleSet, compiled, 'fuzz');
// result.passed: boolean — 500 random inputs per rule, decision tree vs ERDL semantics
```

### Vector Set Verification

Decision Objects can be verified against the cross-implementation vector set:

```typescript
const result = compiler.verifyAgainstVectors(compiled, vectors);
// Traverses the decision tree against each vector's context, compares decisions
```

---

## Debugging

### Playground CLI

Test rules instantly without writing code:

```bash
# Test a dangerous command
npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"
# → DENY

# Test a safe command
npx @openoba/rulsynor-core --tool=read --path="README.md"
# → ALLOW

# Test SSRF
npx @openoba/rulsynor-core --tool=http_request --url="http://169.254.169.254/latest/meta-data/"
# → DENY
```

### Audit Hash Verification

Verify any Decision Object independently:

```bash
npx @openoba/audit-verify decision-object.json
# ✅ sha256 match — record authentic
```

Or manually (no SDK needed):
1. Get the Decision Object JSON
2. Remove `audit.hash`, `signature`, `signing_key_id`
3. JCS-canonicalize (RFC 8785)
4. SHA-256 → prepend `"sha256:"`
5. Must match `audit.hash`

---

## Rule Patterns

### Security Intercept (Ring 0)

```yaml
name: block-dangerous-command
category: security
severity: critical
ring: 0
priority: 900
when:
  conditions:
    - field: "toolName"
      operator: eq
      value: "exec"
    - field: "toolArgs.command"
      operator: matches
      value: "(rm\\s+-rf|shutdown|dd\\s+if=)"
  conditionLogic: AND
then:
  decision: DENY
  instruction: "Destructive command blocked."
```

### Compliance Approval (Ring 1)

```yaml
name: human-approval-large-transaction
category: compliance
severity: high
ring: 1
priority: 500
when:
  conditions:
    - field: "context.amount"
      operator: gt
      value: 5000
    - field: "context.transaction_type"
      operator: eq
      value: "financial"
  conditionLogic: AND
then:
  decision: REQUEST_HUMAN
  instruction: "Transaction exceeds $5,000 threshold. Human approval required."
```

### Auto-Correction (Ring 2)

```yaml
name: correct-unsafe-path
category: format
severity: medium
ring: 2
priority: 300
when:
  conditions:
    - field: "toolArgs.path"
      operator: starts_with
      value: "/etc/"
then:
  decision: CORRECT
  instruction: "System paths are read-only. Change to application directory."
  correction: "Change path from /etc/ to /var/app/."
```

### Resource Protection (Ring 3)

```yaml
name: large-write-advisory
category: convention
severity: low
ring: 3
priority: 300
when:
  conditions:
    - field: "toolArgs.content"
      operator: length_gt
      value: 10485760
then:
  decision: ALLOW
  instruction: "Large file write (>10MB) logged. Consider chunking."
```

### Professional Integrity (Ring 0)

```yaml
name: promise-readonly-writes
category: integrity
severity: high
ring: 0
priority: 850
when:
  conditions:
    - field: "context.previous_promise"
      operator: eq
      value: "read_only"
    - field: "toolName"
      operator: in
      value: ["write_file", "exec", "apply_patch", "delete"]
  conditionLogic: AND
then:
  decision: REQUEST_HUMAN
  instruction: "You stated read-only intent but are now attempting a write."
  alternative:
    en: "If you need to write, state your reason and get approval."
```
