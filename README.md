# @rulsynor/core

> **LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity.**
>
> You can hire a genius. Would you give them the keys to your company safe?

```bash
npm install @rulsynor/core
```

## Intelligence ≠ Integrity

AI models in 2026 are terrifyingly smart. GPT, Claude, Qwen — they can write in 30 seconds what takes you three days. They can analyze in milliseconds what takes a team weeks.

But they have no professional integrity.

An Agent without integrity is a ticking bomb. It will delete your production database at 3 AM because of an ambiguous instruction. It will log customer PII into a public file. It will take the most dangerous path when told to "just handle it" — because it doesn't know that path is off-limits.

**Not because it's malicious. Because it was never trained.**

## Give Your Agent a Conscience

What rulsynor does is fundamentally simple: it gives digital employees professional integrity.

```
Hire ──→ Train ──→ Certify ──→ Badge ──→ Deploy ──→ Record every action ──→ Correct mistakes ──→ Build reputation ──→ Annual audit
```

This is not a "safety interceptor." This is **infrastructure for professional conduct.**

A real employee:
- Gets trained before their first day (not just told "don't mess up")
- Passes certification before getting a badge (not just "it runs")
- Has every action recorded (not logs — cryptographic, tamper-evident, third-party verifiable records)
- Gets told *why* they were wrong and *how* to fix it (not just "DENY")
- Builds a track record over time (getting more reliable with experience)

This is what rulsynor injects into an Agent.

## See an Agent With Integrity in 30 Seconds

```bash
npx @rulsynor/core --tool=exec --cmd="rm -rf /"
```

```
📋 Trained: 32 rules loaded
🛡️ Decision: DENY
📝 Reason: Dangerous command. Not your fault — this command should never run.
🧾 Recorded: sha256:d72a... (tamper-evident)
🪪 Employee ID: 1.2.156.3088.1.000001.000001.7521ba66
📊 Jurisdiction: CN (GB/Z 185-2026 compliant)
🧭 Alternative: Use the read tool instead — safer, and gets you what you need.
```

**Not "no." — "Not like this. But here's how."**

## 10 Lines to Give Your Agent a Professional Baseline

```typescript
import { Evaluator, GuardStateManager, buildDecisionObject, loadPresetRules, toERDLRuleSet } from '@rulsynor/core';

// Train
const rules = toERDLRuleSet(loadPresetRules());

// Deploy
const evaluator = new Evaluator(new GuardStateManager());
const decision = evaluator.evaluate(rules, {
  toolName: 'exec', toolArgs: { command: 'rm -rf /' },
  sessionId: 's1', agentId: 'my-agent',
});

// Record
const record = buildDecisionObject({
  input: { runId: 'r1', step: 0, toolName: 'exec', toolArgs: { command: 'rm -rf /' },
           context: {}, agentId: 'my-agent', sessionId: 's1' },
  decision: decision.decision, actionTaken: 'blocked', reason: decision.reason,
  matchedRules: [], totalEvaluated: 1, totalMatched: 0,
  rules: [], evaluationDurationMs: 5,
});

console.log(decision);           // → DENY (has boundaries)
console.log(record.audit.hash);  // → sha256:a1b2c3... (has proof)
console.log(record.agent.aid);   // → 1.2.156.3088.1... (has credentials)
```

## The Infrastructure of Professional Integrity

| Human Professionalism | Mapped to Agent |
|------|------|
| Onboarding training | **32 preset rules + YAML custom business rules** — hard constraints compiled into the engine, not a "please behave" note in a prompt |
| Certified and badged | **GB/Z 185 standard Agent Identity Code** — unique, verifiable employee ID |
| Documented actions | **JCS+SHA-256 cryptographic audit records** — 25-field Decision Object. Tamper with it, and the hash breaks. Third-party verifiable with no SDK |
| Learns from mistakes | **CORRECT feedback loop + Navigation Guide** — DENY is not the end. Tells the Agent why, how to fix, and what alternative to use. 3 auto-retry rounds before escalating to a human |
| Regulatory awareness | **4 regulations × 4 jurisdictions** — EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI. Jurisdiction-aware, auto-activated compliance fields |
| Career record | **Audit hash chain** — every action linked by previous_hash, forming an immutable professional history |

## LLMs Deliver Intelligence. We Deliver Integrity.

Every Agent framework on the market does one thing: let LLMs do more.

We don't care what your Agent *can* do. We care what it *shouldn't* do — and whether everything it *did* do is provable.

This is not a feature difference. This is a values difference.

## Get Started

```bash
npm install @rulsynor/core
```

If your Agent needs professional boundaries, needs credentials, needs every action to leave an immutable audit trail — this is what you're looking for.

## License

MIT © 2026 OpenOBA ([Shenzhen Miaojing Technology Co., Ltd.](https://openoba.com))

> "LLM vendors deliver exceptional intelligence. We deliver employees with professional integrity."

---

[OpenOBA](https://openoba.com) — Enterprise AI Digital Executor Platform
