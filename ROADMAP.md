# Roadmap — @rulsynor/core

## v1.0 (Current)

- [x] ERDL rule engine with 16 SafeExpr operators
- [x] 25-field Decision Object (JCS+SHA-256 cryptographic audit)
- [x] RuleCompiler: ERDL YAML → 4-product compilation
- [x] 28 preset security rules (validated via 3-round experiment)
- [x] ComplianceService: 4 regulations × 4 jurisdictions
- [x] GB/Z 185-compatible AID generation
- [x] Guidance: extractNavigationGuide, CORRECT loop, REQUEST_HUMAN signal parser
- [x] Minimal Chat Runtime (ReAct loop + Guard + Tool)
- [x] Playground CLI (`npx @rulsynor/core`)
- [x] 76 tests (SafeExpr, Evaluator, DecisionObject, Compliance, Preflight, Guidance, Runtime)
- [x] MIT licensed. Zero framework dependencies.

## v1.1 (Planned)

- [ ] `trustLabel()` full implementation (currently stub)
- [ ] `parseToolCalls()` full implementation (currently stub)
- [ ] `task_domain` context awareness — different behavior for dev/ops/fintech contexts
- [ ] LangGraph integration example (callback/tool wrapper pattern)
- [ ] MCP server integration guide
- [ ] Custom business rule hot-reload
- [ ] OpenTelemetry / Prometheus metrics export

## v1.2 (Planned)

- [ ] Sequence-aware detection — multi-step attack patterns
- [ ] Audit chain Merkle tree (previous_hash chain verification)
- [ ] Certificate Manager integration (GB/Z 185 certificate issuance)
- [ ] Training Ground: sandbox evaluation for custom rules
- [ ] Rule marketplace: community-contributed rule packs

## v2.0 (Future)

- [ ] Multi-Agent coordination (IAGP protocol)
- [ ] Cross-session correlation (cross-task risk detection)
- [ ] Distillation engine: auto-optimize rules from audit history
- [ ] WASM runtime: embed Guard in browser/edge environments
