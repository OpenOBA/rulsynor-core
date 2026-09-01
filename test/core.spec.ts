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

  // ⚠️ 版本说明：core 的 guard/buildDecisionObject 当前产出 DO v1.3 形态（23 字段），
  // 而 SPEC v2.0 权威是 DO v1.5（CORE14 + JUR15 扁平哈希）。
  // 此测试锁定 v1.3 现状；DO 升级 v1.5 是后续技术债（待 rulsynor audit 模块迁移）。
  // 2026-08-25：字段数 25 → 23 —— 移除 signature/signing_key_id 占位值
  //（'NOT_SIGNED'/'no-key-v1'），它们违反 Omit over Null 且造成合规假阳；
  // 两字段本来就不进哈希原像，故 audit.hash 不变（无兼容性破坏）。
  describe('Decision Object', () => {
    const base = () =>
      buildDecisionObject({
        input: {
          runId: 't',
          step: 0,
          toolName: 'exec',
          toolArgs: {},
          context: {},
          agentId: 'a',
          sessionId: 's',
        },
        decision: 'ALLOW',
        actionTaken: 'allowed',
        reason: 'ok',
        matchedRules: [],
        totalEvaluated: 0,
        totalMatched: 0,
        rules: [],
        evaluationDurationMs: 5,
      });

    it('23 fields（移除 signature/signing_key_id 占位值后）', () =>
      expect(Object.keys(base())).toHaveLength(23));
    it('哈希模式 MUST NOT 携带 signature/signing_key_id（禁占位值，RFC-002 §1.1/§1.3#6）', () => {
      const keys = Object.keys(base());
      expect(keys).not.toContain('signature');
      expect(keys).not.toContain('signing_key_id');
    });
    it('audit.hash format', () =>
      expect((base() as any).audit.hash).toMatch(/^sha256:[a-f0-9]{64}$/));
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
      expect(`sha256:${c.createHash('sha256').update(canonicalize(clone)).digest('hex')}`).toBe(
        stored,
      );
    });
    it('agent 8 fields', () => expect(Object.keys((base() as any).agent)).toHaveLength(8));
    it('agent.aid OID prefix', () =>
      expect((base() as any).agent.aid).toMatch(/^1\.2\.156\.3088\./));
    it('extensions []', () => expect((base() as any).extensions).toEqual([]));
  });

  describe('Compliance', () => {
    it('未配置即未选择：不猜法域/行业/风险，空值省略不置空', () => {
      const { resetComplianceProfileCache } = require('../src/compliance/index.js');
      const saved = {
        j: process.env['RULSYNOR_JURISDICTIONS'],
        i: process.env['RULSYNOR_INDUSTRIES'],
        i2: process.env['RULSYNOR_INDUSTRY'],
        r: process.env['RULSYNOR_RISK_LEVEL'],
      };
      delete process.env['RULSYNOR_JURISDICTIONS'];
      delete process.env['RULSYNOR_INDUSTRIES'];
      delete process.env['RULSYNOR_INDUSTRY'];
      delete process.env['RULSYNOR_RISK_LEVEL'];
      resetComplianceProfileCache();
      try {
        const cp = getComplianceProfile();
        expect(cp.jurisdictions).toBeUndefined();
        expect(cp.industries).toBeUndefined();
        expect(cp.risk_level).toBeUndefined();
        expect(cp.activated_fields).toBeUndefined();
        expect(cp.regulatory_references).toBeUndefined();
        expect(cp.profile_id).toBe('erdl-compliance-v1.5');
        expect(cp.profile_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      } finally {
        if (saved.j !== undefined) process.env['RULSYNOR_JURISDICTIONS'] = saved.j;
        if (saved.i !== undefined) process.env['RULSYNOR_INDUSTRIES'] = saved.i;
        if (saved.i2 !== undefined) process.env['RULSYNOR_INDUSTRY'] = saved.i2;
        if (saved.r !== undefined) process.env['RULSYNOR_RISK_LEVEL'] = saved.r;
        resetComplianceProfileCache();
      }
    });

    it('显式选择 CN → 按声明激活字段', () => {
      const { resetComplianceProfileCache } = require('../src/compliance/index.js');
      const savedJ = process.env['RULSYNOR_JURISDICTIONS'];
      process.env['RULSYNOR_JURISDICTIONS'] = 'CN';
      resetComplianceProfileCache();
      try {
        const cp = getComplianceProfile();
        expect(cp.jurisdictions).toContain('CN');
        expect(cp.activated_fields).toContain('agent.aid');
        expect(cp.industries).toBeUndefined();
      } finally {
        if (savedJ === undefined) delete process.env['RULSYNOR_JURISDICTIONS'];
        else process.env['RULSYNOR_JURISDICTIONS'] = savedJ;
        resetComplianceProfileCache();
      }
    });

    it('风险条件层：risk_level=critical → signature 强制激活（不论法域）', () => {
      const { resetComplianceProfileCache } = require('../src/compliance/index.js');
      const saved = {
        j: process.env['RULSYNOR_JURISDICTIONS'],
        r: process.env['RULSYNOR_RISK_LEVEL'],
      };
      try {
        // SG 法域本身不要求 signature，但 critical 仍须激活
        process.env['RULSYNOR_JURISDICTIONS'] = 'SG';
        process.env['RULSYNOR_RISK_LEVEL'] = 'critical';
        resetComplianceProfileCache();
        expect(getComplianceProfile().activated_fields).toContain('signature');

        // 反证：low 风险 + SG → 不激活 signature
        process.env['RULSYNOR_RISK_LEVEL'] = 'low';
        resetComplianceProfileCache();
        expect(getComplianceProfile().activated_fields).not.toContain('signature');
      } finally {
        if (saved.j === undefined) delete process.env['RULSYNOR_JURISDICTIONS'];
        else process.env['RULSYNOR_JURISDICTIONS'] = saved.j;
        if (saved.r === undefined) delete process.env['RULSYNOR_RISK_LEVEL'];
        else process.env['RULSYNOR_RISK_LEVEL'] = saved.r;
        resetComplianceProfileCache();
      }
    });
  });

  describe('AID', () => {
    it('OID format', () =>
      expect(generateAID()).toMatch(/^1\.2\.156\.3088\.1\.\d+\.\d+\.[a-f0-9]{8}$/));
  });

  describe('Provenance', () => {
    it('has license', () => expect(PROVENANCE.license).toBe('MIT'));
  });

  describe('Guidance', () => {
    const { extractNavigationGuide } = require('../src/guidance/index.js');

    it('returns navigation guide from DENY result', () => {
      const guide = extractNavigationGuide({
        matchedRules: [
          { ruleId: 'rule-deny-exec', decision: 'DENY', reason: 'Blocked dangerous command' },
        ],
        decision: 'DENY',
        reason: 'Blocked dangerous command',
      });
      expect(guide.decision).toBe('DENY');
      expect(guide.blockedReasons).toHaveLength(1);
      expect(guide.blockedReasons[0]).toContain('Blocked dangerous command');
    });

    it('extracts CORRECT guidance', () => {
      const guide = extractNavigationGuide({
        matchedRules: [
          { ruleId: 'rule-fix-path', decision: 'CORRECT', reason: 'Use relative path instead' },
        ],
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
      const result = advanceCorrectLoop(
        {
          ruleId: 'r1',
          originalToolCall: { name: 'exec', args: {} },
          correction: 'fix',
          round: 1,
          state: 'correct_round_1',
        },
        'ALLOW',
      );
      expect(result.state).toBe('correct_resolved');
      expect(result.execute).toBe(true);
    });

    it('advanceCorrectLoop escalates after round 3', () => {
      const { advanceCorrectLoop } = require('../src/preflight/guard-integration.js');
      const result = advanceCorrectLoop(
        {
          ruleId: 'r1',
          originalToolCall: { name: 'exec', args: {} },
          correction: 'fix',
          round: 3,
          state: 'correct_round_3',
        },
        'DENY',
      );
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
