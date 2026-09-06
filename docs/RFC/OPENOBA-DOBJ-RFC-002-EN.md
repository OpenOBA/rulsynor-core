<!-- 权威源：erdl-vectors/docs/OPENOBA-DOBJ-RFC-002-EN.md · 本文件为同步副本（2026-09-07），修改请在权威源进行 -->
# RFC 002 — ERDL Decision Object v1.5 · Flat-Hash Chain and Expression-Tree Field Specification

> Copyright © 2026 Shenzhen Miaojing Technology Co., Ltd. · CC0-1.0

> **RFC number**: ERDL-DOBJ-RFC-002
>
> **Document title**: ERDL Decision Object v1.5 — Flat-Hash Chain and Expression-Tree Field Specification
>
> **Version semantics**: the Decision Object data-model version described by this document is **v1.5** (preimage_version constant `"erdl-do-v1.5-hash-flat"`, frozen FREEZE-1); "SPEC v2.1" is the version of the higher-level specification document. The two are **orthogonal version lines** — the SPEC document version (v2.1) and the DO data-model version (v1.5) evolve independently and MUST NOT be conflated.
> **Author**: Tang Qixin
> **Maintainer**: OpenOBA (managed and maintained on its behalf)
> **Higher-level spec**: ERDL SPEC v2.1
> **Predecessor**: ERDL-RFC-001 (v1.3, the hash-pipeline foundation)
>
> **Inherited from RFC-001 (v1.3, archived)**: this document is a v1.5 increment; the following content remains authoritative in RFC-001 and is not repeated here — design philosophy (universal fact container), ecosystem compatibility (MCP/A2A/OpenTelemetry/OCSF/IETF AAT), privacy & data minimization (GDPR/LGPD/DPDP), regulatory versioning & upgrade paths, long-term maintenance & field governance (append-only), and threat model.
>
> **Revision history**: after multiple revisions, established the "flat hash + expression-tree field" scheme, and completed the jurisdiction vectors and the unified adjudication of stateful operators (within/rate). 2026-08-31: chain scale-governance pointer (§8); full-line count-caliber unification (audit layer 78 / Core 301). 2026-09-02: added §1.4 production-side invariant, §1.5 decision-derivation semantics, §1.6 Producer Contract; added two verification objects — decision_divergence (cross-layer semantic re-derivation) and V-PRODUCER (producer-side conformance); added P-05 residual risk to Appendix A; P6 resolvable-set semantic clarification.
>
> **Keyword interpretation**: the keywords "MUST", "MUST NOT", "SHOULD", "MAY" in this document follow the semantics of RFC 2119 and RFC 8174.

---

## Table of Contents

1. Hash Architecture: Whole-DO Flat JCS + Single Deletion Point
2. Expression-Tree Field: canonical_tree Enters the DO
3. gloss and Re-renderable Text: Not in the DO, Render-Validated
4. External-Content Anchoring: Knowledge/Attachment/Intent Hash Pointers
5. Compliance Profile and Jurisdiction Activation: 14-Framework Three-Layer Activation
6. Two-Layer Compliance-Proof System (Vector-Set Positioning)
7. Five-Step Verification (Step 0–6, 7 steps)
8. Chain Integrity (Break Detection + Canary)
9. Vector System (v1.5 Audit Layer)
10. Three-Layer Evidence System (Hash/Signature/TSA)
11. Version Evolution (v1.3 → v1.5)
Appendix A: Threat Model and Residual-Risk Statement

---

## 1. Hash Architecture: Whole-DO Flat JCS + Single Deletion Point

### 1.1 Hash Formula (isomorphic with v1.3, extended field set)

```
audit.hash = "sha256:" + HEX( SHA-256( JCS( all DO fields − audit.hash − signature − signing_key_id ) ) )
```

- **Single deletion point**: in hash mode only `audit.hash` itself is deleted (self-reference exclusion; `signature`/`signing_key_id` do not exist in hash mode, so the defensive deletion is a no-op); in signature mode the three fields `audit.hash`/`signature`/`signing_key_id` are deleted. **Deletion semantics are unified: delete (delete key), never blank** — the two produce different JCS bytes;
- **Self-reference exclusion for intra-field hashes** (same as `audit.hash`): when computing `policies[].hash` and `compliance_profile.profile_hash`, the field being computed (the hash key) MUST be temporarily removed before JCS, to prevent self-reference loops (RFC-002 §1); its **value** (the already-computed hash) participates in the whole-DO flat hash as an ordinary field;
- **`policies[].hash` preimage excludes gloss**: `policies[].hash` is the hash of the rule **content**, its preimage being the rule structural fields (id/name/when/then/priority/ring/author_id, RFC-002 §1), **excluding gloss** (gloss is a render product, not rule content, SPEC §8.3 G4); gloss tampering does not affect `policies[].hash` — it is detected by render validation (`gloss == render(tree)`, SPEC §8.3 G2), not by hash mismatch.
- **preimage_version constant (v1.5 hash mode)**: `"erdl-do-v1.5-hash-flat"` — a **domain separator** (prevents cross-version/cross-mode hash collisions, following the EIP-712 domain-separator idea), enters the preimage and is hash-protected; **routing is carried by the audit.mode field (§10.2); preimage_version does not carry routing**.
- All remaining fields (CORE + JURISDICTION + extensions + canonical_tree) **participate in JCS unconditionally** — no whitelist, no projection, no verifier-side field-selection logic; **generator-side trimming by `activated_fields` (RFC-002 §1) is the preceding step** — unactivated JURISDICTION fields are already physically removed on the generator side, so the verifier side still does zero selection, zero projection.

### 1.2 Relationship to v1.3

The pipeline is fully isomorphic (the five-step verification is unchanged); the only difference is the field-set extension: canonical_tree, knowledge-reference pointers, attachment pointers, compliance_profile.profile_hash, human_oversight objectification, first-layer compliance fields, and JURISDICTION fields 10→15 (RFC-002 §5.3). **The verifier needs to learn no new projection logic** — this is exactly why independent third parties can verify at low cost.

### 1.3 JCS Implementation Constraints (strict RFC 8785, zero customization)

1. Key order: UTF-16 code-unit order (RFC 8785 §3.2.1); DO field names are all ASCII, no ordering ambiguity;
2. Numbers: IEEE 754 double-precision serialization (ECMA-262 §7.1.12.1, V8/Ryu as the reference implementation);
3. **Integer constraint**: DO number fields (evaluation_duration_ms, policies[].version, ring, total_evaluated/total_matched, confidence_score, etc.) MUST be native integers without a decimal point, within the JS safe-integer range ±(2^53-1) (RFC-002 §1.3); `confidence_score` is a 0–100 integer scale (not a [0,1] ratio); business decimals (amounts/ratios) MUST enter the DO as fixed-point strings, native numbers forbidden;
4. Strings: **preserved as-is**, JCS performs no normalization; a lone surrogate (e.g. U+DEAD) MUST cause the implementation to terminate with an error. **Minimal canonical representation of decimal strings** (generator MUST complete it; JCS preserves as-is): fixed-point decimal/amount strings MUST forbid trailing zeros ("0.950"→"0.95"), must not carry a decimal point on integers ("1.0"→"1"), must forbid scientific notation / leading zeros / surrounding spaces; fixed-point rounding (SPEC §7.2 scale=14 + half-even) is completed before serialization;
5. **NFC boundary**: Unicode normalization (NFC) is done once at the **engine data-entry point** (all strings entering the DO are NFC'd at write time, including tree literals, type-B text reason/instruction/correction, and knowledge fileName); the JCS process itself has zero normalization steps (strict RFC 8785 as-is);
6. **Omit over Null**: when an optional field is null/undefined/empty-array, the generator **physically deletes the key (delete key)**, never blanks (blank: empty string/empty object/placeholder value) — delete and blank produce different JCS bytes; empty object {} and empty string "" (non-null) are preserved. **Exceptions**: ① chain-anchoring fields `audit.previous_hash`/`audit.previous_signature` MUST be preserved into JCS when the first record is null (§10.2#3, genesis-block cross-implementation symmetry); ② the `extensions` empty array MUST be preserved (RFC-001 §3.3 C3 conclusion write-back, avoiding mismatch with v1.3 regression vectors);
7. **Array order**: JCS key-order sorting applies only to object keys; it MUST NOT reorder array elements — array order is a semantic fact (expr_tree follows matched_rules order, knowledge_references/attachments follow retrieval/upload order, policies follow load order, rules_matched follows hit order);
8. NaN/Infinity forbidden.


### 1.4 Production-Side Invariant: the DO is co-derived with enforcement (construction-side, normative)

> **The DO MUST be derived from the same evaluation object that produced the enforcement effect, not re-assembled from it.**

The decision path and the record-emission path must share a single source: `result.decision`, `evaluation.matched_rules`, and `audit.hash` MUST be produced directly from the evaluation result of the **actual gating execution (enforcement)**, not assembled by a parallel path (e.g., a cache-hit path, or an async bypass) alongside it.

This invariant is **unverifiable from a finished artifact** — a verifier sees only the DO, never the execution that produced it; hence it belongs to the **construction-side normative constraint**, not the verification-side vector object (see Appendix A P-05 "record-emission fidelity"). A typical violation: enforcement correctly refuses, yet the record writes allow — the DO is hash-perfect and internally coherent, but false (the existing precedent for this structural mitigation is the OWASP AST09 "Bilateral Receipt Pattern": admission + execution dual receipts, linked by attempt_id, policy_version bound at decision time).

### 1.5 Decision-Derivation Semantics (construction-side, normative)

The derivation of `result.decision` (the normative basis for the `decision_divergence` check):

1. **Rule evaluation**: evaluate all `policies[].when` per SPEC §7 semantics (ring 0→3, priority ascending = higher priority, first-match + override), yielding the rule decision;
2. **human_oversight upgrade**: if `compliance_profile.risk_level ∈ {high, critical}` and `human_oversight.required === true`, then `result.decision MUST = REQUEST_HUMAN` (high-risk decisions require human adjudication, overriding the rule decision);
3. **fallback**: when no rule matches, `metadata.decision` (if present) > default `ALLOW`.

> These semantics are the normative basis for the `decision_divergence` check (VERIFIER-GUIDE §4.4): the verifier re-derives the three steps above and asserts `result.decision === the re-derived result`. A mismatch is `decision_divergence` (internally incoherent: e.g., ALLOW asserted while citing a DENY rule). Note this is a "bound, not a closure" — it covers only decision-rule coherence, not record-emission fidelity (Appendix A P-05).

### 1.6 Producer Contract (construction-side, normative)

`decision_divergence` (VERIFIER-GUIDE §4.4) re-derives the decision from the **finished DO**, so it can only cover internal record self-consistency. To reach "record-emission fidelity" (Appendix A P-05), producer-side conformance verification is required — it is the only means, outside the artifact, to observe whether "what the producer actually did" matches "the DO the producer emitted":

> **Producer Contract**: a conforming producer MUST expose `enforce(scenario) → { enforcement, do }`, where `enforcement` is the actual gating decision (allow/block/...), and `do` is the emitted DO; and it MUST satisfy `do.result.decision === enforcement.decision` (the DO must reflect the actual enforcement, not be re-assembled alongside it).

Verification method: feed a scenario → run the producer → capture both `enforcement` and `do` → assert they agree. This is a third verification object (V-PRODUCER), distinct from V-DO (bytes) and V-ENGINE (expression semantics), and the only place where P-05 is reachable — "no runner reading a finished DO can get at it, however good the runner is."

Reference: `scripts/verify-producer.mjs` (a single-path producer is fully consistent; a built-in two-path defective producer demonstrates the harness catches enforcement/DO divergence).

## 2. Expression-Tree Field: canonical_tree Enters the DO

### 2.1 Definition

`evaluation.matched_rules[].canonical_tree`: the **canonicalized expression tree (JSON nested-object form, not an S-expression string)** of each matched rule's compiled when condition (SPEC v2.1 §8.2 canonical form). **It is an ordinary DO field**, enters the flat hash together with the whole DO, with no special handling. The tree structure enters JCS directly as a JSON nested object (object key order sorted by JCS, array order semantically fixed), byte-deterministic.

### 2.2 Canonicalization Rules (frozen once at engine construction)

| Rule | Content |
|------|------|
| Node set | SPEC §5.3 frozen 34-node baseline (not RFC-002 §9); only trimmed, never expanded; future additions go through version upgrade |
| Tree shape | **JSON nested object** (`{"eq":[{...},"exec"]}`), not an S-expression string; JCS recursively canonicalized |
| Node order | in-tree arrays follow semantic order (e.g. arithmetic/logical argument order); JCS does not reorder array elements; the matched_rules array follows hit order (§1.3#7) |
| Field names carry weight | metadata (source location, comments, gloss) stripped; semantics carried by key names and values |
| Numeric literals | rule values enter the tree as **fixed-point decimal strings** (scale=14 + half-even, SPEC §7.2; engine parses via fromDecimalString), native numbers forbidden, avoiding IEEE 754 cross-language precision divergence; serialized to **minimal canonical representation** (§1.3#4, no trailing zeros / no decimal point on integers) |
| String literals | NFC'd once at the engine entry point, thereafter as-is |
| 0 hits | field absent (Omit), zero special-casing on the verifier side |
| Non-pure-condition rules (fn delegation, compile returns null) | that rule has no canonical_tree key (Omit); the decision fact is still anchored by the remaining matched_rules fields |
| **Stateful operators (within/rate)** | **state does not enter canonical_tree; it enters the DO via the `temporal_state` field** (see §2.4); the window count is an input that affects the decision, MUST enter the audit chain and be offline-recomputable, consistent with SPEC §5.2 |

> **Boundary-coverage division**: the construction semantics of the canonicalization boundaries listed above (0-hit Omit / non-pure-condition no tree key / fixed-point tree literals / NFC strings) are covered by the V-ENGINE expression vectors (RFC-002 §9); the V-DO-v15 hash-layer vectors treat canonical_tree as an opaque field, verifying its "participation in the flat hash + snapshot comparability", without re-covering the in-tree canonicalization.

### 2.3 Independent Recompute Verification

The verifier SHOULD pull the rule set via `rule_set_version.id` → recompile + canonicalize per matched_rules → byte-compare with the in-DO snapshot; inconsistency is judged `tree_snapshot_divergence`. This mechanism is orthogonal to the hash architecture — snapshot tampering is already detected by the flat hash; recompilation is a second semantic-layer confirmation.

> **Test-vector approximation**: the hash-layer test vectors (no external rule store) use the in-DO `policies[].when` as the rule source for snapshot comparison (equivalent to a simplified approximation of "recompile + canonicalize"); production uses `rule_set_version.id` to pull the external rule set for recompilation. Both have the same judgment semantics for tree_snapshot_divergence.

### 2.4 temporal_state Field for Stateful Operators (within/rate)

`within` and `rate` are the only two stateful operators among the 30 operators; their evaluation depends on cross-decision sliding-window counts. This specification establishes a unified principle: **any input that affects the decision result MUST enter the DO audit chain**. The window count is exactly such an input, therefore:

- **State does not enter the expression tree**: the expression tree stays a pure function (E1), comparing against the "current window count" as a fact;
- **State is maintained outside the tree**: the sliding-window counter is persistently maintained by GuardStateManager (Clock injectable, aligned with the Drools Fusion pseudo-clock idea);
- **State snapshot enters the DO**: the window-count value used by this decision enters the DO via the `evaluation.temporal_state` field, enters the flat hash with the whole DO — making "why the rate limit fired now" offline-recomputable;
- **Field structure (FREEZE-1 structural freeze)**: `evaluation.temporal_state` is an array of objects, one per active stateful operator: `{ rule_id, operator: "within"|"rate", field, window_ms, count, limit? }` — recording "which rule, which operator, which field, the current in-window count, the limit (rate has one)", for offline audit recompute.

**Independent recompute verification of temporal_state (orthogonal to §2.3 canonical_tree)**: canonical_tree is recomputed by "rule + context" recompilation; temporal_state is recomputed by "cross-decision historical event sequence" replay — the two have different verification paths. The offline recompute of temporal_state MUST be carried by **V-TEMPORAL independent state-verification vectors** (§9 vector table, not occupying V-SCENE numbers, see the naming clarification): replay the GuardStateManager window-count evolution by decision sequence, comparing each step's in-DO temporal_state snapshot against the replay result; inconsistency is judged `temporal_state_divergence`. This code is a **single-DO semantic breach** (same as tree_snapshot_divergence, §9.1.1 priority P5 evidence layer; not a §8 chain break, not warning-level).

> **Field-activation classification**: `temporal_state` is a "conditionally-activated" field (§5.3) — produced only when this decision matched a rule containing within/rate (Omit over Null: physically delete the key when no stateful operator matched); its existence is covered by V-TEMPORAL vectors, not included in V-COMP field-existence checks (V-COMP checks jurisdiction/framework-required compliance fields; temporal_state is a business-adjudication input, not a compliance field).
>
> **preimage_version impact determination**: `temporal_state` is an **incremental conditionally-activated field** of the v1.5 field set (optional, produced by fact), it does not change the hash algorithm, does not change the CORE 14 field structure, does not change the single-deletion-point (`audit.hash`) semantics. Therefore the `preimage_version` constant **stays `"erdl-do-v1.5-hash-flat"`**, no version-number bump — the field-set increment merges directly into v1.5, no need to bump to v1.6. This determination is consistent with "SPEC document version (v2.0) and DO data-model version (v1.5) are orthogonal version lines": the field set evolves incrementally within the DO model, without touching the SPEC document version.

## 3. gloss and Re-renderable Text: Not in the DO, Render-Validated

| Field | Disposition | Mechanism |
|------|------|------|
| gloss | **not in the DO** (render product, not an on-chain fact) | re-rendered in real time via `render(canonical_tree)` at display/audit time, recomputable and self-evidencing |
| eval_trace | **not in the DO** (tree-derived evidence) | rootHash determined by the tree, recomputable |
| grade | **not in the DO** (derivable) | `derive(tree, has_fn_delegation)`, needs out-of-tree parameter completion, recomputable |
| reason/instruction/correction | rule-author text, in the DO (type-B text) | transparently passed through `action.*`, frozen with the rule version, naturally covered by the flat hash |

**The nature of readable/derivable fields**: they are **projections, not the kernel**, and do not go on-chain as evidence. The DO stores only result facts (including the canonical_tree kernel); gloss and other projections are re-rendered from the tree in real time.

**Readable text is not in the DO; wording revisions have zero hash impact** — no need to change the hash architecture for gloss, nor to add a single deletion point for gloss in the hash.

**Bilingual rendering**: gloss rendering is bilingual (zh/en), switched by the `lang` parameter (single renderer, not dual versions); the G1 determinism invariant is covered bilingually, and the V-GLOSS vectors verify `gloss_zh` and `gloss_en`.

## 4. External-Content Anchoring: Knowledge/Attachment/Intent Hash Pointers

External content is anchored by hash pointers (decoupled from the hash architecture):

- `evaluation.knowledge_references[]`: { entry_id, entry_version, content_hash, fragment_hash } — the retrieval hit set, content in the store, pointer on-chain;
- `context.attachments[]`: { storage_key, content_hash, file_name, mime_type, file_size } — file-level SHA-256, >100MB turns into an object-storage pointer;
- `context.intent`: { source, category, summary_hash } — the intent original text pointerized;
- `context.memory_keys[]`: in retrieval-hit order.

All enter the flat hash as ordinary fields. `content_unresolvable` (cold-storage deletion / loss) is a reference-integrity warning, not a chain break.

## 5. Compliance Profile and Jurisdiction Activation: 14-Framework Three-Layer Activation

### 5.1 Compliance-Profile Anchoring

`compliance_profile.profile_hash` (the profile body's JCS+SHA-256) enters the flat hash — blocking the "swap the jurisdiction declaration" attack (V-COMP-F02). Profile changes are non-retroactive (grandfathering, SPEC v2.1).

### 5.2 Three-Layer Activation Dimensions (14-framework full coverage)

| Layer | Dimension | Frameworks |
|----|------|------|
| Jurisdiction-mandatory | jurisdictions | EU (AI Act), CN (GB/Z 185), US (NIST/Colorado/HIPAA), SG (MGF), BR (LGPD), IN (DPDP) |
| Industry-conditional | industries | HIPAA (healthcare), PCI DSS (payment cards), etc. (HIPAA is both a jurisdiction requirement and an industry standard, triggered separately per activation dimension) |
| Risk-conditional | risk_level | critical → signature mandatory (the profile MUST include `signature` in `activated_fields`, jurisdiction-independent: even if a jurisdiction itself does not require signature (SG/BR/IN), critical still requires signature endorsement; failing to include it means the risk-condition layer is not effective, judged `compliance_field_missing` — vector V-COMP-F08; included but field missing is judged the same code — vector V-COMP-F09) |
| Global / standards bodies | explicitly mounted in regulatory_references | COSO GenAI, ISO/IEC 42001, OWASP Agentic, IEEE P3395, CAICT 2.0 |

Multi-jurisdiction simultaneous activation = the union of activated_fields (RFC-001 §5.4, endorsed by V-COMP-005). **The 14 frameworks are globally neutral and peer-level** — any jurisdiction (including China's three-level legislation scenarios) is a first-class instance; there is no country-specific special structure.

### 5.3 Three-Way Field-Activation Semantics

| Type | Semantics | Fields |
|------|------|------|
| Resident fact | required in every DO | all CORE 14 fields (spec/decision_id/compliance_profile/execution_trace_id/timestamp/evaluation_duration_ms/agent/context/rule_set_version/policies/evaluation/result/human_oversight/audit, see RFC-002 §5.3) |
| Jurisdiction-activated | MUST be filled once declared in activated_fields; missing is judged compliance_field_missing | JURISDICTION 15 fields (model_id / agent.known_limitations / fairness_assessment / impact_assessment_id / autonomy_level / data_modification_expected / context_snapshot_hash / sanitized_context / confidence_score / signature / signing_key_id / agent.aid / agent.tool_registry_hash / agent.algorithm_filing_no / agent.model_registration_id, see RFC-002 §5.3) |
| Conditionally-activated | produced by fact (human intervention / business object present / stateful operator hit) | human_oversight (`required` resident + `status`/`human_actor_id`/`timestamp`/`override_reason` conditional) / knowledge_references / attachments / intent / tool (`context.tool.name`) / outcome / evaluation.temporal_state (§2.4, produced on within/rate hit, existence covered by V-TEMPORAL, not included in V-COMP field-existence checks) |

> **Existence coverage of conditionally-activated fields**: human_oversight missing → F04 (oversight_missing); knowledge_references unresolvable → A02 (content_unresolvable); tampering of conditional fields such as attachments/intent/outcome is naturally covered by the hash (flat scheme zero-selection); temporal_state covered by V-TEMPORAL.

**First-layer compliance fields enter the hash (zero-selection cost under the flat scheme)**: agent.known_limitations / tool_registry_hash / algorithm_filing_no / model_registration_id are "integrity-level compliance claims" (OpenOBA reference implementation's own compliance), naturally tamper-protected by the whole-DO hash — V-COMP-F06/F07 verify this protection holds. This is the flat scheme's natural advantage over whitelist schemes: **no per-field selection declaration needed; all fields are protected by default**.


## 6. Two-Layer Compliance-Proof System (Vector-Set Positioning)

The OpenOBA reference implementation is a professionalized AI employee built on a deterministic engine — the vector set carries two layers of compliance proof:

| Layer | What it proves | Carried by |
|----|---------|---------|
| **Layer 1: self-compliance** | the OpenOBA reference implementation aligns with the 14 frameworks and withstands regulatory audit of the product | V-COMP group 1 (jurisdiction-activation completeness, 7 vectors covering 6 jurisdictions + multi-jurisdiction union) + group 2 (14-framework mapping) + F01/F03/F04/F05 + **F06/F07 (first-layer field-tamper detection)** |
| **Layer 2: task compliance** | every task/business/case executed through the OpenOBA reference implementation is auditable | D13 + A10 + K1 + G14 (conclusion layer) |
| **Forensic-grade audit chain** | chain complete, attribution and time provable, independently verifiable | C8 + T3 + SIGN5 + evidence-bundle dual-source verification |

Two-layer water-level consistency principle: any field subject to V-COMP existence checks, whose compliance semantics is an integrity-level claim, MUST be hash-protected. Under the flat scheme this principle is automatically satisfied.

## 7. Five-Step Verification (Step 0–6, 7 steps)

> "Five-step" is a historically inherited name: the v1.3 method was Step 1–5 (five steps); v1.5 adds Step 0 (version routing) and Step 6 (answer double-check), for 7 steps total.

```
Step 0: version-structure discrimination (dual-version coexistence routing): the DO contains evaluation.matched_rules[].canonical_tree or a v1.5 signature field (audit.preimage_version = `"erdl-do-v1.5-hash-flat"` or compliance_profile.activated_fields is an array) → v1.5 flat hash (continue); absent and full-DO structure → v1.3 legacy path (for historical-archive verification only)
Step 1: read audit.preimage_version (domain separator constant, v1.5 hash mode = "erdl-do-v1.5-hash-flat", enters the preimage and is hash-protected)
Step 2: deep clone → single deletion point: DELETE audit.hash (hash mode; signature mode additionally deletes signature/signing_key_id) — all other fields (including canonical_tree) participate as-is, zero projection, zero field selection
Step 3: JCS(all fields) → canonical bytes (strict RFC 8785, zero custom steps)
Step 4: SHA-256(canonical bytes) → recomputed hash
Step 5: compare recomputed hash with stored audit.hash
Step 6 (vector-verification mandatory): the recomputed hash is also cross-checked against the answer file's expected value (canonical_hex, full JCS preimage hex, independent answer file)
        — step 5 verifies "the artifact's claim about its own digest", step 6 verifies "the vector's own expectation"
        the two are independent, preventing stale self-referential digest; canonical_hex is physically isolated (RFC-002 §2), unreadable by compliant runs
```

> **Resource limit**: when a single DO serializes beyond 1 MB, the verifier MUST reject (`resource_limit_exceeded`), preventing DoS.

## 8. Chain Integrity (Break Detection + Canary)

Break determination (hash mode, any one breaks): ① audit.hash recompute mismatch; ② previous_hash inconsistent with the previous record's hash; ③ a DO missing from the chain; ④ adjacent DOs mixing preimage versions; ⑤ adjacent DOs with different audit.mode (mode_mixed_chain). Signature-mode criteria: signature verification failure + previous_signature chain-trace break (see §10.3 V-SIGN-002/003).

> **Detection priority (supplement)**: the verifier first checks hash self-consistency (①), then version support (④); only after the whole chain is hash-self-consistent does it run structural-semantic detection, reporting the first hit in the order "genesis mismatch (§9.2 C06) → previous_hash dangling → chain_seq gap → mode mixing → time regression (§9.2 C05)".

Reference-integrity warning (not a break): content_unresolvable (cold-storage deletion / loss). Chain scale governance (sharding + Merkle + Checkpoint + incremental verification) is in RFC-002 §8 — this section defines only the linear-chain break determination.

Canary: the v1.5 chain-position canary continues the AV-013 pattern — a correct implementation MISMATCHes, a regressed implementation (skipping independent recompute / taking the wrong preimage) MATCHes and is caught. The canary vector's `expected.breach` is marked with the dedicated code `canary_mismatch` (not a semantic breach; it only marks "a correct implementation MUST hash MISMATCH").

## 9. Vector System (v1.5 Audit Layer)

> **Verification status (binary classification)**: the vectors in this specification are divided into two classes by "whether independently third-party-Runner byte-verified" —
> - **Verified**: the current v1.5 78 generated hash-layer vectors, byte-verified by two independent third-party runners — norviq-go (Go, 2026-09-01) and concordia-python (Python, Erik Newton, 2026-09-02), each at 107/107 canonical bytes; plus the historical v1.3 13 AV vectors (Erik Newton / Concordia, 2026-07-30, self-built Python JCS, byte-identical pass).
> - **Unverified**: the not-yet-generated vector layers (V-SIGN signature chain, V-TEMPORAL time anchoring, see §10.3).
>
> The recording principle follows "**Measurements, not endorsements**" — record only the measurement facts (who, which day, how many passed), no endorsement.
>
> **Auto-record mechanism**: the reference runner's verification result is written by CI to `conformance/CONFORMANCE.md` (recording who, which day, how many passed + Check 1/2 + K01 discrimination + the R1–R6 conformance checklist), generated by `scripts/generate-conformance.cjs` (`npm run conformance`); CI enforces a freshness gate (stale → red) — measurement facts are recorded automatically, without hand-written endorsement.

| Category | Number range | Count | Content |
|------|------|:---:|------|
| Decision-type coverage | V-DO-v15-D01..D13 | 13 | 13 decision types (ALLOW/DENY/CORRECT/NOTIFY/REQUEST_HUMAN/ESCALATE/DELEGATE/DEFER/EMERGENCY_HALT/ROLLBACK/QUARANTINE/WORKFLOW/GUIDE) × flat hash (with canonical_tree field) |
| Chain-attack detection | V-DO-v15-C01..C08 | 8 | normal-chain baseline + 7 attacks (single-record tamper / record deletion / dangling pointer / clock regression / whole-chain rebuild / version downgrade / mixed chain, see §9.2) |
| Anchoring-attack detection | V-DO-v15-A01..A10 | 10 | knowledge tamper / unresolvable reference / fragment mismatch / attachment tamper / intent tamper / memory-key tamper / tree-snapshot forgery / tree tamper ×2 (node order swap / literal precision) / type-B text tamper (see §9.3) |
| Signature chain (planned, not generated) | V-SIGN-001..005 | 5 | valid verify / tamper verify-fail / chain trace-back / forged signature / signature canary, §10.3; added after the signature layer lands |
| Time anchoring (planned, not generated) | V-DO-v15-T01..T03 | 3 | TSA token / clock_drift / key decision without anchor; added after the signature layer lands |
| Canary | V-DO-v15-K01 | 1 | chain-position canary (hash mode, continues AV-013; the signature canary is carried by V-SIGN-005, not double-counted) |
| Conclusion layer | V-DO-v15-G01..G14 | 14 | structural attacks fixed 6 + domain examples 8 (government 4 + enterprise 4, extensible) |
| Jurisdiction compliance | V-COMP-001..021 + F01..F11 | 32 | field conformance 21 (jurisdiction 7 + framework 14) + failure detection 11 (incl. F06/F07 first-layer tamper, F08/F09 risk-condition layer, F10/F11 priority pinning, see §9.1) |
| **Stateful-operator state verification (planned, not generated)** | **V-TEMPORAL-001..004** | **4** | within/rate cross-decision window-count state behavior (multi-decision sequences, verifying temporal_state snapshot consistent with replay, corresponding to §2.4): T01 rate normal sequence (under-limit→over-limit), T02 within normal sequence, T03 temporal_state snapshot tamper (judged `temporal_state_divergence`), T04 state-replay canary (a regressed verifier skipping replay is caught). Vectors generated-frozen after temporal_state lands in the DO |
| **Total** | | **audit layer 78** | hash-layer 78 (D/C/A/K/G/V-COMP frozen). Signature 5 + TSA 3 + V-TEMPORAL 4 are planned (not generated, not counted) |

> **Verification objects added 2026-09-02 (not in Core 317)**: `decision_divergence` (cross-layer semantic re-derivation, V-DIVERGENCE 3 vectors, re-derives the decision from the DO's stored context+rules per §1.5, see VERIFIER-GUIDE §4.4) + `V-PRODUCER` (producer-side conformance, runs the producer per §1.6 Producer Contract, capturing enforcement vs. emitted DO — the only place P-05 is reachable).

> **Naming clarification (avoiding confusion with PAE-spec §45 V-SCENE semantics)**: PAE-spec §45's V-SCENE specifically means the **seven lifecycle-stage** business-scenario verification (identity/position/training/operation/audit/trust/retirement), numbered `V-SCENE-NNN`. The within/rate stateful-operator window-count verification is a **different verification object** (operator-state correctness, not a business-scenario loop), so this specification carries it under an **independent sequence V-TEMPORAL**, not occupying V-SCENE numbers — corresponding to the "independent state-verification vectors" branch of RFC-002 §9 line 2462 "into V-SCENE (multi-decision sequence) **or independent state-verification vectors**".
>
> **Impact of temporal_state entering the DO on existing vectors**: `temporal_state` is a conditionally-activated field, produced only when a within/rate rule is matched. The existing 78 vectors contain no within/rate conditions (fully checked), so temporal_state entering the DO **does not change the preimage of any existing vector**; no need to regenerate the existing 78. V-TEMPORAL 4 are new coverage, verifying the "cross-decision window-count" behavior not covered by existing vectors.

**Generation self-check mandatory** (the §7 step-6 double-check engineering lesson): before freezing vectors, the reference runner does a full self-check, all MATCH except the canary; step-6 double-check mandatory. Signature vectors are generated-frozen synchronously as the signature implementation develops.


### 9.1 V-COMP Jurisdiction-Compliance Vector Full List (32)

> **Numbering note**: the jurisdiction group was originally five vectors 001..005 (CN/EU/US/SG/multi-jurisdiction union); when BR/IN were added, **020/021 were appended without renumbering the existing ones** (V-COMP numbers are `[FREEZE-3]` naming-level frozen: not reused, not reordered, meaning unchanged). Hence the jurisdiction group is numbered 001..005 + 020..021, a non-contiguous range — a normal result of freeze governance.

**Group 1: jurisdiction activation-field completeness (7)**

| Number | Jurisdiction | Checked fields |
|------|------|------|
| V-COMP-001 | CN · GB/Z 185 | agent.aid / agent.tool_registry_hash / agent.algorithm_filing_no / agent.model_registration_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature (signature layer, unfrozen) |
| V-COMP-002 | EU · AI Act | model_id / agent.known_limitations / confidence_score / fairness_assessment / impact_assessment_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature (signature layer, unfrozen) |
| V-COMP-003 | US composite | model_id / confidence_score / fairness_assessment / impact_assessment_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature (signature layer, unfrozen) |
| V-COMP-004 | SG · MGF | autonomy_level / confidence_score / data_modification_expected |
| V-COMP-005 | CN+EU multi-jurisdiction union | union of both jurisdictions' fields, no omission, no conflict |
| V-COMP-020 | BR · LGPD | model_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context (Art.20 review right → autonomy_level; Art.20 §1 inform standards & procedures → model_id; Art.18 erasure + PII separation → sanitized_context. LGPD does not explicitly require human intervention, so human_oversight is not force-activated) |
| V-COMP-021 | IN · DPDP | data_modification_expected / context_snapshot_hash / sanitized_context (§12(1)(d) erasure right → sanitized_context; §12(1)(a-c) correction/completion/update → data_modification_expected; §12(2) downstream cascade notification needs traceable data flow → context_snapshot_hash. DPDP has no dedicated automated-decision clause, so autonomy_level / model_id are not activated) |

> Note: the `signature` above is a signature-layer field (second layer of the three-layer evidence system, §10.3 V-SIGN unfrozen); the hash-layer vectors (V-DO-v15 78) do not yet contain a signature **value**, to be added into V-COMP-001..003 field-existence checks after the signature layer lands. The BR/IN two vectors contain no signature — LGPD/DPDP do not require non-repudiation signature; signature mandates come from HIPAA/PCI DSS and `risk_level=critical` (§5.2).
>
> **The verifiable boundary of critical (honest framing)**: the hash layer can only verify "existence" (the two negative examples F08/F09) — because a **compliant** critical DO is by definition signature-mode, and its positive example must contain a real verifiable signature, which belongs to the signature layer (carried by V-SIGN-001, §10.3). This vector set does **not** include fake positives with placeholder signatures, to avoid misleading the signature-layer runner.

**Group 2: 14-framework field mapping (14, consecutively numbered; this group checks "framework → field mapping", independent of the DO's actual jurisdiction)**

| Number | Framework | Checked fields |
|------|------|------|
| V-COMP-006 | EU AI Act | evaluation_duration_ms + human_oversight + agent.known_limitations (Art.12/14/13) |
| V-COMP-007 | NIST AI RMF | model_id + confidence_score + fairness_assessment |
| V-COMP-008 | COSO GenAI | rule_set_version + agent.id ≠ policies[].author_id (SoD) |
| V-COMP-009 | ISO/IEC 42001 | impact_assessment_id |
| V-COMP-010 | GB/Z 185 | agent.aid + agent.tool_registry_hash + agent.algorithm_filing_no + retention ≥36-month declaration |
| V-COMP-011 | OWASP Agentic | decision explainability (decision/reason) |
| V-COMP-012 | HIPAA | signature declaration + data_modification_expected + PII hot/cold separation |
| V-COMP-013 | PCI DSS | signature declaration + data_modification_expected |
| V-COMP-014 | Colorado SB 205 | decision + reason + fairness_assessment |
| V-COMP-015 | Singapore MGF | autonomy_level |
| V-COMP-016 | CAICT 2.0 | data_modification_expected + decision explainability |
| V-COMP-017 | LGPD | right-to-be-forgotten scenario (PII separation, sanitized_context existence check; content_unresolvable carried separately by A02) |
| V-COMP-018 | DPDP | same as LGPD pattern |
| V-COMP-019 | IEEE P3395 | cross-system correlation execution_trace_id (standard under development) |

**Group 3: compliance-failure detection (11)**

| Number | Scenario | Expected detection |
|------|------|------|
| V-COMP-F01 | activated field missing | compliance_field_missing |
| V-COMP-F02 | compliance profile swapped | hash_mismatch (profile_hash whitelist anchoring) |
| V-COMP-F03 | jurisdiction mismatch | jurisdiction_mismatch |
| V-COMP-F04 | high-risk decision without human-oversight record | oversight_missing |
| V-COMP-F05 | SoD violation | sod_violation (agent.id == policies[].author_id) |
| V-COMP-F06 | first-layer compliance claim content tampered | hash_mismatch (known_limitations/tool_registry_hash tamper → hash mismatch) |
| V-COMP-F07 | filing & identity fields tampered | hash_mismatch (algorithm_filing_no/model_registration_id tamper → mismatch) |
| V-COMP-F08 | `risk_level=critical` but profile did not include `signature` in `activated_fields` (risk-condition layer not effective) | compliance_field_missing |
| V-COMP-F09 | `risk_level=critical` included `signature` but field missing | compliance_field_missing |
| V-COMP-F10 | multi-breach: unrecognized jurisdiction code + missing activated field | jurisdiction_mismatch (P1 priority, §9.1.1) |
| V-COMP-F11 | multi-breach: tree-snapshot divergence + unresolvable reference (warning-level) | tree_snapshot_divergence (P5 precedes P6, §9.1.1) |

> **F08/F09 vector-construction constraint**: both fixtures take `human_oversight.required = true`, so `oversight_missing` (applicable to high/critical) does **not** also hold — a single-breach vector MUST contain only a single breach; multi-breach priority is pinned by the dedicated F10/F11 (§9.1.1).

### 9.1.1 Single-DO Breach Detection Priority (normative, isomorphic with §8 chain-layer priority)

When multiple single-DO breaches hold simultaneously, a conforming runner **MUST** report the **first hit** in the top order below (consistent with the chain-layer "report the first hit" semantics). Without a specified top order, different implementations could report different breach codes for the same DO, breaking cross-implementation consistency:

| Priority | breach code | Layer and rationale |
|:---:|------|------|
| **P1** | `jurisdiction_mismatch` | unrecognized jurisdiction code ⇒ the whole profile is uninterpretable, other checks lose their premise; if placed later, a **fabricated jurisdiction code + incomplete activation set** could mask field-completeness failure |
| **P2** | `compliance_field_missing` | profile-declared required field missing (incl. §5.2 risk-condition layer critical → signature mandatory) |
| **P3** | `oversight_missing` | high-risk / critical decision missing human-oversight record (governance constraint) |
| **P4** | `sod_violation` | separation-of-duties violation (`agent.id == policies[].author_id`) |
| **P5** | `tree_snapshot_divergence` / `temporal_state_divergence` (the latter effective after V-TEMPORAL lands) | evidence layer: decision tree snapshot inconsistent with the rule source / stateful-operator window-count snapshot inconsistent with the replay result (§2.4, same level) |
| **P6** | `content_unresolvable` | **warning-level** (§8: reference-integrity warning, not a break) → MUST be last; if placed earlier, a cold-storage-deleted knowledge reference would mask a co-occurring real breach |

**Priority-pinning vectors** (text-only without a vector equals unverified):

| Vector | simultaneously-holding breaches | Expected report | Discriminating power |
|------|------|------|------|
| **V-COMP-F10** | `jurisdiction_mismatch` (P1) + `compliance_field_missing` (P2) | P1 | any implementation placing P2 first reports `compliance_field_missing` → caught |
| **V-COMP-F11** | `tree_snapshot_divergence` (P5) + `content_unresolvable` (P6) | P5 | any implementation placing warning-level P6 first reports `content_unresolvable` → caught |

The two vectors' `expected.also_present` field explicitly lists the suppressed lower-priority breaches.

> **also_present is a normative constraint, not a comment (MUST)**: for any semantic BREACH vector, a conforming runner MUST verify —
> ① `expected.breach` equals the **first item** after priority sorting;
> ② every item in `expected.also_present` MUST actually hold and sort after the first item (truly suppressed);
> ③ the reverse also holds: **any breach that holds simultaneously but is not declared in `also_present` is a vector-set defect** (a vector must self-describe all its violations, otherwise it implicitly depends on priority without knowing it).
>
> The reference implementation has implemented all three as hard failures (reverse verification: after deleting F10's also_present declaration, the verifier immediately reports 78→77 and names the undeclared item).
> The motivation for this constraint: also_present was initially written only as "for runner self-check" while the reference implementation never read it —
> the same class of defect as the "answer-file dead key" fixed the same day (declared but verified by no one).

### 9.1.2 `jurisdiction_mismatch` Semantic Boundary (explicitly narrowed)

This specification narrows `jurisdiction_mismatch` to a single meaning:

> `compliance_profile.jurisdictions` contains a code **outside the authoritative jurisdiction set** (§5.2 six jurisdictions: CN/EU/US/SG/BR/IN). An unknown code is judged a violation (**fail-closed**) — preventing a fabricated jurisdiction code from bypassing field activation. New jurisdictions go through version upgrade; implementations MUST NOT extend the set on their own.

**Scenarios explicitly not belonging to this code, and their attribution** (avoiding semantic drift):

| Scenario | Why not this code | Already covered by |
|------|------|------|
| jurisdiction declaration **tampered** (profile swapped) | an integrity problem, caught by cryptography rather than semantic checks | `profile_hash` pinning → **V-COMP-F02** (hash_mismatch) |
| DO-declared jurisdiction **≠ deployment-expected jurisdiction** (config mismatch) | a stateless verifier does not hold the "deployment expectation" input, cannot judge | deployment-time config validation (runtime); to vectorize, the vector would need to carry `expected_jurisdictions` metadata → belongs to the **V-JURIS** layer (PAE-spec §45 classification: V-COMP verifies field **existence**, V-JURIS verifies field **semantic correctness**) |
| jurisdiction legitimate but **its required fields not activated** | not a jurisdiction-code problem | → `compliance_field_missing` (P2) |

### 9.2 C-Series Chain-Attack Vector Full List (8)

| Number | Scenario | Expected detection (BREACH code) |
|------|------|------|
| V-DO-v15-C01 | normal chain (no attack) | MATCH |
| V-DO-v15-C02 | single-record tamper (decision field) | hash_mismatch |
| V-DO-v15-C03 | delete a middle record (chain_seq gap) | chain_seq_gap |
| V-DO-v15-C04 | dangling pointer (previous_hash dangling) | previous_hash_dangling |
| V-DO-v15-C05 | clock regression (timestamp rolls back) | time_regression |
| V-DO-v15-C06 | rebuild after whole-chain deletion | chain_genesis_mismatch |
| V-DO-v15-C07 | version downgrade (preimage_version tampered to an unsupported value) | version_unsupported |
| V-DO-v15-C08 | mixed-mode chain (adjacent DOs have different modes) | mode_mixed_chain |

### 9.3 A-Series Anchoring-Attack Vector Full List (10)

| Number | Scenario | Expected detection (BREACH code) |
|------|------|------|
| V-DO-v15-A01 | knowledge body tamper (content_hash inconsistent with the stored content hash) | hash_mismatch |
| V-DO-v15-A02 | unresolvable reference (entry_id nonexistent) | content_unresolvable (warning, not a break) |
| V-DO-v15-A03 | fragment hash mismatch (recomputed fragment_hash inconsistent with the on-chain fragment_hash) | hash_mismatch |
| V-DO-v15-A04 | attachment tamper | hash_mismatch |
| V-DO-v15-A05 | intent pointer tamper | hash_mismatch |
| V-DO-v15-A06 | memory-key tamper | hash_mismatch |
| V-DO-v15-A07 | tree-snapshot forgery (canonical_tree wholly replaced) | tree_snapshot_divergence |
| V-DO-v15-A08 | type-B text tamper (reason/instruction/correction) | hash_mismatch |
| V-DO-v15-A09 | tree tamper (node order swap) | tree_snapshot_divergence |
| V-DO-v15-A10 | tree tamper (literal precision attack) | tree_snapshot_divergence |

### 9.4 G-Series Conclusion-Layer Vector Full List (14)

**outcome conclusion-layer field set (`[FREEZE-1]` structural layer)**: `result.outcome` is the unified conclusion-layer object, uniformly abstracting government (approval/review/selection/appraisal) and enterprise (hiring/procurement/performance/contract); fields: `scenario` (scenario identifier, dot-separated naming, e.g. gov.approval) / `verdict` (conclusion identifier) / `grade?` (grade) / `rank?` (rank) / `comment?` (conclusion note) / `basis[]?` (basis hash pointers, may contain conclusion-vocabulary anchoring ref_type=verdict_registry; current vector examples are pure string pointers) / `extra?` (arbitrary structured extension area). Pure Guard decisions (no business conclusion) omit the whole group; structural layer frozen, value layer open to arbitrary extension; enters the flat hash with the whole DO (no whitelist projection).

**Structural attacks fixed 6 (domain-independent, does not grow with industry)**:

| Number | Scenario | Expected detection |
|------|------|------|
| V-DO-v15-G01 | verdict tamper | hash_mismatch |
| V-DO-v15-G02 | grade·rank tamper | hash_mismatch |
| V-DO-v15-G03 | basis deletion | hash_mismatch |
| V-DO-v15-G04 | extra tamper | hash_mismatch |
| V-DO-v15-G05 | registry reference tamper | hash_mismatch |
| V-DO-v15-G06 | whole-outcome deletion | hash_mismatch |

**Domain examples 8 (government 4 + enterprise 4, extensible with industry growth)**:

| Number | Scenario | scenario |
|------|------|------|
| V-DO-v15-G07 | Government · administrative approval | gov.approval |
| V-DO-v15-G08 | Government · multi-level review | gov.review |
| V-DO-v15-G09 | Government · selection | gov.selection |
| V-DO-v15-G10 | Government · appraisal | gov.appraisal |
| V-DO-v15-G11 | Enterprise · hiring approval | corp.hiring |
| V-DO-v15-G12 | Enterprise · procurement evaluation | corp.procurement |
| V-DO-v15-G13 | Enterprise · performance rating | corp.performance |
| V-DO-v15-G14 | Enterprise · contract approval | corp.contract |

### 9.5 T-Series Time-Anchoring Vector Full List (3; fields frozen, implementation follows the signature layer)

| Number | Scenario | Expected detection (BREACH code) |
|------|------|------|
| V-DO-v15-T01 | TSA token verification (timestamp_proof complete and valid) | MATCH |
| V-DO-v15-T02 | clock drift (timestamp vs TSA-anchored time deviation exceeds threshold) | clock_drift_detected |
| V-DO-v15-T03 | key decision without time anchor (key node missing timestamp_proof) | timestamp_anchor_missing |

**T02 detection logic (`clock_drift_detected`)**: the verifier compares `DO.timestamp` against the TSA-stamped time inside `timestamp_proof.token`; a deviation > threshold (default 60s, configurable) is judged `clock_drift_detected`. The `timestamp_proof` field set is authoritative in RFC-002 §9.5 (`tsa_id`/`token`/`anchored_field`/`requested_at`).

**T03 detection logic (`timestamp_anchor_missing`)**: the verifier checks whether `timestamp_proof` exists when the decision type ∈ {DELEGATE, ESCALATE, REQUEST_HUMAN} (key decisions needing external hand-off under single-agent semantics); missing is judged `timestamp_anchor_missing`. Multi-agent collaboration key nodes (DELEGATE/HANDOFF/APPROVE) are in RFC-002 §10.

**T01 TSA-token timeliness and offline verification**: TSA tokens have timeliness (a token becomes invalid after the TSA certificate expires). The vector set runs offline (no network dependency); the TSA token MUST be a pre-generated real response with the complete TSA certificate chain embedded (tsa_id → certificate → root CA), the verifier verifies the certificate chain offline. The README declares the TSA token validity and the post-expiry degradation path (after certificate expiry, T01 is marked as a "historical verification baseline"). Prefer long-valid TSA certificates (e.g. DigiCert's free TSA, certificate validity 5–10 years).

> The T-series 3 breach codes and detection logic are frozen `[FREEZE-3]` with this section, synchronized with RFC-002 §9.5 field freezing; vector generation executes after the signature layer (V-SIGN, §10.3) lands.


## 10. Three-Layer Evidence System (Hash/Signature/TSA)

Layer 1 hash chain → Layer 2 ECDSA P-256 signature chain (unfrozen) → Layer 3 RFC 3161 TSA (fields frozen, implementation follows signature).

### 10.1 Signature Preimage Complete Definition

**Signature purpose**: to prove "who (Agent identity) signed what content", with the signature chain traceable and non-repudiable.

**The audit object of a signature-mode DO** (hash fields physically omitted):

```jsonc
"audit": {
  "mode": "signature",              // human-readable annotation + routing (tampering mode → verify fails)
  "preimage_version": "erdl-do-v1.5-hash-flat",  // domain separator (enters the preimage, prevents cross-version/cross-mode collisions)
  "previous_signature": "...",       // the previous DO's signature (signature-chain anchoring; null for the first)
  "timestamp_proof": { ... },        // TSA time anchor (optional)
  "retention": { ... },              // evidence retention period (retention_until / retention_basis)
  "chain_id": "...",                 // sub-chain identifier (= session_id, RFC-002 §8 sharding governance)
  "chain_seq": 0                     // sub-chain sequence number (0-based, monotonically increasing)
}
// hash fields audit.hash / previous_hash / commitment physically omitted (deprecated in signature mode)
// top-level signature / signing_key_id present (JURISDICTION fields)
```

**Signature preimage (the bytes covered by signature)**:

```
signature(n) = ECDSA_P256_Sign( private_key,
                                 JCS( DO(n) − signature − signing_key_id ) )
```

**Per-field pinning (enters / does not enter the signature preimage)**:

| Field | Enters preimage? | Rationale |
|------|:---:|------|
| all DO fields (incl. canonical_tree, human_oversight object, outcome, agent, policies, evaluation, context, compliance_profile, extensions) | ✅ enters | signature covers the complete decision content (incl. the extension area, echoing the flat hash's extension integrity) |
| `audit.mode` | ✅ enters | inside the audit object, signature-covered; prevents mode-tamper downgrade |
| `audit.previous_signature` | ✅ enters | signature-chain anchoring (signature(n) covers signature(n-1)) |
| `audit.timestamp_proof` | ✅ enters | time anchoring, prevents clock rollback |
| `signature` | ❌ does not | self-reference (does not exist at signing time) |
| `signing_key_id` | ❌ does not | key metadata; key rotation does not affect the signature value |

**Symmetry with the hash preimage (production-grade design verification)**:

| Mode | self-reference deletion | chain-anchor retention | audit content |
|------|-----------|-----------|-----------|
| hash | delete `audit.hash` | retain previous_hash + commitment | { hash, previous_hash, commitment, mode, preimage_version, retention, chain_id, chain_seq, timestamp_proof (optional, after TSA enabled) } |
| signature | delete `signature` | retain previous_signature | { mode, preimage_version, previous_signature, timestamp_proof, retention, chain_id, chain_seq } |

The two modes are symmetric: each deletes one self-reference field, each retains its chain-anchoring field, and the audit object enters the preimage as a whole.

**commitment structure (hash-mode-only, `[FREEZE-1]` frozen three fields)**: `{ agent_id, tool_name, decision }` — the decision-attribution snapshot (who, on what tool, made what decision), a frozen three-field structured object, entering the flat hash with the whole DO.

### 10.2 Signature-Layer Key Constraints (frozen item by item)

| # | Constraint | Frozen value |
|---|------|--------|
| 1 | Algorithm | ECDSA P-256 (FIPS 186-5) + SHA-256 |
| 2 | Signature format | Base64url |
| 3 | First record previous_signature | null (retain null into JCS, not Omit — symmetric with hash-mode previous_hash=null) |
| 4 | Signature-mode hash fields | audit.hash / previous_hash / commitment **physically omitted** (Omit, not empty values) |
| 5 | signing_key_id positioning | the verification-public-key version identifier; after key rotation, the old public key retains verification of historical DOs |
| 6 | Key management | the private key MUST be managed by KMS/HSM, plaintext storage forbidden |
| 7 | Mode exclusivity | one chain uses one mode throughout; mixed chains are judged mode_mixed_chain (§8) |
| 8 | Routing | the audit.mode field (enters the preimage; tampering breaks preimage integrity) |

### 10.3 Signature Vectors (V-SIGN)

| Number | Scenario | Expected detection |
|------|------|---------|
| V-SIGN-001 | valid signature verification | verify with the signing_key_id public key succeeds, the signature covers a complete preimage; **and carries the `risk_level=critical` compliance positive example** (critical + signature mode + signature activated & filled & verified → no breach) |
| V-SIGN-002 | tamper verify-fail | tamper any DO field → verify fails (signature mismatch) |
| V-SIGN-003 | signature-chain trace-back | trace back along previous_signature to the chain head, no break |
| V-SIGN-004 | forged signature | sign with a wrong private key → verify fails (attribution falsified) |
| V-SIGN-005 | signature canary | a regressed verifier skipping verification is caught (prevents verifier regression) |

**Signature-preimage pitfalls (must be cleared before finalization, audit-confirmed)**:

| # | Pitfall | Disposition |
|---|-----|------|
| PIT-1 | signature self-reference deletion (without it, signing is impossible) | pinned: delete signature |
| PIT-2 | signing_key_id entering the preimage would make key rotation change the signature value | pinned: delete signing_key_id |
| PIT-3 | previous_signature missing from the preimage → chain break undetectable | pinned: retain previous_signature in the preimage |
| PIT-4 | first record previous_signature=null being Omitted → genesis cross-implementation divergence | pinned: retain null into JCS |
| PIT-5 | signature mode retaining hash fields (hash/previous_hash/commitment) → byte drift | pinned: physically omit |
| PIT-6 | mode not in the preimage → mode-tamper downgrade attack | pinned: mode enters the preimage (inside audit) |

Evidence Bundle: DO chain (with signatures) + rule-set snapshot + knowledge snapshot + compliance-profile snapshot + TSA credential + verification report (hash recompute + signature verify + rule recompile triple-check).

**V-SIGN test-key declaration**: V-SIGN vectors use a **public test key pair** (private key public, for vector verification only, strictly forbidden for production signing). The vector file embeds the test public key (corresponding to signing_key_id); the README declares the test-key purpose. Real production signing uses KMS/HSM private-key management; the private key is never distributed.

**Forensic-grade claim threshold**: only after signature + TSA land and pass independent third-party verification may a forensic-grade evidence claim be made externally; before that, external claims are integrity-level + attribution-level (after the signature layer goes live).

## 11. Version Evolution (v1.3 → v1.5)

- **v1.5 increments over v1.3**: on the verified hash pipeline (JCS flat + single deletion point) basis, extend the field set (canonical_tree, knowledge-reference pointers, attachment pointers, human_oversight objectification, conclusion-layer outcome), complete the signature layer (ECDSA P-256, unfrozen) and the audit-layer vector set (78 + 8 to be added with the signature layer);
- **preimage_version constant**: v1.5 hash mode = `"erdl-do-v1.5-hash-flat"` (domain separator, §1.1); v1.3 historical vectors retain their own version identifier;
- **Version discrimination** (verifier Step 0): DO contains canonical_tree or v1.5 fields → v1.5 flat hash; otherwise → v1.3 legacy path (for historical-archive verification only);
- **Historical compatibility**: the v1.3 nested-algorithm-verified frozen AV-001..013 regression suite continues as the historical-archive verification baseline; production chains do not mix versions.

---

## Appendix A: Threat Model and Residual-Risk Statement

| # | Risk | Disposition |
|---|------|------|
| P-01 | anchored bytes do not anchor authority (provenance gap) | declared as a protocol boundary; authority borne by the deployment side; source-file signing hook left for forensic-grade deep-dive evaluation |
| P-02 | cold-storage loss | periodic evidence-bundle pre-packaging SHOULD; the cold-storage contract covers loss detection |
| P-03 | adversarial deletion indistinguishable from compliant deletion | retention governance (cold-storage contract retention_until + deletion log) as the institutional distinguishing mechanism |
| P-04 | version immutability is an external assumption | deployment-side constraint: referenced versions retained until the retention period expires |
| P-05 | record-emission fidelity: the DO may not describe the decision actually enforced — the producer's decision path and record-emission path diverge (e.g., a cache-hit path writes a different verdict); the record can be hash-perfect and internally coherent, yet false | Structural mitigation: production-side invariant (§1.4, the DO MUST be co-derived with enforcement) + producer-side conformance verification (V-PRODUCER); precedent: OWASP AST09 "Bilateral Receipt Pattern" |

---

## Acknowledgments

This specification's upgrade and update benefited from the help of the following people:

- **Christopher Hopley (chopmob-cloud / AlgoVoi)**: independent technical reviewer. In RFC-001 review, found the missing self-reference hash-exclusion rule, cross-engine string-decimal inconsistency, and layered-integrity gap, driving the establishment of the flat-hash architecture; in the v1.3 audit, reported 4 technical findings (C1–C4) + 3 security issues (S1–S3) with a clean-room RFC 8785 JCS checker, driving security hardening.
- **Erik Newton (Concordia)**: the first independent Runner implementer, proposer of the principle "neutrality is measured, not claimed"; byte-verified the audit vectors with an independent Python canonicalizer (12 byte-identical + AV-013 canary correctly failing), found the E1–E3 key issues, driving the audit-structure fix, the AV-013 canary, and the answer-file separation architecture.
- **Santosh Kumar Puppala (norviq-dev)**: raised the record-emission fidelity gap (Appendix A P-05) with a real-world PEP / cache-hit bug example; raised the P6 resolvable-set semantic ambiguity; scoped decision_divergence as a "bound, not a closure" — the three driving §1.4/§1.5/§1.6, the P-05 residual, and the P6 clarification.
- **OpenOBA reference implementation team**: the ERDL rule-engine reference implementation, the baseline for test-vector generation and verification.

The meaning of independent verification is "do not trust the tested party": independently recompute with a different tech stack from the implementation under test, eliminating the risk of "having to trust the vendor". We record and thank their contributions faithfully.

