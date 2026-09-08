/**
 * buildDecisionObject unit tests — Decision Object v1.5 (RFC-002 flat-hash scheme).
 *
 * Covers the previously-untested DO emitter: CORE 14 fields, `policies[].hash`
 * preimage (RFC-002 §1.1), author_id resolution, human_oversight derivation, and
 * flat-hash recomputation. These are the guards that caught the hardcoded
 * `author_id: 'system'` and missing-author_id hash preimage bugs.
 */
import { createHash } from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import { buildDecisionObject, resetComplianceProfileCache } from '../src/index.js';
import type { DecisionObjectInput, RuleDefinition, RuleMatch } from '../src/guard/index.js';

function makeInput(overrides: Partial<DecisionObjectInput> = {}): {
  opts: DecisionObjectInput;
  rules: RuleDefinition[];
} {
  const rules: RuleDefinition[] = [
    {
      id: 'rule-1',
      name: 'SEC-001-block-rm-rf',
      when: { eq: [{ field: 'tool.name' }, 'bash'] },
      then: 'DENY',
      priority: 10,
      ring: 0,
    },
  ];
  const matchedRules: RuleMatch[] = [
    {
      ruleId: 'rule-1',
      decision: 'DENY',
      reason: 'blocked',
      ring: 0,
      canonicalTree: { eq: [{ field: 'tool.name' }, 'bash'] },
    },
  ];
  const opts: DecisionObjectInput = {
    input: {
      runId: 'run-1',
      step: 0,
      toolName: 'bash',
      toolArgs: { command: 'rm -rf /' },
      context: { tool: { name: 'bash', args: { command: 'rm -rf /' } } },
      agentId: 'guardian.agent',
      sessionId: 'session-1',
      previousAuditHash: null,
    },
    decision: 'DENY',
    actionTaken: 'blocked',
    reason: 'blocked',
    matchedRules,
    totalEvaluated: 1,
    totalMatched: 1,
    rules,
    evaluationDurationMs: 5,
    ...overrides,
  };
  return { opts, rules };
}

describe('buildDecisionObject', () => {
  beforeEach(() => {
    resetComplianceProfileCache();
    delete process.env.RULSYNOR_JURISDICTIONS;
    delete process.env.RULSYNOR_AUTHOR_ID;
    delete process.env.RULSYNOR_AUTONOMY_LEVEL;
    delete process.env.RULSYNOR_MODEL_ID;
  });

  afterEach(() => {
    resetComplianceProfileCache();
    delete process.env.RULSYNOR_JURISDICTIONS;
    delete process.env.RULSYNOR_AUTHOR_ID;
    delete process.env.RULSYNOR_AUTONOMY_LEVEL;
    delete process.env.RULSYNOR_MODEL_ID;
  });

  it('emits the CORE 14 fields', () => {
    const { opts } = makeInput();
    const do_ = buildDecisionObject(opts);

    const coreFields = [
      'spec',
      'decision_id',
      'compliance_profile',
      'execution_trace_id',
      'timestamp',
      'evaluation_duration_ms',
      'agent',
      'context',
      'rule_set_version',
      'policies',
      'evaluation',
      'result',
      'human_oversight',
      'audit',
    ];
    for (const field of coreFields) {
      expect(do_).toHaveProperty(field);
    }
    expect(do_.spec).toBe('decision-object-v1.5');
    expect(do_.audit.preimage_version).toBe('erdl-do-v1.5-hash-flat');
    expect(do_.audit.mode).toBe('hash');
  });

  it('computes policies[].hash over the RFC-002 §1.1 preimage (id/name/when/then/priority/ring/author_id)', () => {
    const { opts } = makeInput();
    const do_ = buildDecisionObject(opts);

    const policy = do_.policies[0] as Record<string, unknown>;
    const storedHash = (policy.hash as string).replace(/^sha256:/, '');

    // Recompute per RFC-002 §1.1: the preimage is the policy minus its hash.
    const preimage: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(policy)) {
      if (k !== 'hash') preimage[k] = v;
    }
    const recomputed = createHash('sha256').update(canonicalize(preimage)).digest('hex');

    expect(storedHash).toBe(recomputed);
  });

  it('includes author_id in the policy and never hardcodes "system"', () => {
    const { opts } = makeInput();
    const do_ = buildDecisionObject(opts);

    const policy = do_.policies[0] as Record<string, unknown>;
    expect(policy.author_id).toBeDefined();
    expect(policy.author_id).not.toBe('system');
  });

  it('resolves author_id: per-rule > input authorId > env > default', () => {
    // per-rule wins
    const { opts: ruleOpts } = makeInput();
    (ruleOpts.rules[0] as RuleDefinition).author_id = 'alice';
    expect((buildDecisionObject(ruleOpts).policies[0] as Record<string, unknown>).author_id).toBe(
      'alice',
    );

    // input authorId wins when the rule has none
    const { opts: inputOpts } = makeInput({ authorId: 'bob' });
    expect((buildDecisionObject(inputOpts).policies[0] as Record<string, unknown>).author_id).toBe(
      'bob',
    );

    // env wins when neither rule nor input sets it
    process.env.RULSYNOR_AUTHOR_ID = 'carol';
    const { opts: envOpts } = makeInput();
    expect((buildDecisionObject(envOpts).policies[0] as Record<string, unknown>).author_id).toBe(
      'carol',
    );
    delete process.env.RULSYNOR_AUTHOR_ID;

    // default when nothing is set
    const { opts: defaultOpts } = makeInput();
    expect(
      (buildDecisionObject(defaultOpts).policies[0] as Record<string, unknown>).author_id,
    ).toBe('openoba');
  });

  it('derives human_oversight.required for the human-in-the-loop decisions (and not for ALLOW/DENY)', () => {
    const inTheLoop = ['REQUEST_HUMAN', 'ESCALATE', 'DELEGATE'];
    const notInTheLoop = ['ALLOW', 'DENY', 'CORRECT', 'NOTIFY'];

    for (const decision of inTheLoop) {
      const { opts } = makeInput({ decision });
      expect(buildDecisionObject(opts).human_oversight.required).toBe(true);
    }
    for (const decision of notInTheLoop) {
      const { opts } = makeInput({ decision });
      expect(buildDecisionObject(opts).human_oversight.required).toBe(false);
    }
  });

  it('recomputes audit.hash via the flat-hash scheme (delete only audit.hash)', () => {
    const { opts } = makeInput();
    const do_ = buildDecisionObject(opts);

    const preimage = structuredClone(do_) as unknown as Record<string, unknown>;
    delete (preimage.audit as Record<string, unknown>).hash;
    delete preimage.signature;
    delete preimage.signing_key_id;

    const recomputed = createHash('sha256').update(canonicalize(preimage)).digest('hex');
    expect(do_.audit.hash).toBe(`sha256:${recomputed}`);
  });

  it('omits JURISDICTION fields when no jurisdiction is activated', () => {
    const { opts } = makeInput();
    const do_ = buildDecisionObject(opts);

    // With no RULSYNOR_JURISDICTIONS, no JURISDICTION fields are activated.
    expect(do_).not.toHaveProperty('model_id');
    expect(do_).not.toHaveProperty('confidence_score');
    expect(do_).not.toHaveProperty('autonomy_level');
    expect(do_.agent).not.toHaveProperty('aid');
    expect(do_.agent).not.toHaveProperty('tool_registry_hash');
  });
});
