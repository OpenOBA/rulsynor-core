# Changelog — @openoba/rulsynor-core

## v1.0.0 (2026-08-07)

### First public release

**Core Engine**
- ERDL rule evaluator with 20 operators (eq, neq, gt, gte, lt, lte, in, not_in, contains, not_contains, match/matches, starts_with, ends_with, exists, not_exists, length_gt/gte/lt/lte/eq)
- 25-field Decision Object builder with JCS (RFC 8785) + SHA-256 cryptographic audit hash
- RuleCompiler: ERDL YAML -> four parallel products (ComplianceSchema, GuidanceArtifact, GuardDirective, AuditTemplate)
- GuardStateManager with within/rate temporal tracking + hot-reload freeze migration
- Clock abstraction (SystemClock + VirtualClock for testing)
- EvaluatorAdapter for legacy rulsynor integration
- Function registry (ERDL fn-registry with sandbox execution + timeout protection)
- SafeRegExp: ReDoS-protected regex construction (nested quantifier detection + length cap)

**Guard & Compliance**
- ComplianceService: 4 regulations (EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI) across 4 jurisdictions
- GB/Z 185-compliant Agent Identity Code (AID) generation
- extractNavigationGuide: DENY/CORRECT decisions -> structured LLM guidance with corrections + alternatives

**Preflight**
- CORRECT loop state machine (5 states, 3-round retry before escalation)
- REQUEST_HUMAN signal parser (Chinese + English patterns, anchored for injection safety)
- Deterministic A/B experiment assignment
- DO Payload builder for RAG traceability

**Developer Experience**
- Playground CLI: `npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"` shows Guard interception
- Minimal Chat Runtime: ReAct loop + Guard + Tool executor in one file
- 29 preset rules (20 security + 8 compliance + 1 integrity)
- integrity.erdl.yaml: professional ethics detection (promise vs action, no cover-up, transparency)

**Documentation**
- Bilingual README (EN + CN) with executable code examples
- Spec documents bundled: ERDL Spec v1.1 + RFC 001 Decision Object v1.3
- Full legal suite: LICENSE (MIT), SECURITY, CODE_OF_CONDUCT, GOVERNANCE, PRIVACY-POLICY, TRADEMARK

**Packaging**
- MIT License
- Zero framework dependencies (only json-canonicalize + js-yaml)
- 100 tests (SafeExpr, Evaluator, DecisionObject, Compliance, Guidance, Runtime, Preflight)
- npm package: 10 sub-path exports (engine, guard, compliance, rules, guidance, runtime, preflight, playground, provenance)
