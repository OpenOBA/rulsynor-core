# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Version lifecycle: [`VERSIONING.md`](./VERSIONING.md).

## [1.2.2] - 2026-09-11

### Changed

- **Language spec renamed to `erdl-language-spec-v2.1.md`** — `docs/SPEC/erdl-spec.md`
  and `erdl-spec.en.md` are renamed to `erdl-language-spec-v2.1.md` /
  `erdl-language-spec-v2.1.en.md`; all in-repo references are updated.
- **Verification vector count aligned to 318** — the expression layer now counts
  240 vectors (was 239), giving Core 318 = 78 audit-layer + 240 expression-layer.
  The 240 expression-layer vectors are independently verified by the
  `concordia-python-expression` runner (Erik Newton, Concordia); the 78
  audit-layer vectors remain byte-verified by norviq-go and concordia-python.

## [1.2.1] - 2026-09-09

### Fixed

- **Evaluation errors mark `errored: true` (E3)** — division by zero, invalid
  date, arity violation, and type-mismatched arithmetic operands now return
  `err()` (`errored: true`) instead of `ok(null)` (`errored: false`); a
  type-mismatched comparison and null/missing-field propagation stay normal
  `false` results (`errored: false`). Aligns with spec §7.2 E3 / §7.3(a).
- **`length` over a scalar folds to `false`** — present non-string/non-array
  values fold to `false` with a `type_mismatch` warning (like aggregate
  non-array §7.3(e)); `length(missing)` still returns `0` (spec §5.2
  exists-guard rationale).
- **`in` membership comparison NFC-normalizes strings (E10)** — decomposed vs
  precomposed strings compare equal, matching `eq`/`ne`.

## [1.2.0] - 2026-09-08

### Fixed

- **`policies[].hash` preimage missing `author_id`** — the per-rule content hash
  now covers the full RFC-002 §1.1 preimage `{ id, name, when, then, priority,
  ring, author_id }` (previously it hashed the raw rule, omitting `author_id`,
  producing a non-conforming hash).
- **`policies[].author_id` hardcoded `'system'`** — the author is now resolved
  per-rule (`RuleDefinition.author_id`) → input (`DecisionObjectInput.authorId`)
  → environment (`RULSYNOR_AUTHOR_ID`) → a documented default (`openoba`). The
  hardcoded `'system'` constant that defeated the SoD check (`agent.id ≠
  policies[].author_id`) is removed.
- **`human_oversight.required` omitted `DELEGATE`** — now derived from the
  human-in-the-loop decision set `{ REQUEST_HUMAN, ESCALATE, DELEGATE }`
  (RFC-002 §9.5 T03).

### Security

- **ReDoS detection consolidated to one source of truth** — `rule-validator`'s
  private `isReDosVulnerable` heuristic (a second, drift-prone copy) is removed;
  load-time validation now delegates to `safe-regex.ts analyzePattern`, the same
  gate the runtime `safeRegExp` uses. Adds a `{m}`/`{m,}`/`{m,n}` repeat-count
  cap (`REGEX_MAX_REPEAT = 10_000`, mirroring erdl-formal) on top of the existing
  pattern-length cap, input-length cap, and nested/adjacent-quantifier detection.

### Changed

- **Decision Object byte output** — `policies[].hash` and `policies[].author_id`
  values change (the hash preimage now includes `author_id`). Any DO archived by
  `1.1.0` differs from `1.2.0` for the same input; the flat-hash scheme
  (`erdl-do-v1.5-hash-flat`) is unchanged.
- **`buildDecisionObject` magic strings/numbers extracted to named constants** —
  no inline `'system'` / `'L2'` / `'unknown'` / `'rule matched'` / retention
  basis / AID fallback / hash-truncation lengths / role regexes remain.

### Added

- `RuleDefinition.author_id` and `DecisionObjectInput.authorId`
  (deployment-level rule author).
- `buildDecisionObject` unit tests (`test/guard.spec.ts`) — CORE 14 fields,
  `policies[].hash` preimage, author resolution, `human_oversight`, flat-hash
  recomputation, JURISDICTION omission.

## [1.1.0] - 2026-09-07

> **Version-line continuation.** The premature `1.0.0` release (2026-08-07) was
> superseded: its engine was not aligned to SPEC v2.0. This repository was then
> restarted on an internal `0.1.0-alpha` line while the engine was realigned and
> the Decision Object migrated. `1.1.0` is the first public release on the
> continued line, and supersedes both. The legacy `1.0.0` history is archived at
> [`docs/archive/CHANGELOG-1.0.0-legacy.md`](./docs/archive/CHANGELOG-1.0.0-legacy.md).

### Added

- **Deterministic kernel** — single expression-tree evaluation core (SPEC E7):
  30 operators (28 condition + 2 modifiers), 34 semantic nodes, fixed-point
  arithmetic (scale=14, half-even), string NFC normalization.
- **Decision Object v1.5 flat-hash** (`erdl-do-v1.5-hash-flat`): JCS (RFC 8785)
  + SHA-256, UUID v7 decision/execution ids, `evaluation.temporal_state`
  (within/rate window snapshots) and `evaluation.matched_rules[].canonical_tree`
  in the hash preimage; signature mode (ECDSA P-256) pending RFC-002 §10.
- **Out-of-the-box CLI**: `rulsynor chat` (7-step method), `setup`, `rules`,
  `audit list|show`, `mcp` (stdio JSON-RPC), `demo`.
- **Audit persistence** — SQLite `audit_records` (hash-idempotent writes,
  read-only views).
- **LLM tool-call loop** — function calling (tool_call id + tool role),
  OpenAI-compatible default client.
- **CORRECT 3-round correction loop** wired into the runtime (state machine
  `advanceCorrectLoop`; re-issue guidance to the agent, deterministic re-guard,
  up to 3 rounds, then escalate to human).
- **User rule loading** (`loadRulesFromDir`) and runtime `context` injection
  (`context.*` rules deterministically injected by the host).

### Changed

- License: runtime MIT → BSL 1.1 (Change Date 2030-06-09, Change License
  GPL 3.0; free for non-production use).
- Preset rules 30 → 34 (cross-tool security rules split per tool).
- Rule name prefixes enforce a registered allow-list (unregistered → rejected).
- Package renamed to `@openoba/rulsynor-core`.

### Fixed

- **`total_evaluated` count drift** — the evaluator derived it inconsistently
  (`allMatched.length` on the EMERGENCY_HALT short-circuit path, `enabled.length`
  elsewhere). An explicit `evaluatedCount` now counts rules whose unless/when
  evaluation was actually entered. (Review finding, RavindraAnnam.)
- **Catch-all (empty-condition) ALLOW never rewrites an explicit DENY** (§7.1
  item 6) — symmetric catch-all guard on both the ALLOW and DENY branches.
- **P0 field-path fix** — rule field paths are `tool.*` (Entity namespace), not
  `context.tool.*`; 30 preset rules were silently ALLOW-ing on a wrong context
  shape.
- **11 cross-tool security rules missing `tool.name`** — scoped and split.
- **`context.*` rules dormant** — runtime now injects `context`.
- **Decision Object v1.3 → v1.5** field alignment (UUID v7, temporal_state,
  canonical_tree, jurisdiction trimming).
- **`policies[].id` aligned with `matched_rules[].rule_id`** — P5
  tree-snapshot-divergence detection was silently dead.
- **Date nodes string semantics** — `date_add`/`date_part`/`month_last_day`
  take a date string (full ISO datetime output), aligned to the engine.
- **Type-mismatched `eq`/`ne` fold false**; **`!= null` on a present field
  folds true** (G4); **`date_add` amount MUST be an integer** (§7.3(f)).
- **AID 28-bit** (instanceId 8→6, SPEC §5.3).
- **audit show accepts the `sha256:` prefix** on hash lookup.

### Security

- Guard fail-close (E12 tier folding); runtime decision dispatch never executes
  tools for non-ALLOW verdicts; audit chain anchored via `previousAuditHash`;
  `risk_level=critical` forces signature mode.

---

## Historical

The superseded `1.0.0` release history is preserved at
[`docs/archive/CHANGELOG-1.0.0-legacy.md`](./docs/archive/CHANGELOG-1.0.0-legacy.md).
