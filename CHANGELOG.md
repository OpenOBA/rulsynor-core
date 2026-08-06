# Changelog — @rulsynor/core

## v2.0.0-alpha.1 (2026-08-06)

### First public release

**Core Engine**
- ERDL rule evaluator with 16 SafeExpr operators (eq, ne, gt, gte, lt, lte, in, not_in, contains, match, exists, starts_with, ends_with, and, or, not)
- 25-field Decision Object builder with JCS (RFC 8785) + SHA-256 cryptographic audit hash
- RuleCompiler: ERDL YAML → four parallel products (ComplianceSchema, GuidanceArtifact, GuardDirective, AuditTemplate)
- GuardStateManager with within/rate temporal tracking
- Clock abstraction (SystemClock + VirtualClock for testing)
- Shadow Mode (dual-engine evaluation via EvaluatorAdapter)
- Function registry (ERDL fn-registry with sandbox execution)

**Guard & Compliance**
- ComplianceService: 4 regulations (EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI) across 4 jurisdictions
- GB/Z 185-compliant Agent Identity Code (AID) generation
- extractNavigationGuide: DENY/CORRECT decisions → structured LLM guidance

**Preflight**
- CORRECT loop state machine (5 states, 3-round retry before escalation)
- REQUEST_HUMAN signal parser (Chinese + English patterns)
- Deterministic A/B experiment assignment
- DO Payload builder for RAG traceability

**Developer Experience**
- Playground CLI: `npx @rulsynor/core --tool=exec --cmd="rm -rf /"` shows Guard interception
- Minimal Chat Runtime: ReAct loop + Guard + Tool executor in one file
- 32 preset security rules (exec, write, http, SQL injection, SSRF, path traversal, fork bomb, etc.)

**Packaging**
- MIT License
- Zero framework dependencies (only json-canonicalize + js-yaml)
- 67 tests (SafeExpr, Evaluator, DecisionObject, Compliance, Guidance, Runtime, Preflight)
- npm package: 155 kB, 10 sub-path exports
