# API Reference

> **Last updated: 2026-09-04 — extracted from README.md (P1 restructure); content unchanged.**

The full public API of `@openoba/rulsynor-core`: core exports, sub-paths, Decision Object fields, and environment variables. For the 7-step getting-started flow, see the [README](../README.md).

### Core (`@openoba/rulsynor-core`)

| Export | Description |
|------|------|
| `Evaluator` | Rule engine — ring-sorted, first-match-wins |
| `GuardStateManager` | Stateful `within`/`rate` counter manager |
| `ExprTreeEvaluator` | Expression-tree evaluator (34 nodes / 30 operators) |
| `safeRegExp()` | ReDoS-protected regex constructor |
| `buildDecisionObject(opts)` | Build JCS+SHA-256 Decision Object (return type: `DecisionObject`) |
| `generateAID()` | Generate Agent Identity Code (OID 1.2.156.3088) |
| `getComplianceProfile()` | Jurisdiction-aware compliance auto-configuration |
| `loadPresetRules()` | Load 34 built-in ERDL YAML rules |
| `toCompiledRules(rules)` | Convert preset rules → `CompiledRule[]` for Evaluator |
| `toERDLRuleSet(rules)` | Convert preset rules → ERDLRuleSet format |
| `extractNavigationGuide(opts)` | Structured LLM guidance from Guard decisions |
| `advanceCorrectLoop(ctx, decision)` | CORRECT loop state machine (3-round retry) |
| `runReActLoop(opts)` | Minimal ReAct loop with Guard evaluation |
| `createToolExecutor(fn)` | Wrap a function as a ToolExecutor |
| `PROVENANCE` | Version, vendor, OID prefix, known limitations |
| `SystemClock` / `VirtualClock` | Clock abstraction for temporal rule testing |
| `OpSemRegistry` | Operation semantic classifier |
| `PlanParser` | Parse LLM natural-language execution plans |

### Sub-paths

| Path | Contents |
|------|------|
| `@openoba/rulsynor-core/engine` | Evaluator, ExprTreeEvaluator, ERDLFnRegistry, PlanParser, safeRegExp, types |
| `@openoba/rulsynor-core/guard` | buildDecisionObject, generateAID, DecisionObject types |
| `@openoba/rulsynor-core/compliance` | getComplianceProfile, ComplianceProfile type, 6-framework compliance |
| `@openoba/rulsynor-core/rules` | loadPresetRules, toCompiledRules, toERDLRuleSet, PresetRule type |
| `@openoba/rulsynor-core/guidance` | extractNavigationGuide — tell the LLM how to recover |
| `@openoba/rulsynor-core/runtime` | runReActLoop, createToolExecutor |
| `@openoba/rulsynor-core/preflight` | advanceCorrectLoop, parseRequestHumanSignal, assignAbArm |

### Decision Object — CORE 14 + JURISDICTION 15 fields

**CORE fields** (always emitted, `[FREEZE-1]` frozen):

```
spec · decision_id · compliance_profile · execution_trace_id · timestamp
evaluation_duration_ms · agent { id, role, version } · context { tool.name, tool.args }
rule_set_version · policies [{ name, version, hash }] · evaluation { total_evaluated,
total_matched, matched_rules } · result { decision, decision_type, reason, rules_matched }
human_oversight · audit { previous_hash, commitment, hash }
```

**JURISDICTION fields** (emitted only when their path is in the compliance profile's
`activated_fields`; otherwise physically omitted — RFC-002 §1.1 / SPEC §5.3):

```
model_id · agent.known_limitations · fairness_assessment · impact_assessment_id
autonomy_level · data_modification_expected · context_snapshot_hash · sanitized_context
confidence_score · signature · signing_key_id · agent.aid · agent.tool_registry_hash
agent.algorithm_filing_no · agent.model_registration_id
```

### Environment Variables

| Variable | Purpose | Default |
|------|------|------|
| `RULSYNOR_JURISDICTIONS` | Comma-separated: CN,EU,US,SG,BR,IN | *(none — unselected)* |
| `RULSYNOR_INDUSTRY` | Industry for compliance | *(none — unselected)* |
| `RULSYNOR_RISK_LEVEL` | Risk tier | *(none — unselected)* |
| `RULSYNOR_AUTONOMY_LEVEL` | L1-L5 | `L2` |
| `RULSYNOR_MODEL_ID` | LLM model in DO | `unknown` |
| `RULSYNOR_AID_REGISTRAR` | Organization code in AID | `000001` |
| `RULSYNOR_AID_REQUESTER` | Department code in AID | `000001` |

## See also

- [USER-GUIDE.md](USER-GUIDE.md) — how to use rulsynor-core
- [RULE-AUTHORING.md](RULE-AUTHORING.md) — rule semantics
- [DEVELOPMENT.md](DEVELOPMENT.md) — extending the engine
