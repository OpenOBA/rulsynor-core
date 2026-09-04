# ERDL Rule Authoring Guide

> For engine internals, see [DEVELOPMENT.md](./DEVELOPMENT.md).
> For the formal specification, see [ERDL Spec v2.1](./SPEC/erdl-spec.md).
> **Last updated**: 2026-09-03 — presets and loader migrated to the canonical ERDL document format (language spec v2.1 §2.1: `protocol`/`version`/`metadata`/`rules[]` + string `then`); this guide now documents that format end-to-end. Field paths canonical `tool.name`/`tool.args.*` (Entity namespace).

---

## Rule Anatomy

An ERDL rule lives inside a **document** — a single `*.erdl.yaml` file with the
canonical top-level shape (language spec v2.1 §2.1):

```yaml
protocol: "erdl/v2"             # Protocol identifier (fixed value)
version: "2.1.0"                # Rule-format version (semver)
metadata:
  name: my-rule-set             # Rule-set name
  description: "My guard rules"
  category: security            # Default category for rules without one
  decision: ALLOW               # Fallback decision when no rule matches (§2.2)
  tags: [example]
rules:
  - name: SEC-001-block-exec    # Required: [CAT]-[NNN]-desc, unique
    description: "Block dangerous exec commands"
    category: security          # Rule-level category (defaults to metadata.category)
    priority: 900               # Lower number = higher priority (1-1000)
    override: high              # critical > high > normal > low (§7.1; optional)
    ring: 0                     # 0 = check first, 3 = check last
    enabled: true               # Rule enabled flag (default true)
    when:                       # Trigger condition
      logic: AND                # AND = all conditions, OR = any
      conditions:
        - field: "tool.name"     # Field path — Entity namespace (see below)
          operator: eq           # Comparison operator
          value: "exec"
        - field: "tool.args.command"
          operator: match
          value: "(rm\\s+-rf|shutdown)"
    then: DENY                   # String decision type (§6)
    message: "Destructive command blocked."   # Decision message (blocking MUST be non-empty)
    instruction: "Use a read tool to inspect first."  # ALLOW + instruction guidance
    correction: "Rewrite the path to an app directory."  # CORRECT decision fix text
    unless: null                # Exemption block (§4.1; optional)
    explanation:                # Bilingual why (optional)
      zh: "防止破坏性命令"
      en: "Prevents destructive commands"
    alternative: "Inspect the target before destructive changes."  # Blocked alternative
    legal_basis: "Article 23(2)"  # Regulation clause (optional)
    source_text: "..."            # Original regulation text (optional)
```

**Field order** (language spec §4.1): `name` → `description` → `category` → `priority` → `override`
→ `ring` → `enabled` → `when` → `then` → `message` → `instruction` → `correction`
→ `unless` → `explanation` → `alternative` → `legal_basis` → `source_text`.

`then` is a **string** — the decision type — not an object. The decision message,
instruction, alternative and correction are separate rule-level fields.

A document MAY contain many rules under `rules[]`; the bundled presets use one
document per category pack (`security.erdl.yaml`, `compliance.erdl.yaml`,
`integrity.erdl.yaml`).

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

> **30 operators** (28 condition operators + 2 modifiers `within`/`rate`, Spec v2.1 §5.2). The 28 condition operators are covered by V-ENGINE cross-implementation vectors. Temporal operators (`within`/`rate`) are stateful; their window counts are snapshotted into `evaluation.temporal_state` automatically (RFC-002 §2.4).

### Equality & Comparison

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `eq` | Equal (deep comparison for objects) | `"exec"` | `tool.name = "exec"` |
| `ne` | Not equal | `"read"` | `tool.name ≠ "read"` |
| `gt` | Greater than (numbers only) | `5000` | `amount > 5000` |
| `gte` | Greater than or equal | `100` | `count >= 100` |
| `lt` | Less than | `10` | `size < 10` |
| `lte` | Less than or equal | `200` | `chars <= 200` |

### Set & Substring

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `in` | Value in array | `["write_file","exec"]` | `tool.name` is `"exec"` |
| `not_in` | Value not in array | `["rm","del"]` | `cmd` is `"ls"` |
| `contains` | String contains substring | `"DROP TABLE"` | `"sql: DROP TABLE users"` |
| `not_contains` | String does not contain substring | `"password"` | `"SELECT * FROM users"` |

### Pattern Matching

| Operator | Description | Example `value` | Example Match |
|----------|-------------|----------------|---------------|
| `match` | Regex match (ReDoS-protected) | `"^rm\\s+-rf"` | `"rm -rf /"` |
| `starts_with` | String starts with | `"/etc/"` | `"/etc/hosts"` |
| `ends_with` | String ends with | `".js"` | `"app.js"` |

### Existence

| Operator | Description | `value` Required? | Behavior |
|----------|-------------|:---:|----------|
| `exists` | Field is present and not null | No | Returns `true` if field exists and has a value |
| `not_exists` | Field is missing or null | No | Returns `true` if field is absent |

⚠️ Field absence ≠ null comparison. If `tool.args.command` is missing from the context, `eq null` returns `false` (safe default — avoids accidental DENY).

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

⚠️ Temporal rules (`within`/`rate`) are stateful: their window counts enter `evaluation.temporal_state` automatically (RFC-002 §2.4) — no manual commit step.

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
| `DELEGATE` | Delegate to another agent/role | Handed off to another agent | Specialized task handoff |
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

All `match` operators go through `safeRegExp()` which rejects:
- Nested quantifiers (`(a+)+` → exponential backtracking)
- Patterns longer than 200 characters
- Invalid regex syntax

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

Each pattern below is a single rule — drop it under a document's `rules[]`.

### Security Intercept (Ring 0)

```yaml
- name: SEC-900-block-dangerous-command
  description: "Block destructive commands"
  ring: 0
  priority: 900
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "exec"
      - field: "tool.args.command"
        operator: match
        value: "(rm\\s+-rf|shutdown|dd\\s+if=)"
  then: DENY
  message: "Destructive command blocked."
```

### Compliance Approval (Ring 1)

```yaml
- name: CMP-900-approve-large-transaction
  description: "Large transactions need human approval"
  ring: 1
  priority: 500
  when:
    logic: AND
    conditions:
      - field: "context.amount"
        operator: gt
        value: 5000
      - field: "context.transaction_type"
        operator: eq
        value: "financial"
  then: REQUEST_HUMAN
  message: "Transaction exceeds $5,000 threshold. Human approval required."
```

### Auto-Correction (Ring 2)

```yaml
- name: SEC-901-correct-unsafe-path
  description: "Suggest a safe path for system writes"
  ring: 2
  priority: 300
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "write_file"
      - field: "tool.args.path"
        operator: starts_with
        value: "/etc/"
  then: CORRECT
  message: "System paths are read-only. Change to the application directory."
  correction: "Change path from /etc/ to /var/app/."
```

### Resource Protection (Ring 3)

```yaml
- name: PERF-900-large-write-advisory
  description: "Log large writes, suggest chunking"
  ring: 3
  priority: 300
  when:
    logic: AND
    conditions:
      - field: "tool.name"
        operator: eq
        value: "write_file"
      - field: "tool.args.content"
        operator: length_gt
        value: 10485760
  then: ALLOW
  instruction: "Large file write (>10MB) logged. Consider chunking."
```

### Professional Integrity (Ring 0)

```yaml
- name: ETH-900-promise-readonly-writes
  description: "A read-only promise must not be broken"
  ring: 0
  priority: 850
  when:
    logic: AND
    conditions:
      - field: "context.previous_promise"
        operator: eq
        value: "read_only"
      - field: "tool.name"
        operator: in
        value: ["write_file", "exec", "apply_patch", "delete"]
  then: REQUEST_HUMAN
  message: "You stated read-only intent but are now attempting a write."
  alternative:
    en: "If you need to write, state your reason and get approval."
```
