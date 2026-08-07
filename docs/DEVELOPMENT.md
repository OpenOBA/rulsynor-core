# Developer Guide — @rulsynor/core

> For end users writing ERDL rules, see [RULE-AUTHORING.md](./RULE-AUTHORING.md).
> For the submission workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Architecture Overview

```
                    ┌──────────────────────┐
                    │    Evaluator          │  orchestration layer
                    │  (src/engine/evaluator) │  ring sort → first-match-wins
                    └──────┬───────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ StaticRuleTree   │ │RuntimeEval   │ │ GuardStateManager │
│ ring/priority    │ │ per-condition │ │ within/rate       │
│ sort + AND/OR    │ │ operator eval │ │ counters + freeze │
└─────────────────┘ └──────────────┘ └──────────────────┘
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
                  ┌──────────────────┐
                  │  Decision Object  │
                  │  JCS + SHA-256    │
                  │  25-field audit   │
                  └──────────────────┘
```

### Three-Layer Evaluation Engine

| Layer | File | Responsibility |
|-------|------|---------------|
| **SafeExprEvaluator** | `src/engine/safe-expr.ts` | Pure expression evaluation. Each operator is a private method. Used for compile-time expression evaluation. |
| **RuntimeEvaluator** | `src/engine/runtime-evaluator.ts` | Per-condition operator evaluation at runtime. Resolves dot-notation fields, handles null propagation, uses `deepEquals`. |
| **Evaluator** | `src/engine/evaluator.ts` | Orchestration: ring-sorts rules, applies AND/OR logic, delegates stateless conditions to StaticRuleTree and temporal conditions to GuardStateManager. |

The three layers are deliberately **redundant** for safety — each implements operators independently. A bug in one layer cannot be masked by another.

### Key Design Principles

1. **Deterministic**: same input → same output. No `Date.now()` in evaluation path. No `Math.random()`. Use `VirtualClock` for time-dependent tests.
2. **First-match-wins**: rules sorted by Ring (0 first) then priority (lower first). First rule whose conditions match wins.
3. **Read-only temporal check**: `evaluate()` only reads within/rate counters — never writes. Counters are committed via `commitTemporal()` after ALLOW decisions.
4. **Preimage rules for audit hash**: `audit.hash`, `signature`, and `signing_key_id` are excluded from the JCS preimage. All other fields — including `audit.previous_hash`, `audit.commitment`, and `extensions` — participate in the hash.

---

## Project Structure

```
src/
├── index.ts                    # Public API barrel export
├── playground.ts               # CLI entry: npx @rulsynor/core
├── runtime.ts                  # Minimal ReAct loop
├── provenance.ts               # Build identity watermark
├── engine/
│   ├── index.ts                # Engine barrel
│   ├── evaluator.ts            # Rule evaluation engine
│   ├── safe-expr.ts            # Safe expression evaluator
│   ├── runtime-evaluator.ts    # Per-condition operator evaluator
│   ├── static-rule-tree.ts     # Rule sorting + condition group evaluation
│   ├── guard-state-manager.ts  # Temporal counter manager
│   ├── rule-compiler.ts        # ERDL YAML → 4-product compiler
│   ├── safe-regex.ts           # ReDoS-protected regex construction
│   ├── clock.ts                # Clock abstraction (System/Virtual)
│   ├── fn-registry.ts          # Function registry (fn extension)
│   ├── evaluator-adapter.ts    # Legacy rulsynor integration bridge
│   ├── op-sem-registry.ts      # Operation semantic classifier
│   ├── types.ts                # ATCF V2.0 interface definitions
│   ├── rule-definition.ts      # ERDL rule type definitions
│   └── rule-store.interface.ts # Rule store abstraction
├── guard/
│   └── index.ts                # buildDecisionObject + generateAID
├── compliance/
│   └── index.ts                # Jurisdiction-aware compliance profiles
├── guidance/
│   └── index.ts                # extractNavigationGuide
├── preflight/
│   ├── index.ts                # Barrel
│   ├── guard-integration.ts    # CORRECT loop, REQUEST_HUMAN parser, A/B arm
│   ├── rag-formatter.ts        # trustLabel (stub, v1.1)
│   └── tool-engine.ts          # parseToolCalls (stub, v1.1)
└── rules/
    ├── index.ts                # loadPresetRules, toCompiledRules
    ├── security.erdl.yaml      # 20 security preset rules
    ├── compliance.erdl.yaml    # 8 compliance preset rules
    └── integrity.erdl.yaml     # 1 professional ethics preset rule

test/
├── core.test.ts                # Core API + Decision Object tests
├── core-extended.test.ts       # SafeExpr/Evaluator boundary tests
├── operators.test.ts           # All 22 operators via SafeExpr + Evaluator
├── guard-state-manager.test.ts # Temporal counter tests
└── evaluator-adapter.test.ts   # Adapter conversion tests
```

---

## Local Development

### Requirements

- Node.js >= 20
- npm (no pnpm needed — package.json uses npm scripts)

### Setup

```bash
git clone https://github.com/OpenOBA/rulsynor-core.git
cd rulsynor-core
npm install
npm run build
npm test
```

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | TypeScript compile + copy rules YAML to dist/ |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run test` | Run all 100 tests |
| `npm run dev` | Watch mode (`tsc --watch`) |
| `npm run lint` | ESLint (strict rules) |
| `npm run format` | Prettier auto-fix |
| `npm run format:check` | Prettier validation |

### Debugging Tips

- **Clock injection**: Use `new GuardStateManager(new VirtualClock(t))` to control time in within/rate tests. Call `clock.advance(ms)` to simulate elapsed time.
- **State reset**: Call `stateManager.reset()` between test cases to avoid cross-test contamination.
- **Playground CLI**: `node dist/playground.js --tool=exec --cmd="rm -rf /"` for quick smoke tests.

---

## Extension Points

### Adding a New Operator

Operators must be added to **three independent engines** plus tests:

1. **`src/engine/safe-expr.ts`** — `SafeExprEvaluator`
   - Add a `case` in the `evaluate()` switch
   - Implement a private `evalXxx()` method
   - Add to `safeExprFromCondition()` if value-less (like `exists`)

2. **`src/engine/runtime-evaluator.ts`** — `evaluateCondition()`
   - Add a `case` in the operator switch
   - Handle null/undefined propagation
   - Return `false` for type mismatches (safe default)

3. **`src/engine/rule-compiler.ts`** — `RuleCompilerImpl.evaluateLeaf()`
   - Add a `case` in the `evaluateLeaf()` switch
   - Handle null/undefined propagation
   - Return `false` for unknown operators

4. **`test/operators.test.ts`** — Add tests for the new operator through both `SafeExprEvaluator` and `Evaluator`

**Example**: Adding a `regex_replace` operator:

```typescript
// safe-expr.ts
case 'regex_replace':
  return this.evalRegexReplace(args, context);

// runtime-evaluator.ts
case 'regex_replace':
  return typeof fieldValue === 'string' && typeof value === 'string'
    ? value === fieldValue.replace(safeRegExp(args[1] as string), args[2] as string)
    : false;

// rule-compiler.ts evaluateLeaf
case 'regex_replace':
  // Not applicable for compile-time decision tree — return false
  return false;
```

Operators that are **not applicable at compile time** (like `regex_replace`) should return `false` in the decision tree evaluator — they cannot be pre-computed.

### Adding a New Decision Type

1. Add to `DeriveDecisionType` union in `src/guard/index.ts`
2. Add handling in `Evaluator.evaluate()` return paths
3. Add handling in `runtime.ts` tool-execution switch
4. Add to decisions table in README
5. Add test case using the new decision type

### Adding a New Compliance Jurisdiction

1. Add entry to `REGULATORY_REFERENCES` in `src/compliance/index.ts`
2. Add field mapping in `JURISDICTION_FIELD_MAP`
3. The jurisdiction auto-activates via `RULSYNOR_JURISDICTIONS` env variable

### Modifying Decision Object Fields

**Preimage rules** (which fields participate in the audit hash):

| Action | Fields |
|--------|--------|
| **EXCLUDED from preimage** | `audit.hash`, `signature`, `signing_key_id` |
| **INCLUDED in preimage** | Everything else, including `audit.previous_hash`, `audit.commitment`, `extensions` |

Rules:
- Adding a new field: it IS included in the preimage by default. Update `buildDecisionObject()` in `src/guard/index.ts`.
- Removing a field: it breaks existing audit chains. Only allowed in major version bumps with migration documentation.
- The JCS preimage is computed in `buildDecisionObject()` lines 165-173. Do NOT alter the deletion logic without updating the audit verification test.

**Chain integrity test** (`test/core-extended.test.ts`):
```typescript
it('chain link via previous_hash', () => {
  const d1 = buildDecisionObject({...});
  const d2 = buildDecisionObject({ input: { previousAuditHash: d1.audit.hash }, ... });
  expect(d2.audit.previous_hash).toBe(d1.audit.hash);
});
```

---

## Testing Strategy

### Test Pyramid

```
     ┌─────────────┐
     │  Integration │  core.test.ts: full buildDecisionObject flow
     │   + Smoke    │  core-extended.test.ts: Evaluator boundary
     ├─────────────┤  CI smoke: playground CLI DENY assertion
     │   Engine     │  operators.test.ts: all 22 operators
     │              │  guard-state-manager.test.ts: temporal counters
     ├─────────────┤
     │    Unit      │  evaluator-adapter.test.ts: conversion functions
     └─────────────┘
```

### Testing Temporal Rules

Use `VirtualClock` and `commitTemporal()`:

```typescript
const clock = new VirtualClock(1000);
const sm = new GuardStateManager(clock);
const ev = new Evaluator(sm);

// Simulate 3 ALLOW decisions within a window
for (let i = 0; i < 3; i++) {
  ev.evaluate(ctx, rules);
  ev.commitTemporal(ctx, rules);
}

// 4th call should trigger within/rate DENY
const result = ev.evaluate(ctx, rules);
expect(result.decision).toBe('DENY');
```

### Test Naming Convention

- `it('operator_name description')` — for operator tests
- `it('scenario description')` — for evaluator boundary tests
- `it('field/behavior description')` — for Decision Object tests

---

## Build & Release

### Build Pipeline

```
src/*.ts  ──→  tsc  ──→  dist/*.js + dist/*.d.ts
src/rules/*.erdl.yaml  ──→  copy-rules.mjs  ──→  dist/rules/*.erdl.yaml
```

The `copy-rules.mjs` script copies YAML rule files from `src/rules/` to `dist/rules/` so they're available at runtime alongside compiled JS. It preserves existing tsc-compiled `.js`/`.d.ts` files.

### Release Process

1. Update version in `package.json` and `src/provenance.ts`
2. Update `CHANGELOG.md`
3. Run `npm run build && npm test` — must pass
4. Commit: `chore: release v1.x.x`
5. Tag: `git tag v1.x.x`
6. Push: `git push origin master --tags`
7. GitHub Actions `release.yml` triggers: npm publish + GitHub Release
