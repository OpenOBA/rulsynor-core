# Good First Issues — @openoba/rulsynor-core

New to the project? Start here. These are tasks designed to help you learn the codebase
while making a real contribution. No prior ERDL knowledge needed.

## How to Pick an Issue

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) — setup, build, test, PR workflow
2. Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — architecture overview
3. Pick an issue below, comment on it, and start coding

---

## 🟢 Beginner: no engine changes needed

| # | Issue | Work | Time |
|---|-------|------|:---:|
| 1 | **Add a preset rule** | Write a new `.erdl.yaml` rule in `src/rules/` and validate it with `npx tsx examples/agent-demo.ts` | 1h |
| 2 | **Add a code example** | Show rulsynor-core integrated with a new framework (e.g. CrewAI, AutoGen, Vercel AI SDK) in `examples/` | 2h |
| 3 | **Write a test for an existing module** | Pick a file without direct test coverage (e.g. `src/engine/op-sem-registry.ts`) and add `test/op-sem-registry.test.ts` | 2h |
| 4 | **Improve error messages** | Find unclear error messages in `src/` and make them more helpful | 1h |
| 5 | **Add JSDoc to public API** | Add `@param` and `@returns` to exported functions in `src/index.ts` | 1h |
| 6 | **Write a RULE-AUTHORING recipe** | Add a new "Rule Pattern" to [docs/RULE-AUTHORING.md](docs/RULE-AUTHORING.md) — show how to solve a real-world problem with ERDL | 1h |
| 7 | **Translate docs** | Help improve the Chinese README or translate `docs/` files to another language | 2h |

## 🟡 Intermediate: engine extension

| # | Issue | Work | Time |
|---|-------|------|:---:|
| 8 | **Add an operator** | Follow the [Adding a New Operator](docs/DEVELOPMENT.md#adding-a-new-operator) guide — 3 engines + tests | 4h |
| 9 | **Add a compliance jurisdiction** | Add a new jurisdiction (e.g. Singapore PDPA, Japan APPI) to `src/compliance/index.ts` + test | 2h |
| 10 | **Fix an edge case** | Browse open issues labeled `bug` and pick one | varies |

## 🏷️ Issue Labels on GitHub

When creating or picking issues, use these labels:

| Label | Meaning |
|-------|---------|
| `good first issue` | Beginner-friendly, well-defined scope |
| `help wanted` | Needs community contribution |
| `documentation` | Docs-only change |
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |

## Need Help?

Open a [GitHub Discussion](https://github.com/OpenOBA/rulsynor-core/discussions) or tag `@haoran-tang-ch` on your issue.
