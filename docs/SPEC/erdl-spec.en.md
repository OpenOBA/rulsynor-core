# ERDL Specification v2.0
（Entity-Rule Definition Language · 实体规则定义语言）

> **Authority note (2026-08-31 · full-line alignment)**: This file is a **copy**; the authoritative source is the erdl repo `erdl-spec.en.md`. Normative facts follow the authority.

> **Status**: v2.0 · Public release
> **Version semantics**: this document (the ERDL language specification) is version **v2.0**; the top-level `protocol: "erdl/v2"` (protocol identifier, fixed value) and `version: "2.0.0"` (rule-format version) are independent version identifiers, not to be conflated with the document version.
> **Author**: Tang Qixin（唐启鑫）
> **Positioning**: ERDL (Entity-Rule Definition Language) is a **declarative rule definition format**, carried in YAML/JSON, for precisely expressing entity structures and behavior rules. This specification is **independent and neutral** — it defines only the format itself, depending on no particular implementation or upper-layer framework; its deterministic evaluation and canonical form support byte-for-byte cross-implementation verification. In ERDL, **rules decide everything**: rules are the carrier of semantics, the boundary of execution, the evidence of audit, and the fact of governance.
> **Conformance language**: **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** in this document are interpreted per [RFC 2119].

---

## 1. Introduction

### 1.1 What ERDL Is

ERDL (Entity-Rule Definition Language) is a **declarative rule definition format** carried in YAML/JSON, for precisely expressing entity structures and behavior rules. It contains two kinds of **declarations**: **Entity** defines data structure; **Rule** defines a `when → then` decision. Entity defines the structure of an object; Rule prescribes the consequence of a condition; together they form an executable, reviewable, and verifiable rule expression.

### 1.2 Design Philosophy

**ERDL is a "multi-party semantic layer"** — it is not just a rule format, but a **semantic convention layer shared by human, LLM, system, and audit**:

| Party | ERDL's role |
|--------|------------|
| Human (business/domain expert) | the precise translation of natural-language rules, readable and reviewable |
| LLM (general model) | structured input that removes ambiguity and supports deterministic evaluation |
| System (rule engine) | standardized rule description; `fn` delegation controls the call boundary |
| Audit (regulation/compliance) | a traceable rule record clearer than code + natural language |

In this semantic layer, rules decide everything: humans express intent, the LLM translates semantics, the system executes decisions, and audit reviews the evidence. ERDL's deterministic semantic layer gives an LLM clear direction: a user describes a rule in natural language; after ERDL precisely translates it, the LLM deterministically executes it per structured semantics — the conversational interface is the unified entry point.

### 1.3 Value at the AI Governance Level

The core challenge of AI governance is not whether a model can answer, but how probabilistic outputs satisfy the deterministic boundary required by regulation, auditing, and accountability. ERDL encodes declarative rules in YAML/JSON, codifying entity structures, behavioral constraints, and disposition actions into a verifiable deterministic rule layer, and turns "how an AI should act" from a training assumption into an inspectable object.

**From trust to verification**: Traditional governance relies on alignment assessments or post hoc explanations, making it difficult to prove which constraints a specific decision followed. ERDL expresses constraints as `when → then` rules. Each evaluation is bound to a canonical_tree snapshot and an outcome hash, enabling independent recomputation and byte-for-byte verification across implementations. Governance stakeholders no longer merely trust that a model has been "properly trained"; they can verify whether an action matched a rule, which rule it matched, and why that result was produced.

**Accountable evidence chain**: ERDL evaluation results are hashable and recomputable. Rule versions, input snapshots, decision outputs, and hashes can be anchored together to form audit records. Auditing is not a restatement of logs, but a reproducible proof process — why an action was allowed, why it was blocked, and who approved it can all be traced and verified, preventing post hoc explanations from becoming the sole basis.

**Mechanized human–machine accountability boundary**: ERDL can use decision types such as REQUEST_HUMAN and ESCALATE to require human adjudication for high-risk operations, sensitive entity changes, irreversible actions, and similar cases. Final human decision-making authority no longer depends on procedural slogans; it is encoded as executable, testable, and auditable rule paths.

**Compliance as code and cross-organizational mutual recognition**: Regulations, platform policies, and internal red lines can be translated into ERDL rules and continuously validated through test vectors. Different organizations, implementations, or third-party auditors can independently recompute outcomes from the same rules and canonical_tree, establishing a "trust but verify" governance paradigm and turning compliance from declarative documentation into governance facts that are executable, inspectable, and mutually recognizable.

### 1.4 Design Goals

1. **Determinism**: for the same rule and input, any conforming implementation MUST produce byte-for-byte identical evaluation results and hashes;
2. **Readability**: any rule can be read back as natural language (gloss) that a human can instantly understand and review;
3. **Auditability**: the rule's evaluation process is independently recomputable and traceable;
4. **Cross-implementation verifiability**: semantics converge to a single kernel, and conformance is proven by byte-for-byte comparison against test vectors.

### 1.5 Core Commitment

> **The semantic carrier is the kernel, not the syntax.**
> **Semantics = tree = hash.** The three coincide in canonical form.

Any scheme that takes "operator syntax" as its semantic carrier is forced to expand operators linearly as new requirements appear, so its cost never converges. This specification therefore converges semantics onto a single kernel (the expression tree), and treats the multiple writing forms as deterministic projections of that kernel — they are not independent languages, but different views of the same semantics. **Rules decide everything**: a rule's validity depends not on its writing entry point or implementation form, but on canonicalized semantics that are unique, recomputable, hashable, and byte-for-byte verifiable.

---

## 2. Document Structure

### 2.1 Top-Level Format

An ERDL document (`*.erdl.yaml`) consists of four top-level fields, whose order MUST be fixed:

```yaml
protocol: "erdl/v2"       # protocol identifier, fixed value
version: "2.0.0"          # rule-format version
metadata: { ... }         # document-level metadata (see §2.2)
rules: [ ... ]            # rule list (see §4)
```

| Top-level field | Type | Required | Description |
|---------|------|:---:|------|
| `protocol` | string | MUST | Protocol identifier, fixed value `"erdl/v2"` |
| `version` | string | MUST | Rule-format version (semantic versioning) |
| `metadata` | object | MUST | Document-level metadata |
| `rules` | array | MUST | Rule list; elements defined in §4 |

### 2.2 metadata

```yaml
metadata:
  name: "my-first-rule-set"
  description: "Allow file read operations"
  category: coding
  decision: ALLOW            # fallback decision when no rule matches
  tags: [example]
```

| Field | Type | Description |
|------|------|------|
| `name` | string | Rule set name |
| `description` | string | Rule set description |
| `category` | string | Rule set category (coding/security/compliance…) |
| `decision` | string | Fallback decision (default verdict when no rule matches; see §6) |
| `tags` | array | Tags |

### 2.3 Format Conventions

- String values MUST use double quotes; enum keywords / numbers / booleans are written bare;
- Indentation MUST be 2 spaces;
- The file MUST begin with `protocol: "erdl/v2"`;
- Version compatibility: within the same `protocol` major version, new constraints SHOULD be non-breaking for existing rules (a Warning at load, not an Error); a cross-major-version change (e.g. erdl/v1 → erdl/v2) is a breaking change and is not covered by the backward-compatibility promise. Exception: `when:"true"` combined with a blocking `then` is rejected at load in any version (Error).

---

## 3. Entity Definition

An Entity is the subject a rule acts upon (passed via context). ERDL predefines the following Entity types:

| Entity type | Description |
|------|------|
| `agent` | A single Agent instance |
| `tool` | A tool invoked by the Agent |
| `task` | A task executed by the Agent |
| `workflow` | A multi-Agent orchestration process |
| `human` | A human approver |
| `guardian` | Supervisor |

Field references in rules (e.g. `tool.name`, `context.amount`) use Entities as their semantic namespace. Field paths are load-bearing: a field name is frozen once published (`[FREEZE-1]`), and aliases MUST be normalized to the canonical name first.

---

## 4. Rule Definition

Rule is the core unit of ERDL: `Rule = Metadata + When (condition) + Then (action) + Audit (audit)`. When compiles to an expression tree (§5), Then is a decision type (§6), and Audit records the audit information of the rule's evaluation.

### 4.1 Field Definitions

The `rules[]` sub-field order MUST be fixed: `name` → `description` → `priority` → `override` → `ring` → `when` → `then` → `message` → `instruction` → `unless`.

| Field | Type | Required | Description |
|------|------|:---:|------|
| `name` | string | MUST | Unique rule identifier, format `[CAT]-[NNN]-description` |
| `description` | string | MUST | Human-readable description |
| `priority` | integer | MUST | Smaller number = higher precedence (see §7.1) |
| `override` | string | SHOULD | Override level: critical > high > normal > low (default normal) |
| `ring` | integer | SHOULD | Execution ring: 0 kernel / 1 recovery / 2 approval / 3 advisory |
| `when` | object | MUST | Trigger condition (see §5) |
| `then` | string | MUST | Decision type (see §6) |
| `message` | string | SHOULD | Decision message (blocking `then` MUST be non-empty) |
| `instruction` | string | MAY | Advisory instruction (for the ALLOW + instruction case) |
| `unless` | object/null | MAY | Exemption condition block (optional) |

### 4.2 Complete Example

```yaml
protocol: "erdl/v2"
version: "2.0.0"
metadata:
  name: "my-first-rule-set"
  description: "Allow file read operations"
  category: coding
  decision: ALLOW
  tags: [example]
rules:
  - name: "COD-001-allow-read"
    description: "Allow all read_file tool calls"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "read_file"
    then: ALLOW
    message: "read_file call allowed"
    unless: null
```

---

## 5. The `when` Condition Expression

`when` is the rule's embedded condition expression. ERDL provides three **writing forms** (Simple / Expression / Decision Table), any of which compiles and normalizes to the same semantic kernel (the expression tree) and can be rendered back into any form; there is additionally a **readable projection** gloss (§5.5) deterministically generated from the tree as natural language.

### 5.1 Writing Forms (Projections)

| Projection | Carries | Applicable tier | Description |
|--------|------|:---:|------|
| **A · Simple** | 30 operators | 0–2 (MUST) | Safety baseline, the most common writing form |
| **B · Expression** | full 34-node tree | ≥3 | Business panorama: logic/quantifiers/arithmetic/time/aggregation |
| **C · Decision Table** | matrix | — | Preferred by business/finance staff; compiles to the same kernel |

The three forms share the same semantics, differing only in expressiveness and tier authorization. **tier is a rule hierarchy level (0–5)**, ordered low-to-high by the rule's constraint strength and scope — in this document, tier 0–2 is the safety baseline (MUST use Simple), and tier ≥3 is the business panorama (Expression may be used). `when` and `expr` MUST NOT coexist (E5).

### 5.2 Projection A: Simple (30 Operators)

Simple is the preserved, existing set of semantic units — **30 operators = 28 conditions + 2 modifiers**, unchanged. It corresponds to system safety rules (tier 0–2).

**Set definition**:

| Family | Count | Operators |
|----|------|--------|
| Comparison | 6 | eq · ne · gt · gte · lt · lte |
| List | 2 | in · not_in |
| String | 5 | contains · not_contains · match · starts_with · ends_with |
| Boundary negation | 2 | not_starts_with · not_ends_with |
| Existence | 2 | exists · not_exists |
| Length | 5 | length_gt · length_gte · length_lt · length_lte · length_eq |
| Range | 2 | between · not_between |
| Count | 4 | count_gt · count_gte · count_lt · count_lte |
| Modifier | 2 | within (time window) · rate (rate limit) |

**Semantic conventions** (apply to all operators):

- **Strict type matching**: no implicit type conversion; `"100" gt 50` is always false;
- **Same-type ordered comparison**: numbers use numeric order, strings use lexicographic order (Unicode code point order; `"2" gt "10"` is true); cross-type returns false;
- **match is case-sensitive**: regex matching is case-sensitive by default, with no inline case-insensitive option;
- **between is numeric-only**: the closed interval `[min,max]` supports only numbers; non-numeric returns false;
- **Null propagation**: when a field is missing, everything except exists/not_exists returns false (safe failure);
- **Existence is the sole discriminator**: only exists/not_exists distinguish "missing" from "value mismatch";
- **List limit**: in/not_in operands ≤256 items;
- **Determinism guarantee**: executed by a closed evaluation kernel, with no code injection path;
- **Lenient aliases**: an implementation MAY accept two historical aliases and normalize them — `matches` → `match`, `neq` → `ne`. Aliases are not new operators (still the 30-operator set); the canonical form MUST use the canonical name, and aliases never enter the tree or the hash. Not implementing aliases is still conformant.

**Authoritative compile mapping**: all 30 operators have a definite compile target, with none dangling — **13 direct nodes** (eq/ne/gt/gte/lt/lte·in·contains/starts_with/ends_with/match·exists·between), **6 not-derived** (not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between), **9 length/count compositions** (length_* 5 + count_* 4), **2 time modifiers** (within/rate).

| # | Simple operator | Compile target | Expression tree form |
|:---:|------|:---:|------|
| 1-6 | `eq` `ne` `gt` `gte` `lt` `lte` | direct node | comparison node |
| 7 | `in` | direct node | set node in |
| 8 | `not_in` | not + exists guard | `exists(field) AND not(in(...))` |
| 9-12 | `contains` `starts_with` `ends_with` `match` | direct node | string node |
| 13 | `not_contains` | not + exists guard | `exists(field) AND not(contains(...))` |
| 14-15 | `not_starts_with` `not_ends_with` | not + exists guard | `exists(field) AND not(...)` |
| 16 | `exists` | direct node | existence node (value non-`null` and non-`undefined`; empty string `""`, `0`, `false` all count as "existing" — "existing" ≠ "non-empty string") |
| 17 | `not_exists` | not composition | `not(exists(...))` |
| 18-22 | `length_gt/gte/lt/lte/eq` | composition + exists guard | `exists(field) AND length(field) compare n` |
| 23 | `between` | direct node | range node (numeric only) |
| 24 | `not_between` | not + exists guard | `exists(field) AND not(between(...))` |
| 25-28 | `count_gt/gte/lt/lte` | composition + exists guard | `exists(field) AND aggregate(count(...)) compare n` |
| 29 | `within` | time modifier | time window (as_of injected by engine) |
| 30 | `rate` | time modifier + aggregate | rate limit (temporal_state) |

**exists guard (compile-layer guarantee of E11 null propagation)**: the `not_*` operators (except `not_exists`) and the `length_*`/`count_*` compositions MUST compile to `exists(field) AND <derived expression>`, not a bare `not(positive operator)` or a bare `length/count(...) comparison`. Reason: a positive operator returns false for a missing field and `length(missing)` returns 0; a direct `not` flip or numeric comparison would break null propagation (fail-open). `not_exists` is the sole exception — its semantics are "perceive field missing", so it stays a bare `not(exists(...))`.

**Stateful operators (within/rate)**: `within` and `rate` are the only two stateful operators, whose evaluation depends on sliding-window counts across decisions. This state is not stored in the expression tree node but is maintained by a separate Guard state manager, entering the audit record as the `temporal_state` field — the expression tree itself remains a pure function (E1 holds), while the state source is auditable and recomputable.

**Stateful operator truth semantics (MUST)**: count reaches threshold → condition holds (trigger); below threshold → record this event and return false (allow).

| Operator | Threshold | First/under-limit | After threshold |
|---|---|---|---|
| `rate: "N/window"` | N | first N times: record + false | from the (N+1)-th time: true |
| `within: "window"` | 1 | first: record + false | from the 2nd time in window: true (dedup) |

Supporting constraints (all MUST): ① post-counting (count only when the positive condition holds); ② count isolation key (`within` keys on `field+operator+value`, `rate` keys on `field+operator+value+rate`); ③ record timing in the "under-limit" branch.

### 5.3 Projection B: Expression (34-Node Tree)

Expression opens the kernel's full expressive power for complex business rules (tier ≥3). The semantic kernel is a **typed expression tree** of **34 nodes** (in **10 groups**), frozen at `[FREEZE-2]`:

| Group | Nodes | Semantic capability |
|----|------|---------|
| Value | field · var · literal | reference fields, context variables, constants (`var` only `$`/`$.path`; MUST NOT read clock or randomness) |
| Logic | and · or · not | composition |
| Comparison | eq · ne · gt · gte · lt · lte | operands may be field, variable, literal, or arithmetic subtree |
| Set | in | scalar ∈ set |
| String | contains · match · starts_with · ends_with | pattern matching; match uses safe regex |
| Existence/measure | exists · length · between | existence, length (Unicode code points), closed interval |
| Quantifier | all · any · none | per-element array judgment; empty array always false |
| Arithmetic | add · sub · mul · div · round | fixed-point deterministic arithmetic |
| Time | days_between · epoch_ms · date_add · date_part · month_last_day | date difference, timestamp, date arithmetic, component extraction, last day of month |
| Aggregate | aggregate (count/sum/avg/min/max) | array aggregation |

> Node total: Value 3 + Logic 3 + Comparison 6 + Set 1 + String 4 + Existence/measure 3 + Quantifier 3 + Arithmetic 5 + Time 5 + Aggregate 1 = **34**. The 6 comparison operators, 4 string operators, 5 arithmetic operators, 3 quantifier kinds, and 5 aggregate functions are carried by parameterized node types in implementations (e.g. `compare{op}`, `string{op}`, `arith{op}`, `quantifier{kind}`, `aggregate{fn}`), so the "34 semantic nodes" map to fewer type literals in code — this is the relationship between semantic nodes and type projections, not a count contradiction.

**Expression writing example**:

```yaml
when:
  expr:
    lt:
      - div:
          - sub: [{ field: "tool.args.price" }, { field: "context.cost" }]
          - field: "tool.args.price"
      - 0.15
```

### 5.4 Projection C: Decision Table (Matrix Form)

The decision table faces business and finance staff, expressing multi-condition combinations in row-column structure, compiled to the same kernel:

```yaml
kind: decision_table
columns:
  - field: "context.amount"
    label: "application amount"
rows:
  - when: [["gte", 10000]]
    then: "REQUEST_HUMAN"
    priority: 100
  - when: [["gte", 5000]]
    then: "ESCALATE"
    priority: 90
  - when: []                       # default row (unconditional, fallback)
    then: "ALLOW"
    priority: 1
```

Compile rules (E7): ① each row's `when` condition group compiles to logical AND in field-column order, and each condition unit compiles to a comparison node; ② row order is precedence (first match from top, consistent with `priority`; the two MUST NOT conflict); ③ the default row `when: []` compiles to literal `true`; ④ `then` MUST belong to the §6 decision type enumeration; ⑤ the compiled tree is identical to a hand-written Simple/Expression tree.

### 5.5 Projection D: gloss (Natural-Language Readable Projection)

gloss is natural-language text **deterministically generated** from the tree:

```yaml
gloss: "when (sale price − cost) ÷ sale price is less than 15%, human approval is required"   # engine-generated, lint-enforced
```

**Five invariants (all MUST)**:

| # | Invariant |
|---|--------|
| G1 | gloss = render(tree): deterministically generated by a frozen rendering template |
| G2 | every rule MUST carry gloss; lint checks `gloss == render(tree)`; hand-writing forbidden |
| G3 | gloss forbids raw field paths and MUST use the Entity's display_name (bilingual) |
| G4 | gloss is a render product (does not enter the hash); displayed via live `render(tree)` |
| G5 | Simple rules also generate gloss (rendered after compiling to a tree) — the reading layer is uniform |

**gloss rendering templates** (per node, V-GLOSS vector expected-value baseline; `{A}`/`{B}`/`{C}` are recursive render results of sub-expressions):

| Node | English template |
|------|------------------|
| `field` | `{field}` |
| `var` | `{variable}` |
| `literal` | `{value}` |
| `and` | `{A} and {B}` |
| `or` | `{A} or {B}` |
| `not` | `not ({A})` |
| `eq` | `{A} equals {B}` |
| `ne` | `{A} does not equal {B}` |
| `gt` | `{A} is greater than {B}` |
| `gte` | `{A} is greater than or equal to {B}` |
| `lt` | `{A} is less than {B}` |
| `lte` | `{A} is less than or equal to {B}` |
| `in` | `{A} is in {B}` |
| `contains` | `{A} contains {B}` |
| `match` | `{A} matches regex {B}` |
| `starts_with` | `{A} starts with {B}` |
| `ends_with` | `{A} ends with {B}` |
| `exists` | `{A} exists` |
| `length` | `the length of {A}` |
| `between` | `{A} is between {B} and {C}` |
| `all` | `every item in {A} satisfies: {B}` |
| `any` | `some item in {A} satisfies: {B}` |
| `none` | `no item in {A} satisfies: {B}` |
| `add` | `{A} plus {B}` |
| `sub` | `{A} minus {B}` |
| `mul` | `{A} times {B}` |
| `div` | `{A} divided by {B}` |
| `round` | `{A} rounded` |
| `days_between` | `days between {A} and {B}` |
| `epoch_ms` | `the epoch milliseconds of {A}` |
| `date_add` | `{A} plus {B} duration` |
| `date_part` | `the {part} of {A}` |
| `month_last_day` | `the last day of the month of {A}` |
| `aggregate(count)` | `the count of {A}` |
| `aggregate(sum)` | `the sum of {A}` |
| `aggregate(avg)` | `the average of {A}` |
| `aggregate(min)` | `the minimum of {A}` |
| `aggregate(max)` | `the maximum of {A}` |

---

## 6. `then` Decision Types

The value of `then` MUST belong to the following 13 decision types:

| # | Decision type | Semantics |
|---|---------|------|
| 1 | ALLOW | allow |
| 2 | DENY | block |
| 3 | CORRECT | correct deviation |
| 4 | NOTIFY | notify |
| 5 | REQUEST_HUMAN | request human adjudication |
| 6 | ESCALATE | escalate |
| 7 | DELEGATE | delegate |
| 8 | DEFER | defer |
| 9 | EMERGENCY_HALT | emergency stop |
| 10 | ROLLBACK | roll back |
| 11 | QUARANTINE | quarantine |
| 12 | WORKFLOW | workflow (state machine; substates WORKFLOW_WAITING / WORKFLOW_PROGRESS) |
| 13 | GUIDE | guide |

---

## 7. Evaluation Semantics

### 7.1 Precedence and Conflict Resolution

1. Sort by `priority` ascending (smaller value = higher precedence);
2. Among equal priority, those with an `override` marker go first;
3. `override` enumeration: `critical` > `high` > `normal` > `low` (default `normal`);
4. Equal priority and equal override: definition order;
5. `override` is allowed only in the DENY → ALLOW direction (it MUST NOT override to a less-safe state).

### 7.2 Evaluation Constraints (E1–E12, all MUST)

| # | Constraint |
|------|------|
| E1 | Evaluation is a pure function: no side effects, no implicit external state, no clock reads; the state injection of `within`/`rate` (`temporal_state`) and `as_of` are controlled external inputs |
| E2 | Fixed-point decimal scale=14 + half-even + string serialization; intermediate computation uses high-precision bounded rationals, rounding only at output nodes |
| E3 | Evaluation errors are recorded as eval_warnings; folding direction follows E12 by tier |
| E4 | Resource limits (graded): Grade A arithmetic depth≤2 / tree depth≤6 / nodes≤64 / array≤10000 / per-rule≤50ms / no nested quantifiers / regex steps≤10000; Grade B tree depth≤10 / nodes≤256 / arithmetic depth≤4, quantifier nesting≤2; Grade C not applicable |
| E5 | Type checking at load; `when` and `expr` MUST NOT coexist |
| E6 | Tree as evidence: canonical_tree (a tree snapshot) serves as evaluation evidence and enters the hash; eval_trace is a recomputable derived product, not entering the hash |
| E7 | Simple and Expression compile to the same evaluation core; a second evaluator is forbidden |
| E8 | Quantifier safe folding: empty array → all/any/none all false (anti-vacuous-truth) |
| E9 | No wall-clock reads; as_of is injected by the engine and recorded in the audit record |
| E10 | String NFC normalization |
| E11 | undefined sentinel semantics (null propagation, see §7.3) |
| E12 | Evaluation error handling: tier≤2 and Guard contexts default to fail-close, tier 3–5 folds to false |

The kernel explicitly excludes: string concatenation, regex replacement, bitwise operations, date formatting, recursive references, and user-defined nodes — to keep evaluation closed and verifiable.

### 7.3 Deterministic Semantics (Cross-Implementation Divergence Protection)

The following semantics MUST be explicitly annotated in the document and vectors, to avoid semantic misunderstanding against standard implementations:

**(a) Null propagation (E11)**: Agent context is highly dynamic; missing fields are the norm. Evaluation MUST use safe failure under three-valued logic:

| Scenario | Behavior |
|------|------|
| Equality/numeric comparison on a missing field | returns false (not NPE) |
| `== null` / `!= null` check | returns true / false normally |
| Type-mismatched comparison | returns false (no implicit conversion) |
| Arithmetic on a missing field | returns false (condition) or EvaluationError (arithmetic expression) |

**(b) Quantifier empty-array safe folding (E8)**: under standard quantifier semantics `all(empty)=true` (vacuous truth). This specification deliberately deviates: `all/any/none(empty)` all fold to false — preventing "nothing to check yet judged as allowed" — and record the safe fold in the audit record. Third-party implementations MUST adopt this folding semantics.

**(c) Fixed-point intermediate precision (E2)**: intermediate computation uses high-precision bounded rationals (e.g. 128-bit integer numerator/denominator); only output nodes round to scale=14 + half-even string serialization (IEEE 754-2019 ROUND_HALF_EVEN).

**(d) Regex ReDoS protection**: the `match` node MUST satisfy: ① single-match step limit ≤10000; ② input length limit; ③ prefer a deterministic engine (RE2-class) or a safe syntax subset.

**(e) aggregate empty-array safe folding**:

| Function | Empty-array result | Basis |
|------|-----------|------|
| `count(empty)` | `0` | standard counting semantics |
| `sum(empty)` | `0` | empty-sum identity |
| `avg(empty)` | `false` | safe-failure fold (avoid division by zero) |
| `min(empty)` | `false` | safe-failure fold (standard +Infinity, disabled) |
| `max(empty)` | `false` | safe-failure fold (standard −Infinity, disabled) |

The `over` of `aggregate` MUST be an array; a non-array (missing/scalar/object) returns `null` + `type_mismatch` warning (folded to false). `count(missing)` and `count(empty array)` differ: the former is type_mismatch, the latter is 0.

**(f) Time-node UTC semantics (E9)**: all time nodes evaluate uniformly in UTC, guaranteeing byte-for-byte consistency across implementations and time zones:

- Input parsing: date-only (`YYYY-MM-DD`) parses as UTC; date-time parses per ISO 8601 with timezone, and without a timezone suffix as UTC;
- Component extraction (`date_part`): always takes UTC components;
- Date arithmetic (`date_add`, `month_last_day`): UTC calendar arithmetic;
- Time difference (`days_between`): UTC millisecond difference ÷ 86400000, floor;
- Serialization: ISO 8601 UTC (`toISOString`).

Business local time zone is converted by the engine to a UTC instant when injecting `as_of`; the evaluator computes as a UTC pure function.

### 7.4 `when` Minimum-Completeness Constraints

`when: "true"` means "applies to all operations" and is allowed only for advisory rules:

| Rule | Level |
|------|------|
| `when: "true"` MUST NOT pair with `then: DENY` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: EMERGENCY_HALT` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: CORRECT` | MUST NOT |
| `when: "true"` MUST NOT pair with `then: REQUEST_HUMAN` | MUST NOT |
| `when: "true"` MAY pair with `then: ALLOW + instruction` | MAY |
| `when: "true"` MAY pair with `then: NOTIFY` | MAY |
| Safety rules (category=security) MUST contain at least 1 condition | MUST |
| Tool-interception rules SHOULD contain a `tool.name` condition | SHOULD |
| File-operation rules SHOULD contain `tool.args.path` | SHOULD |
| Command-operation rules SHOULD contain `tool.args.command` | SHOULD |

---

## 8. Serialization and Canonicalization

### 8.1 Serialization

An ERDL document is carried in YAML and can be losslessly converted to JSON. The canonical tree (`canonical_tree`) is serialized as a JSON object.

### 8.2 Canonical Tree (Canonical Form)

The expression tree is the single benchmark object for evaluation, hashing, and recomputation. For its hash to be byte-for-byte identical across implementations, the tree MUST have a unique canonical form:

| Canonicalization rule | Description |
|-----------|------|
| Fixed node order | child nodes are arranged in canonical order (strict left→right), independent of source writing order |
| Field names load-bearing | field reference paths are load-bearing — frozen once published (`[FREEZE-1]`); aliases MUST be normalized first |
| Literal canonicalization | numbers are represented as fixed-point decimal strings (scale=14 + half-even); strings NFC-normalized |
| var canonicalization | only `$` / `$.path`, with path segments as definite byte sequences |
| Metadata stripping | comments, source line numbers, formatting, authors, and other non-semantic metadata never enter the canonical tree |

> **The object of tree hashing is the canonical tree, not any particular implementation's memory representation or serialized text.** Two structurally equivalent trees (differing only in field writing order, whitespace, or variable naming) produce exactly the same byte sequence and hash after canonicalization.

### 8.3 Relationship between the Canonical Tree and gloss

- gloss is generated from the tree by the frozen rendering template (G1);
- **what enters the hash is the tree (canonical form), not the gloss text** — the tree is byte-deterministic, satisfying the hash requirement;
- the gloss text does not enter the hash, so wording may differ across implementations without breaking cross-implementation consistency;
- gloss and tree are bound by render verification (G2) — changing gloss without changing the tree is judged invalid.

This "hash the tree, verify gloss equals the tree" mechanism lets gloss obtain cryptographic anchoring of the tree without needing byte-for-byte identity or entering the hash.

---

## 9. How to Integrate ERDL

The integration goal of ERDL is to extract critical decisions from model inference, framework code, or informal conventions, and turn them into loadable, executable, and verifiable rule assets. ERDL is typically delivered as YAML/JSON rule documents, makes decisions through `when → then`, and outputs hashable evaluation evidence that can be recomputed byte for byte. The following three integration paths correspond to three typical engineering integration points.

### 9.1 Scenario 1: AI Agent (Behavioral Constraint Layer / Action Guard)

**Role:** In an AI Agent pipeline, ERDL is the deterministic gate between LLM intent and system execution — the Agent may generate actions, but whether an action is permitted must be determined by rule evaluation.

**Simulation:** A customer-service Agent receives a user request for a refund of 8,000 yuan. The LLM converts the intent into the tool call `issue_refund(amount=8000, order_id=O1024)`. Before the call actually reaches the payment system, Action Guard packages the tool name, arguments, and session context into a fact object and submits it to ERDL for evaluation. In the rule set, R1 is written as `when tool.name == "issue_refund" and tool.args.amount > 5000 → REQUEST_HUMAN`, while R2 is written as `when tool.name == "issue_refund" → ALLOW`. Because R1 matches first, the system returns REQUEST_HUMAN. The Agent stops calling the payment tool, generates a human approval task instead, and returns a "manual review required" message to the user.

**Integration points:** First, rules are evaluated independently of the model, so prompts no longer carry the safety boundary. Second, match records, input digests, canonical_tree, and result hashes are written together to audit logs, making every interception replayable. Third, rule changes require only updating the ERDL document, without rewriting the Agent framework, tool implementations, or model prompts.

### 9.2 Scenario 2: MCP (Protocol Distribution / Cross-Implementation Interoperability)

**Role:** In the MCP ecosystem, ERDL rules are exposed as standard tools through an ERDL MCP Server. Any MCP-compatible Agent can invoke the same rule set, enabling compliance distribution and mutual recognition across implementations.

**Simulation:** An enterprise deploys its fund-compliance rules as an ERDL MCP Server and exposes the `guard_check` tool. A third-party Agent prepares to execute a high-value refund but does not possess the enterprise rules. Before execution, it calls `guard_check` through MCP, passing an action description (`action=issue_refund`, `amount=8000`, `channel=payment`). The ERDL MCP Server loads the rule set, performs evaluation, and returns `decision=REQUEST_HUMAN`, `matched_rule=R1`, `hash=0x9f...`. Based on the returned value, the third-party Agent stops direct execution, enters a human approval workflow, and records the decision evidence in its own execution log.

**Integration points:** The key here is "Rules-as-a-Service." Rules are no longer hard-coded in a specific Agent framework; they are distributed through a standard protocol. Clients from different vendors, programming languages, and runtime environments can consume the same decision logic. Because the response includes rule-match and hash information, callers can archive decision evidence for later auditing or independent recomputation even without storing the original rule text. When rules are upgraded, only the MCP Server side needs to be updated; clients do not need to refactor their execution chains.

### 9.3 Scenario 3: Rule Engine (Rule Definition Language / Deterministic Evaluation)

**Role:** Inside a rule engine, ERDL is the rule definition language itself, responsible for expressing business policies declaratively and providing deterministic evaluation semantics.

**Simulation:** An anti-money-laundering engine needs to express "large transaction involving a high-risk country → block." The business team writes the ERDL rule `when context.amount > 10000 and context.country in [high-risk country list] → DENY`. After loading the YAML, the engine does not treat it as ordinary configuration; it compiles it into an expression tree: comparison nodes handle amount thresholds, set nodes determine country membership, and logical nodes perform the AND operation. The engine then executes according to the E1–E12 evaluation semantics and outputs DENY. The rule can also generate canonical_tree and a hash value; another implementation can recompute the same result simply by loading the same rule and the same input.

**Integration points:** The core value here is "verifiable determinism." ERDL not only makes rules readable, but also allows engine implementations to be constrained by test vectors. V-ENGINE-class test vectors can prove that different engines, platforms, and versions produce byte-for-byte identical results for the same rule. As a result, a rule engine is no longer merely an internal black box inside a business system; it becomes an executor that can be independently verified by third parties. Regulators, auditors, or platform operators can determine whether the engine computed correctly based on inputs, rule hashes, and evaluation evidence.

---

## 10. Examples and Conformance Verification

### 10.1 Complete Examples

See §4.2 (Simple rule), §5.3 (Expression rule), and §5.4 (Decision Table).

### 10.2 Conformance Verification

The semantics of this specification MUST be proven by independently recomputable test vectors. The expression-layer vectors (V-ENGINE 201 + V-GLOSS/V-PROJ 22) are published with this specification, covering: 34 nodes × 4 scenarios (normal/boundary/exception/empty), E1–E12 semantics, the Simple 30-operator compile mapping, and gloss rendering templates.

**Five-step verification**: load vector input → generate expression tree → recompute evaluation result → compare with the answer → judge consistency.

**Third-party Runner verification flow (from zero to conformance)**:

1. Read this specification;
2. Implement an independent verifier in your own chosen tech stack (without importing any existing implementation code);
3. Load the test vectors and compare byte-for-byte;
4. Confirm your implementation satisfies the Runner contract;
5. Submit results to the implementation registry for third-party audit re-verification.

---

## Appendix A · 34-Node Reference Table

| Group | Nodes | Count |
|----|------|:---:|
| Value | field · var · literal | 3 |
| Logic | and · or · not | 3 |
| Comparison | eq · ne · gt · gte · lt · lte | 6 |
| Set | in | 1 |
| String | contains · match · starts_with · ends_with | 4 |
| Existence/measure | exists · length · between | 3 |
| Quantifier | all · any · none | 3 |
| Arithmetic | add · sub · mul · div · round | 5 |
| Time | days_between · epoch_ms · date_add · date_part · month_last_day | 5 |
| Aggregate | aggregate (count/sum/avg/min/max) | 1 |

Total **34 nodes**.

## Appendix B · Simple 30-Operator Reference Table

| Family | Operators | Count |
|----|------|:---:|
| Comparison | eq · ne · gt · gte · lt · lte | 6 |
| List | in · not_in | 2 |
| String | contains · not_contains · match · starts_with · ends_with | 5 |
| Boundary negation | not_starts_with · not_ends_with | 2 |
| Existence | exists · not_exists | 2 |
| Length | length_gt · length_gte · length_lt · length_lte · length_eq | 5 |
| Range | between · not_between | 2 |
| Count | count_gt · count_gte · count_lt · count_lte | 4 |
| Modifier | within · rate | 2 |

Total **30 operators** (28 condition operators + 2 condition modifiers).

## Appendix C · Decision Type Enumeration (13 types)

See §6.

## Appendix D · Function Delegation and Rule Grading

For scenarios explicitly excluded by the kernel but genuinely needed, function delegation (FnRegistry) is provided as a controlled fallback:

| Constraint | Description |
|------|------|
| Registration | a function MUST be registered before it can be referenced; unregistered calls are rejected |
| Sandboxed execution | restricted environment under resource quota and timeout |
| Determinism exemption declaration | functions on the Guard evaluation path MUST declare and guarantee determinism |
| Auditability | every call is recorded in the audit record for offline verification |

**Rule grading (Grade)**:

| Grade | Expression form | Audit SLA |
|:---:|------|------|
| A | pure Simple (30 operators) | highest, plain-text recomputable |
| B | Expression tree | high, eval_trace MUST |
| C | with function delegation | layered, Grade C MUST NOT pose as plain-text recomputable |

Rules with function delegation (Grade C) MUST explicitly mark "contains non-recomputable function delegation" in gloss; the delegated function's call input + output hash MUST enter the signature mode's preimage.

---

## Normative References

- **[RFC 2119]** Key words for use in RFCs to Indicate Requirement Levels.

---

*© 2026 Shenzhen Miaojing Technology Co., Ltd. · All rights reserved*
