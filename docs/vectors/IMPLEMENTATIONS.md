# ERDL Decision Object — Independent Implementations

本注册表仅记录第三方实现者提交的验证结果。  
列入本表不代表 OpenOBA 的背书 — 仅记录"谁在什么日期通过了多少条向量"。

*This registry records only what independent implementors have measured.  
Inclusion implies no endorsement — only "who passed how many vectors on what date."*

---

## Registry

| Implementor | Method | Vectors | Date | Artifact |
|------------|--------|:-------:|------|---------|
| **Concordia (Erik Newton)** | Python, spec-only, self-built JCS | 13/13 AV | 2026-07-30 | [v1.3 submission](submissions/) |
| **OpenOBA (Clean-Room CI)** | Node.js, self-built JCS, SDK uninstalled | 63/63 DO + 12/12 AV | 2026-08-05 | [CONFORMANCE.md](conformance/CONFORMANCE.md) |

## Submission Process

1. Read [RUNNERS-GUIDE.md](docs/RUNNERS-GUIDE.md)
2. Implement JCS (RFC 8785) + SHA-256 from spec only — **no ERDL SDK**
3. Run against `decision-object-vectors-v1.3.json`
4. Compare results byte-for-byte (see `conformance/CONFORMANCE.md` for expected output)
5. Submit via PR to `submissions/` directory with:
   - Your runner's source code (linked or included)
   - A verification output file showing per-vector pass/fail
   - Method description (language, JCS library or self-built, SHA-256 library)
   - Date of verification

### Principles

- **Measurements, not endorsements**: The registry records facts. It does not certify, approve, or guarantee.
- **Spec neutrality**: Implementations are valued by their conformance to the spec text alone, not by authorship or affiliation.
- **No answers file**: Submitters must implement their own JCS canonicalizer. The answers file is never exposed to runners.
- **Clean-room preferred**: Runners that verify SDK absence before execution provide stronger independence guarantees.
