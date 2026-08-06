# @rulsynor/core

> **LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity.**
>
> Trillion-parameter LLMs have made raw intelligence a commodity. But an unsupervised genius can destroy everything you've built.

```bash
npm install @rulsynor/core
```

## Integrity: The Missing Dimension

No company would hire an employee with a flawed character. No company would deploy an untrained worker directly into operations.

Yet when it comes to AI Agents, this iron rule has somehow been forgotten.

AI models in 2026 are terrifyingly smart. GPT, Claude, Qwen â€?they can write in 30 seconds what takes you three days. They can analyze in milliseconds what takes a team weeks. But they have no professional integrity. An Agent without integrity is a ticking bomb. It will delete your production database at 3 AM because of an ambiguous instruction. It will log customer PII into a public file.

**Not because it's malicious. Because it was never trained.**

Rulsynor brings the HR discipline of human character to AI â€?not just a safety tool, but the foundational governance layer for enterprise intelligence resources.

From training, certification, compliance, audit, to continuous evolution â€?rulsynor delivers the full lifecycle governance stack for AI in enterprise.

```
Hire â”€â”€â†?Train â”€â”€â†?Certify â”€â”€â†?Badge â”€â”€â†?Deploy â”€â”€â†?Record every action â”€â”€â†?Correct mistakes â”€â”€â†?Build reputation â”€â”€â†?Annual audit
```

This is not a "safety interceptor." This is **infrastructure for professional conduct.**

A real employee:
- Gets trained before their first day (not just told "don't mess up")
- Passes certification before getting a badge (not just "it runs")
- Has every action recorded (not logs â€?cryptographic, tamper-evident, third-party verifiable records)
- Gets told *why* they were wrong and *how* to fix it (not just "DENY")
- Builds a track record over time (getting more reliable with experience)

This is what rulsynor injects into an Agent.

## See an Agent With Integrity in 30 Seconds

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
ðŸ“‹ Trained:    28 rules loaded
ðŸ›¡ï¸? Decision:   DENY
ðŸ“ Reason:     Destructive command blocked. Use safe alternatives or request human approval.
ðŸ§¾ Recorded:   sha256:18ce857657f61beff08ac0ffc8f6cb09a7e64cb0c0c772f1a55c02dccaa1e882 (tamper-evident)
ðŸªª Employee ID: 1.2.156.3088.1.000001.000001.28027273
ðŸ“Š Jurisdiction: CN (GB/Z 185-2026 compliant)
ðŸ§­ Alternative: Use the read tool to inspect the target first, or request explicit human approval before any destructive command.
```

**Not "no." â€?"Not like this. But here's how."**

## 10 Lines to Give Your Agent a Professional Baseline

```typescript
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
} from '@rulsynor/core';

// Train: compile the bundled preset rules into the shape the engine consumes.
const rules = toCompiledRules(loadPresetRules());

// Deploy: evaluate the tool call *before* it runs.
const evaluator = new Evaluator(new GuardStateManager());
const decision = evaluator.evaluate(
  {
    toolName: 'exec',
    toolArgs: { command: 'rm -rf /' },
    sessionId: 's1',
    agentId: 'my-agent',
  },
  rules,
);

// Record: build a tamper-evident Decision Object.
const record = buildDecisionObject({
  input: {
    runId: 'r1',
    step: 0,
    toolName: 'exec',
    toolArgs: { command: 'rm -rf /' },
    context: {},
    agentId: 'my-agent',
    sessionId: 's1',
  },
  decision: decision.decision,
  actionTaken: decision.decision === 'DENY' ? 'blocked' : 'allowed',
  reason: decision.reason,
  matchedRules: decision.matchedRuleId
    ? [{ ruleId: decision.matchedRuleId, decision: decision.decision, reason: decision.reason }]
    : [],
  totalEvaluated: rules.length,
  totalMatched: decision.matchedRuleId ? 1 : 0,
  rules: rules.map((r) => ({ name: r.name, version: 1 })),
  evaluationDurationMs: 0,
});

console.log(decision.decision);          // â†?DENY (has boundaries)
console.log(record.audit.hash);          // â†?sha256:... (has proof)
console.log(record.agent.aid);           // â†?1.2.156.3088.1... (has credentials)
```

## The Infrastructure of Professional Integrity

| Human Professionalism | Mapped to Agent |
|------|------|
| Onboarding training | **32 preset rules + YAML custom business rules** â€?hard constraints compiled into the engine, not a "please behave" note in a prompt |
| Certified and badged | **Agent Identity Code (AID)** â€?customizable identity system, compatible with GB/Z 185 OID format. Enterprises define their own namespace or reference third-party certificate authorities |
| Documented actions | **JCS+SHA-256 cryptographic audit records** â€?25-field Decision Object. Tamper with it, and the hash breaks. Third-party verifiable with no SDK |
| Learns from mistakes | **CORRECT feedback loop + Navigation Guide** â€?DENY is not the end. Tells the Agent why, how to fix, and what alternative to use. 3 auto-retry rounds before escalating to a human |
| Regulatory awareness | **4 regulations Ã— 4 jurisdictions** â€?EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI. Jurisdiction-aware, auto-activated compliance fields |
| Career record | **Audit hash chain** â€?every action linked by previous_hash, forming an immutable professional history |

## LLMs Deliver Intelligence. We Deliver Integrity.

Every Agent framework on the market does one thing: let LLMs do more.

We don't care what your Agent *can* do. We care what it *shouldn't* do â€?and whether everything it *did* do is provable.

This is not a feature difference. This is a values difference.

## Get Started

```bash
npm install @rulsynor/core
```

If your Agent needs professional boundaries, needs credentials, needs every action to leave an immutable audit trail â€?this is what you're looking for.

## License

MIT Â© 2026 OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

> "LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity."

---

[OpenOBA](https://openoba.com) â€?Enterprise AI Digital Executor Platform
