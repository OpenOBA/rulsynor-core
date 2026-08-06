# Contributing to @rulsynor/core

Thanks for your interest in contributing. Rulsynor is an open-source project and we welcome improvements.

## Getting Started

```bash
git clone https://github.com/OpenOBA/rulsynor-core.git
cd rulsynor-core
npm install
npm run build
npm test
```

## Development Workflow

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure `npm run build` passes (0 errors)
5. Ensure `npm test` passes (all tests green)
6. Commit with descriptive messages
7. Push and open a Pull Request

## Code Standards

- TypeScript strict mode is enforced. No `@ts-ignore`, no `as any` without comment.
- Run `npx tsc --noUnusedLocals --noUnusedParameters` before committing.
- New public APIs must be exported from `src/index.ts` and added to `package.json` `exports` field.
- New operators must be added to all three engines: `SafeExprEvaluator`, `RuntimeEvaluator`, and the RuleCompiler DFA evaluator.

## Testing

- Unit tests: `npm test` (Jest)
- Test files go in `test/`
- New features must include tests
- Rule changes must include behavior regression tests (verify the rule actually triggers)

## Adding Rules

Add `.erdl.yaml` files to `src/rules/`. Use YAML multi-document format (`---` separator) for multiple rules per file.

### Operator Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `value: "exec"` |
| `ne` / `neq` | Not equal | `value: "read"` |
| `gt` / `gte` / `lt` / `lte` | Numeric compare | `value: 5000` |
| `in` / `not_in` | Array membership | `value: ["a","b"]` |
| `contains` / `not_contains` | Substring | `value: "DROP TABLE"` |
| `match` / `matches` | Regex | `value: "^rm\\s+-rf"` |
| `exists` / `not_exists` | Field presence | — |
| `starts_with` / `ends_with` | Prefix/suffix | `value: "/etc/"` |
| `length_gt` / `length_gte` / `length_lt` / `length_lte` / `length_eq` | String/array length | `value: 10485760` |

## Commit Convention

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `test:` — tests
- `chore:` — maintenance
- `refactor:` — code restructuring

## Questions

Open an issue on GitHub: https://github.com/OpenOBA/rulsynor-core/issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
