# rulsynor-core User Guide

This guide walks you through **using** rulsynor-core — the ERDL-guarded Agent
runtime. It assumes you have installed the package; for how to *develop* it, see
[`docs/DEVELOPMENT.md`](DEVELOPMENT.md); for rule semantics, see
[`docs/RULE-AUTHORING.md`](RULE-AUTHORING.md).

---

## 1. Quick Start

### 1.1 Install

Requires **Node ≥ 22.13.0** (uses the built-in `node:sqlite`, zero native deps):

```bash
npm install -g @openoba/rulsynor-core
```

### 1.2 Try the Guard with zero setup

No API key needed — this exercises rule loading + evaluation + audit:

```bash
rulsynor demo --tool=exec --cmd="rm -rf /"   # → DENY
```

### 1.3 Set your model + key, then chat

The API key lives **only in your environment** — CORE never stores it:

```bash
export RULSYNOR_API_KEY=<your-key>   # any OpenAI-compatible provider
rulsynor setup --model gpt-4o-mini --base-url https://api.openai.com/v1
rulsynor chat
```

---

## 2. CLI Reference

```
rulsynor <command> [options]
```

| Command | Purpose | Needs API key |
|---------|---------|:---:|
| `chat [--once "msg"]` | 7-step agent loop (intent → plan → evidence → reason → guard → execute → audit) | ✅ |
| `setup [--model M --base-url U \| --show]` | Configure model name / base URL (key is read from env only) | ❌ |
| `rules list` | List all loaded rules (preset + user dir) | ❌ |
| `audit list [--limit N]` | Recent audit records (read-only) | ❌ |
| `audit show <hash-prefix>` | Show one Decision Object (read-only) | ❌ |
| `mcp` | Start the MCP stdio server | ❌ |
| `demo` | One-shot Guard demo (no API key) | ❌ |
| `help` | Show help | ❌ |

### Environment variables

| Variable | Meaning |
|----------|---------|
| `RULSYNOR_API_KEY` | LLM API key (OpenAI-compatible) — required for `chat` |
| `RULSYNOR_HOME` | CORE home dir (default `~/.rulsynor`) |
| `RULSYNOR_RULES_DIR` | User rules dir (default `./rules` or `~/.rulsynor/rules`) |

> `audit show` accepts a hash prefix **with or without** the `sha256:` scheme.

---

## 3. Authoring Rules

A rule is a single `.erdl.yaml` file using the canonical ERDL document format.

### 3.1 Write a rule file

```yaml
protocol: erdl/v2
version: 2.0.0
metadata:
  name: my-rules
  category: security
  decision: ALLOW          # fallback decision when no rule matches
rules:
  - name: SEC-050-block-api-key-write
    description: Block writing API keys / secrets into files
    priority: 900          # higher runs first
    ring: 0                # resolution ring 0-3 (0 strongest)
    when:
      logic: AND
      conditions:
        - field: tool.name
          operator: eq
          value: write_file
        - field: tool.args.content
          operator: match
          value: (api_key|secret|token)\s*[:=]\s*[A-Za-z0-9]
    then: DENY             # one of the 13 decisions
    message: Suspicious credential write blocked.
    alternative: Inject via environment or a secrets manager instead.
```

### 3.2 Drop it in the rules dir

```bash
mkdir -p ./rules          # or ~/.rulsynor/rules, or set RULSYNOR_RULES_DIR
# place your *.erdl.yaml inside — loaded at startup, quality-gated
rulsynor rules list
```

### 3.3 Key fields

| Field | Meaning |
|-------|---------|
| `name` | Rule name — **prefix must be registered** (see `RULE_NAME_PREFIXES`) |
| `priority` | Higher runs first |
| `ring` | Resolution ring 0-3 |
| `when.conditions` | `field` + `operator` (28 operators) + `value` |
| `then` | One of the 13 decisions |
| `message` / `alternative` / `correction` | Hit message / alternative / correction text |

> Custom name prefixes must be registered first (ADR-003 "register before use"),
> otherwise the rule is rejected at load with `NON_STANDARD_NAME_FULL`.

---

## 4. The 7-Step Method

`rulsynor chat` runs each turn through seven steps:

| Step | What it does |
|------|--------------|
| ① intent | Classify the intent domain |
| ② plan | Produce a step plan + risk level |
| ③ evidence | Assemble knowledge fragments |
| ④ reason | ReAct reasoning round |
| ⑤ guard | ERDL rules decide ALLOW / DENY / CORRECT / … |
| ⑥ audit | Record a tamper-evident Decision Object |
| ⑦ execute | Run the tool call |

Each guarded tool call records **one Decision Object** — see §5.

---

## 5. Audit

Every guarded decision is written to a read-only, tamper-evident trail.

```bash
rulsynor audit list                      # recent records
rulsynor audit show sha256:5cd397b1…     # one full Decision Object
```

- `audit list` shows time / decision / tool / hash.
- `audit show` prints the full Decision Object v1.5 (compliance profile,
  rule-set version, matched policies, per-field hashes).
- Viewing is read-only in CORE; export/download is a commercial-edition capability.

---

## 6. Deployment

Drop the guard in front of your agent's tool calls. Rules evaluate
**outside the model** — the prompt never holds the safety boundary.

```ts
import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules } from '@openoba/rulsynor-core';

const evaluator = new Evaluator(new GuardStateManager());
const rules = toCompiledRules(loadPresetRules());
const decision = evaluator.evaluate(rules, {
  tool: { name: 'exec', args: { command: 'rm -rf /' } },
  sessionId: 's1',
  agentId: 'my-agent',
});
```

For MCP integration, run `rulsynor mcp` to start the stdio server.

---

See also: [`docs/RULE-AUTHORING.md`](RULE-AUTHORING.md) (rule semantics),
[`docs/API.md`](API.md) (engine API), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
