# RULE-PROMPT.md — Generate ERDL Rules from Natural Language

You don't need to know YAML to write rules for rulsynor-core. Copy the prompt template
below, paste it into any LLM (ChatGPT, Claude, Gemini, …), replace the
`{{DESCRIBE YOUR RULES HERE}}` placeholder with what you want — in plain English or
plain Chinese — and the LLM will return valid ERDL YAML you can save as
`your-rules.erdl.yaml` and load directly into the engine.

> **Tip:** Describe *behavior*, not syntax. "Block any command that deletes tables"
> is enough. The more concrete you are (tool names, thresholds, file paths), the
> better the generated conditions.

---

## The Prompt Template (copy everything inside the box)

```text
You are an ERDL rule author for rulsynor-core, an AI Agent governance engine.
I will describe rules in natural language. You translate them into valid ERDL
YAML, ready to save as a .erdl.yaml file. Follow this reference exactly.

═══════════════════════════════════════════════════════
1. RULE STRUCTURE (when → then)
═══════════════════════════════════════════════════════

Each rule is one YAML document. Multiple rules in one file are separated by
a line containing only: ---

name: kebab-case-unique-name      # Required. Unique identifier
version: 1                        # Integer, bump when the rule changes
category: security                # See §5 for allowed values
severity: high                    # critical | high | medium | low | none
ring: 0                           # 0-3, see §4
priority: 500                     # 1-1000, LOWER number = checked FIRST
description: "One line about why this rule exists."

when:                             # "Under what conditions does this fire?"
  conditionLogic: AND             # AND = all conditions match; OR = any matches
  conditions:
    - field: "toolName"           # Field path in the tool-call context
      operator: eq                # One of the 30 operators (§2)
      value: "exec"               # Expected value (type depends on operator)

then:                             # "What happens when conditions match?"
  decision: DENY                  # One of the 7 decisions (§3)
  instruction: "Shown to the Agent: why this happened."
  alternative:                    # Optional: the RIGHT way to do it
    en: "Do this instead."
  correction: "..."               # Required only for decision: CORRECT

Field paths available in `when.conditions[].field`:
  toolName               → name of the tool being called (e.g. "exec",
                           "write_file", "read", "http_request")
  toolArgs.<arg>         → any tool argument, dot-notation
                           (toolArgs.command, toolArgs.path, toolArgs.url,
                            toolArgs.content, ...)
  context.<key>          → custom runtime context (context.amount,
                           context.maintenance_mode, context.previous_promise)
  fn:<name>              → registered custom function result (advanced)

Note: `context.tool.name` / `context.tool.args.<arg>` are accepted aliases for
`toolName` / `toolArgs.<arg>`.

═══════════════════════════════════════════════════════
2. THE 30 operators
═══════════════════════════════════════════════════════

Equality & comparison:
  eq          equal                value: "exec"            (deep compare)
  neq         not equal            value: "read"            (alias: ne)
  gt          greater than         value: 5000              (numbers only)
  gte         greater or equal     value: 100
  lt          less than            value: 10
  lte         less or equal        value: 200

Set & substring:
  in          value in array       value: ["write_file","exec"]
  not_in      value not in array   value: ["rm","del"]
  contains    substring present    value: "DROP TABLE"
  not_contains substring absent    value: "password"

Pattern:
  match       regex match          value: "^rm\\s+-rf"      (alias: matches;
                                     keep regex simple — nested quantifiers
                                     like (a+)+ are rejected, max 200 chars)
  starts_with string prefix        value: "/etc/"
  ends_with   string suffix        value: ".js"

Existence (no value needed):
  exists      field present and not null
  not_exists  field missing or null

Length (strings and arrays):
  length_gt   length >  n          value: 10485760   (>10MB content)
  length_gte  length >= n          value: 3
  length_lt   length <  n          value: 100
  length_lte  length <= n          value: 200
  length_eq   length == n          value: 3

Temporal (stateful rate limiting; optional windowMs, default 60000 = 1 min):
  within      max N calls within windowMs    value: 10, windowMs: 60000
  rate        max N calls per sliding window value: 100, windowMs: 60000

═══════════════════════════════════════════════════════
3. THE 7 DECISION TYPES
═══════════════════════════════════════════════════════

  ALLOW           Let it run, record it.
                  Use for: safe operations, batch jobs, known-good patterns.
  DENY            Block it; instruction must explain why and alternative
                  should say how to do it right.
                  Use for: dangerous operations with a clear alternative.
  CORRECT         Auto-fix the parameter and retry (engine retries ≤3 rounds).
                  `correction` field is REQUIRED.
                  Use for: wrong paths, wrong formats, fixable mistakes.
  NOTIFY          Log it and continue without interruption.
                  Use for: anomaly flags, threshold alerts, audit events.
  QUARANTINE      Run in sandbox, flag for human review.
                  Use for: suspicious but possibly legitimate operations.
  REQUEST_HUMAN   Pause until a person approves.
                  Use for: production DB access, GDPR deletes, >$5K
                  transactions, anything irreversible and high-stakes.
  EMERGENCY_HALT  Stop all monitored Agents immediately.
                  Use for: credential leaks, active attacks (SSRF, exfil).

═══════════════════════════════════════════════════════
4. EXECUTION RINGS (which rules fire first)
═══════════════════════════════════════════════════════

Rules evaluate ring 0 → ring 3. First match wins: once a rule matches,
higher rings are never reached. Within a ring, lower `priority` numbers
are checked first.

  Ring 0 — evaluated FIRST. Hard security stops: DROP TABLE, destructive
           commands, credential leaks, SSRF. Must block before anything else.
  Ring 1 — second. Input hygiene: missing required args, oversized payloads,
           chmod 777, rate limits.
  Ring 2 — third. Helpful fixes: path typo corrections (CORRECT), better
           port/format suggestions.
  Ring 3 — last. Passive/advisory: read-only allowlists (ALLOW),
           logging-only notes (NOTIFY).

═══════════════════════════════════════════════════════
5. CATEGORY VALUES
═══════════════════════════════════════════════════════

  category MUST be one of:
    security    — blocking threats, vulnerability prevention
    compliance  — regulatory/legal mandates, approvals
    workflow    — how work should flow (approvals, routing)
    integrity   — promise-keeping, honesty, consistency
    format      — argument presence, shape, and format checks
    convention  — team conventions, advisories, logging-only rules

═══════════════════════════════════════════════════════
6. EXAMPLES — natural language → ERDL YAML
═══════════════════════════════════════════════════════

Example A
  Say: "If the agent runs a shell command containing rm -rf, block it and
        tell it to inspect files first."
  YAML:
    name: block-destructive-rm
    version: 1
    category: security
    severity: critical
    ring: 0
    priority: 900
    description: "Block rm -rf style destructive commands."
    when:
      conditionLogic: AND
      conditions:
        - field: "toolName"
          operator: eq
          value: "exec"
        - field: "toolArgs.command"
          operator: contains
          value: "rm -rf"
    then:
      decision: DENY
      instruction: "Destructive command blocked."
      alternative:
        en: "Use the read tool to inspect the target first, or request human approval."

Example B
  Say: "File writes over 5MB are fine (batch jobs) but log a note suggesting
        chunking."
  YAML:
    name: large-write-advisory
    version: 1
    category: convention
    severity: low
    ring: 3
    priority: 300
    description: "Advisory for large file writes."
    when:
      conditionLogic: AND
      conditions:
        - field: "toolName"
          operator: eq
          value: "write_file"
        - field: "toolArgs.content"
          operator: length_gt
          value: 5242880
    then:
      decision: ALLOW
      instruction: "Large file write (>5MB) logged. Consider chunking for reliability."

Example C
  Say: "Any command touching the production database needs my approval.
        Suggest the staging database instead."
  YAML:
    name: production-db-needs-approval
    version: 1
    category: workflow
    severity: high
    ring: 0
    priority: 500
    description: "Production database access requires human approval."
    when:
      conditionLogic: AND
      conditions:
        - field: "toolName"
          operator: eq
          value: "exec"
        - field: "toolArgs.command"
          operator: contains
          value: "PRODUCTION_DATABASE"
    then:
      decision: REQUEST_HUMAN
      instruction: "Production database access requires approval."
      alternative:
        en: "Use STAGING_DATABASE. If you need production, your manager can approve this request."
      correction: "Change connection string to STAGING_DATABASE and retry."

═══════════════════════════════════════════════════════
7. OUTPUT FORMAT (strict)
═══════════════════════════════════════════════════════

- Output ONLY the ERDL YAML — no commentary, no markdown fences unless I ask.
- Multiple rules: separate with a line containing only ---
- Valid YAML: quote strings containing special characters (: # { } [ ] & * ! | > ' " % @ `),
  escape backslashes in regex values.
- Every rule MUST have: name, version, category, severity, ring, priority,
  when (≥1 condition), then.decision, then.instruction.
- decision CORRECT → include then.correction.
- DENY / REQUEST_HUMAN → instruction explains WHY; alternative explains the RIGHT WAY.
- Names: kebab-case, unique, descriptive.
- Choose ring and priority per §4; choose category per §5.
- Prefer `contains`/`starts_with` over regex when possible; keep regex simple.

Now generate ERDL YAML for these rules:

{{DESCRIBE YOUR RULES HERE}}
```

---

## Using the output

Save the LLM's output to a file, e.g. `rules/my-team.erdl.yaml`, then compile
and load it as described in [README → Train](../README.md#2-train--compile-and-load):

```typescript
import { readFileSync } from 'fs';
const yaml = readFileSync('rules/my-team.erdl.yaml', 'utf8');
// Compile with RuleCompilerImpl (from @openoba/rulsynor-core/engine) — it validates
// ReDoS safety, operator whitelist, and required fields before loading.
```

Test any rule instantly without code:

```bash
npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"
```

**Always review generated rules before deploying.** The LLM writes the draft;
you own the rulebook. For the full language reference see
[RULE-AUTHORING.md](./RULE-AUTHORING.md) and
[ERDL Spec v1.1](./SPEC/erdl-spec-v1.1.en.md).

---

## 中文版使用说明

把上面代码框里的提示词原样复制给任意大模型（ChatGPT、Claude、通义、Kimi……），
将末尾的 `{{DESCRIBE YOUR RULES HERE}}` 替换为你的中文描述即可，例如：

> "如果 Agent 执行的命令里包含 DROP TABLE，直接拦截，告诉它改用软删除；
> 如果一次写文件超过 10MB，放行但提醒它分块。"

模型会返回可直接保存为 `.erdl.yaml` 的规则。部署前务必人工复核。
