# Security Policy — @rulsynor/core

## Design Principles

@rulsynor/core is a **deterministic Guard engine** — every tool call is intercepted BEFORE execution, evaluated against ERDL rules, and documented with cryptographically verifiable audit evidence.

### 1. Prompt-based safety is not safety

LLM prompt constraints ("please don't do X") are not security boundaries. @rulsynor/core evaluates tool calls using a **deterministic expression engine** (SafeExpr) — not LLM prompts.

### 2. Zero code injection surface

SafeExpr is a **pure recursive descent parser** with 16 whitelisted operators. No `eval()`. No dynamic code generation. Every operator is a hardcoded function.

### 3. Cryptographic audit trail

Every Decision Object carries `audit.hash = SHA-256(JCS(all 25 fields minus audit.hash, signature, signing_key_id))`. Tampering with any field changes the hash. The vector set (erdl-vectors v1.3) provides 101 cross-implementation test vectors for independent verification.

### 4. Cross-implementation verifiable

Any third party can verify a Decision Object using only RFC 8785 (JCS) + SHA-256. The `@openoba/audit-verify` CLI provides a zero-dependency reference implementation. No Rulsynor SDK required.

## Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| Decision Object signature is placeholder (`NOT_SIGNED`) | DOs are not cryptographically signed | ECDSA signing planned for Phase 2 |
| AID is self-generated (OID prefix 1.2.156.3088) | Not registered with external authority | Registration planned for production |
| trustLabel returns static placeholder | RAG trust labels not functional | Implementation planned for v2.1 |
| No rate limiting on Guard evaluation itself | DoS via rapid tool calls | Handled by rulsynor server layer (NestJS ThrottlerModule) |
| No built-in key rotation | Signing key management not implemented | Phase 2 |

## Reporting a Vulnerability

Email: support@openoba.com

We aim to respond within 48 hours.

## Third-Party Audit

A formal independent security audit has not yet been conducted. We welcome security researchers to audit the codebase, particularly:

- SafeExpr expression parser for injection vulnerabilities
- JCS (RFC 8785) serializer for canonicalization edge cases  
- Decision Object hash preimage for hash length extension attacks
- RuleCompiler for rule injection/evasion

## Dependencies

| Dependency | Version | Purpose | Audit |
|-----------|---------|---------|-------|
| json-canonicalize | ^1.0.0 | JCS (RFC 8785) serialization | npm package, MIT |
| js-yaml | ^4.1.0 | ERDL rule YAML parsing | npm package, MIT |

No other runtime dependencies.

## Build Integrity

- TypeScript strict mode enabled
- Zero `@ts-ignore` directives
- Zero unused imports/locals (tsc --noUnusedLocals --noUnusedParameters)
- 67 automated tests covering SafeExpr (16 operators), Evaluator (rule matching), Decision Object (tamper detection), Compliance, Guidance, Runtime, Preflight
