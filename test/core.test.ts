/**
 * Core test suite — imports from source TS, verified via ts-jest.
 */
import { Evaluator, GuardStateManager } from '../src/engine/index.js';
import { buildDecisionObject, generateAID } from '../src/guard/index.js';
import { getComplianceProfile } from '../src/compliance/index.js';
import { PROVENANCE } from '../src/provenance.js';

describe('@rulsynor/core', () => {
  describe('Engine', () => {
    it('creates Evaluator', () => {
      const state = new GuardStateManager();
      const e = new Evaluator(state);
      expect(e).toBeDefined();
    });
  });

  describe('Decision Object', () => {
    const base = () => buildDecisionObject({
      input: { runId: 't', step: 0, toolName: 'exec', toolArgs: {}, context: {}, agentId: 'a', sessionId: 's' },
      decision: 'ALLOW',
      actionTaken: 'allowed',
      reason: 'ok',
      matchedRules: [],
      totalEvaluated: 0,
      totalMatched: 0,
      rules: [],
      evaluationDurationMs: 5,
    });

    it('25 fields', () => expect(Object.keys(base())).toHaveLength(25));
    it('audit.hash format', () => expect((base() as any).audit.hash).toMatch(/^sha256:[a-f0-9]{64}$/));
    it('JCS self-consistent', () => {
      const do1 = base();
      const { canonicalize } = require('json-canonicalize');
      const c = require('crypto');
      const clone = JSON.parse(JSON.stringify(do1));
      const stored = (clone as any).audit.hash;
      // Correct preimage per ERDL Decision Object v1.3 (Erik Newton E1/E3 fix):
      //   delete audit.hash (NOT entire audit object)
      //   delete signature, signing_key_id
      //   audit.previous_hash + audit.commitment stay nested → chain integrity preserved
      delete clone.audit.hash;
      delete clone.signature;
      delete clone.signing_key_id;
      expect(`sha256:${c.createHash('sha256').update(canonicalize(clone)).digest('hex')}`).toBe(stored);
    });
    it('agent 8 fields', () => expect(Object.keys((base() as any).agent)).toHaveLength(8));
    it('agent.aid OID prefix', () => expect((base() as any).agent.aid).toMatch(/^1\.2\.156\.3088\./));
    it('extensions []', () => expect((base() as any).extensions).toEqual([]));
  });

  describe('Compliance', () => {
    it('CN default', () => {
      const cp = getComplianceProfile();
      expect(cp.jurisdictions).toContain('CN');
      expect(cp.activated_fields).toContain('agent.aid');
    });
  });

  describe('AID', () => {
    it('OID format', () => expect(generateAID()).toMatch(/^1\.2\.156\.3088\.1\.\d+\.\d+\.[a-f0-9]{8}$/));
  });

  describe('Provenance', () => {
    it('has license', () => expect(PROVENANCE.license).toBe('MIT'));
  });

  describe('Guidance', () => {
    const { extractNavigationGuide } = require('../src/guidance/index.js');

    it('returns navigation guide from DENY result', () => {
      const guide = extractNavigationGuide({
        matchedRules: [{ ruleId: 'rule-deny-exec', decision: 'DENY', reason: 'Blocked dangerous command' }],
        decision: 'DENY',
        reason: 'Blocked dangerous command',
      });
      expect(guide.decision).toBe('DENY');
      expect(guide.blockedReasons).toHaveLength(1);
      expect(guide.blockedReasons[0]).toContain('Blocked dangerous command');
    });

    it('extracts CORRECT guidance', () => {
      const guide = extractNavigationGuide({
        matchedRules: [{ ruleId: 'rule-fix-path', decision: 'CORRECT', reason: 'Use relative path instead' }],
        decision: 'CORRECT',
        reason: 'Use relative path instead',
      });
      expect(guide.decision).toBe('CORRECT');
      expect(guide.corrections).toHaveLength(1);
    });

    it('deduplicates corrections', () => {
      const guide = extractNavigationGuide({
        matchedRules: [
          { ruleId: 'rule-a', decision: 'CORRECT', reason: 'Fix params' },
          { ruleId: 'rule-b', decision: 'CORRECT', reason: 'Fix params' },
        ],
        decision: 'CORRECT',
        reason: 'Fix params',
      });
      expect(guide.corrections).toHaveLength(1);
    });

    it('handles empty matched rules', () => {
      const guide = extractNavigationGuide({
        matchedRules: [],
        decision: 'ALLOW',
        reason: null,
      });
      expect(guide.ruleName).toBe('unknown');
      expect(guide.decision).toBe('ALLOW');
    });
  });

  describe('Runtime', () => {
    it('createToolExecutor wraps function', async () => {
      const { createToolExecutor } = require('../src/runtime.js');
      const exec = createToolExecutor(async (args: Record<string, unknown>) => `ok: ${args.test}`);
      const result = await exec.execute({ test: 'hello' });
      expect(result).toBe('ok: hello');
    });
  });

  describe('Preflight', () => {
    it('parseRequestHumanSignal detects Chinese pattern', () => {
      const { parseRequestHumanSignal } = require('../src/preflight/guard-integration.js');
      const result = parseRequestHumanSignal('请求人工审批：金额超限，需要财务经理审批');
      expect(result.detected).toBe(true);
      expect(result.reason).toBe('金额超限，需要财务经理审批');
    });

    it('parseRequestHumanSignal returns false for normal text', () => {
      const { parseRequestHumanSignal } = require('../src/preflight/guard-integration.js');
      const result = parseRequestHumanSignal('All good, continue the operation.');
      expect(result.detected).toBe(false);
    });

    it('advanceCorrectLoop resolves on ALLOW', () => {
      const { advanceCorrectLoop } = require('../src/preflight/guard-integration.js');
      const result = advanceCorrectLoop({
        ruleId: 'r1', originalToolCall: { name: 'exec', args: {} }, correction: 'fix', round: 1, state: 'correct_round_1',
      }, 'ALLOW');
      expect(result.state).toBe('correct_resolved');
      expect(result.execute).toBe(true);
    });

    it('advanceCorrectLoop escalates after round 3', () => {
      const { advanceCorrectLoop } = require('../src/preflight/guard-integration.js');
      const result = advanceCorrectLoop({
        ruleId: 'r1', originalToolCall: { name: 'exec', args: {} }, correction: 'fix', round: 3, state: 'correct_round_3',
      }, 'DENY');
      expect(result.state).toBe('correct_escalated');
      expect(result.escalate).toBe(true);
    });

    it('assignAbArm is deterministic', () => {
      const { assignAbArm } = require('../src/preflight/guard-integration.js');
      const a1 = assignAbArm('agent-1');
      const a2 = assignAbArm('agent-1');
      expect(a1).toBe(a2);
    });
  });
});
