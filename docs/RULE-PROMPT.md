# RULE-PROMPT.md — Generate ERDL Rules from Natural Language

> **Last updated**: 2026-09-03 — prompt template migrated to the canonical ERDL document format (language spec v2.0 §2.1: `protocol`/`version`/`metadata`/`rules[]` + string `then`); decision types corrected to the 13 §6 enum; category values corrected to the 11 canonical categories.

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
I will describe rules in natural language. You translate them into a valid ERDL
document, ready to save as a .erdl.yaml file. Follow this reference exactly.

═══════════════════════════════════════════════════════
1. DOCUMENT STRUCTURE
═══════════════════════════════════════════════════════

One .erdl.yaml file = one document with a fixed top-level shape:

protocol: "erdl/v2"              # fixed protocol identifier
version: "2.0.0"                 # rule-format version
metadata:
  name: my-rule-set              # rule-set name
  description: "..."             # optional
  category: security             # default category for rules without one (§5)
  decision: ALLOW                # fallback decision when no rule matches (§6)
rules:
  - name: SEC-001-block-exec     # [CAT]-[NNN]-desc, unique, kebab-case suffix
    description: "One line about why this rule exists."
    priority: 500                # 1-1000, LOWER number = checked FIRST
    override: high               # optional: critical > high > normal > low
    ring: 0                      # 0-3, see §4
    when:                        # "Under what conditions does this fire?"
      logic: AND                 # AND = all conditions; OR = any
      conditions:
        - field: "tool.name"      # field path (§2)
          operator: eq            # one of the 30 operators (§2)
          value: "exec"           # expected value
    then: DENY                    # decision type, a STRING (§6)
    message: "Shown to the Agent: why this happened."   # blocking MUST be non-empty
    instruction: "Optional guidance."                   # ALLOW + instruction
    alternative: "The right way to do it."              # optional
    correction: "..."             # REQUIRED for decision CORRECT
    unless: null                  # optional exemption block (same shape as when)

Field paths available in `when.conditions[].field` (Entity namespace, SPEC §3):
  tool.name              → name of the tool being called (e.g. "exec",
                           "write_file", "read", "http_request")
  tool.args.<arg>        → any tool argument, dot-notation
                           (tool.args.command, tool.args.path, tool.args.url,
                            tool.args.content, ...)
  context.<key>          → custom runtime context (context.amount,
                           context.maintenance_mode, context.previous_promise)
  fn:<name>              → registered custom function result (advanced)

Legacy forms (`toolName`, `toolArgs.*`, `context.tool.*`) are NOT canonical.

═══════════════════════════════════════════════════════
2. THE 30 OPERATORS
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
3. THE 13 DECISION TYPES (then:)
═══════════════════════════════════════════════════════

  ALLOW           Let it run, record it.
                  Use for: safe operations, batch jobs, known-good patterns.
  DENY            Block it; message must explain why, alternative says the
                  right way.
                  Use for: dangerous operations with a clear alternative.
  CORRECT         Auto-correct the parameter and retry (max 3 rounds, then
                  escalate to a human). `correction` field is REQUIRED.
                  Use for: wrong paths, wrong formats, fixable mistakes.
  NOTIFY          Log it and continue without interruption.
                  Use for: anomaly flags, threshold alerts, audit events.
  REQUEST_HUMAN   Pause until a person approves.
                  Use for: production DB access, GDPR deletes, >$5K
                  transactions, anything irreversible and high-stakes.
  ESCALATE        Route to a higher authority (human or superior Agent).
  DELEGATE        Hand the task to another Agent.
  DEFER           Postpone; do not execute now.
  EMERGENCY_HALT  Stop all monitored Agents immediately.
                  Use for: credential leaks, active attacks (SSRF, exfil).
  ROLLBACK        Undo prior actions; restore the previous state.
  QUARANTINE      Run in sandbox, flag for human review.
                  Use for: suspicious but possibly legitimate operations.
  WORKFLOW        Enter a multi-step workflow (state machine).
  GUIDE           Positive guidance: steer the Agent per an SOP/best practice.

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
    coding         — code standards and patterns
    engineering    — engineering discipline and workflow
    security       — security rules and vulnerability prevention
    writing        — content and documentation standards
    design         — UI/UX and visual design constraints
    performance    — runtime efficiency and optimization
    testing        — test coverage and quality gates
    compliance     — regulatory and legal mandates
    accessibility  — a11y and inclusive design
    observability  — logging, metrics, monitoring
    custom         — user-defined / uncategorized

═══════════════════════════════════════════════════════
6. EXAMPLES — natural language → ERDL document
═══════════════════════════════════════════════════════

Example A
  Say: "If the agent runs a shell command containing rm -rf, block it and
        tell it to inspect files first."
  YAML:
    protocol: "erdl/v2"
    version: "2.0.0"
    metadata:
      name: security-guard
      category: security
      decision: ALLOW
    rules:
      - name: SEC-001-block-destructive-rm
        description: "Block rm -rf style destructive commands."
        ring: 0
        priority: 900
        when:
          logic: AND
          conditions:
            - field: "tool.name"
              operator: eq
              value: "exec"
            - field: "tool.args.command"
              operator: contains
              value: "rm -rf"
        then: DENY
        message: "Destructive command blocked."
        alternative: "Use the read tool to inspect the target first, or request human approval."

Example B
  Say: "File writes over 5MB are fine (batch jobs) but log a note suggesting
        chunking."
  YAML:
    protocol: "erdl/v2"
    version: "2.0.0"
    metadata:
      name: performance-advisories
      category: performance
      decision: ALLOW
    rules:
      - name: PERF-001-large-write-advisory
        description: "Advisory for large file writes."
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
              value: 5242880
        then: ALLOW
        instruction: "Large file write (>5MB) logged. Consider chunking for reliability."

Example C
  Say: "Any command touching the production database needs my approval.
        Suggest the staging database instead."
  YAML:
    protocol: "erdl/v2"
    version: "2.0.0"
    metadata:
      name: db-guard
      category: compliance
      decision: ALLOW
    rules:
      - name: CMP-001-prod-db-approval
        description: "Production database access requires human approval."
        ring: 0
        priority: 500
        when:
          logic: AND
          conditions:
            - field: "tool.name"
              operator: eq
              value: "exec"
            - field: "tool.args.command"
              operator: contains
              value: "PRODUCTION_DATABASE"
        then: REQUEST_HUMAN
        message: "Production database access requires approval."
        alternative: "Use STAGING_DATABASE. If you need production, your manager can approve this request."

═══════════════════════════════════════════════════════
7. OUTPUT FORMAT (strict)
═══════════════════════════════════════════════════════

- Output ONLY the ERDL YAML — no commentary, no markdown fences unless I ask.
- One document per file: protocol / version / metadata / rules[].
- Valid YAML: quote strings containing special characters (: # { } [ ] & * ! | > ' " % @ `),
  escape backslashes in regex values.
- Every document MUST have: protocol, version, metadata (name + decision), rules[].
- Every rule MUST have: name, description, priority, when (≥1 condition), then.
- decision CORRECT → include correction.
- DENY / REQUEST_HUMAN / EMERGENCY_HALT → message explains WHY; alternative
  says the RIGHT WAY.
- Names: `[CAT]-[NNN]-desc` (e.g. `SEC-001-...`), unique, descriptive.
- Choose ring and priority per §4; choose category per §5.
- Prefer `contains`/`starts_with` over regex when possible; keep regex simple.

Now generate an ERDL document for these rules:

{{DESCRIBE YOUR RULES HERE}}
```

---

## Using the output

Save the LLM's output to a file, e.g. `rules/my-team.erdl.yaml`, then compile
and load it as described in [README → Train](../README.md#2-train--compile-and-load):

```typescript
import { readFileSync } from 'fs';
const yaml = readFileSync('rules/my-team.erdl.yaml', 'utf8');
// loadRulesFromDir() / toCompiledRules() parse the canonical document format and
// validate ReDoS safety, operator whitelist, naming, and required fields before loading.
```

Test any rule instantly without code:

```bash
npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"
```

**Always review generated rules before deploying.** The LLM writes the draft;
you own the rulebook. For the full language reference see
[RULE-AUTHORING.md](./RULE-AUTHORING.md) and
[ERDL Spec v2.0](./SPEC/erdl-spec.en.md).

---

## 中文版使用说明

把上面代码框里的提示词原样复制给任意大模型（ChatGPT、Claude、通义、Kimi……），
将末尾的 `{{DESCRIBE YOUR RULES HERE}}` 替换为你的中文描述即可，例如：

> "如果 Agent 执行的命令里包含 DROP TABLE，直接拦截，告诉它改用软删除；
> 如果一次写文件超过 10MB，放行但提醒它分块。"

模型会返回可直接保存为 `.erdl.yaml` 的规范 ERDL 文档。部署前务必人工复核。
