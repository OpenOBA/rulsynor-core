/* eslint-disable @typescript-eslint/no-explicit-any */
import { Evaluator } from '../../src/engine/evaluator.js';
import type { RuleDefinition } from '../../src/engine/rule-definition.js';

const evaluator = new Evaluator();

function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'TEST-001',
    name: 'Test Rule',
    description: 'A test rule',
    category: 'custom',
    conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
    conditionLogic: 'AND',
    action: { decision: 'DENY', reason: 'Test block' },
    priority: 100,
    enabled: true,
    ...overrides,
  };
}

describe('ERDL Evaluator  — Core decisions', () => {
  it('PASS when no rules match', () => {
    const result = evaluator.evaluate([], { 'tool.name': 'read_file' });
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedRules).toHaveLength(0);
  });

  it('DENY when a rule matches', () => {
    const rules = [makeRule()];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });

  it('ALLOW when rule action is ALLOW', () => {
    const rules = [makeRule({ action: { decision: 'ALLOW' } })];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('ALLOW');
  });

  it('REQUEST_HUMAN when rule action is REQUEST_HUMAN', () => {
    const rules = [
      makeRule({
        conditions: [
          { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'write_file' },
        ],
        conditionLogic: 'OR',
        action: { decision: 'REQUEST_HUMAN', reason: 'Approval needed' },
      }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'write_file' });
    expect(result.decision).toBe('REQUEST_HUMAN');
  });

  it('disabled rules are skipped', () => {
    const rules = [makeRule({ enabled: false, action: { decision: 'DENY', reason: 'Skipped' } })];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('ALLOW');
  });

  it('reports totalEvaluated and totalMatched', () => {
    // SPEC v1.1 DO-010: DENY does NOT short-circuit   all rules evaluated
    const rules = [
      makeRule({ id: 'R1', name: 'r1', action: { decision: 'ALLOW' } }),
      makeRule({ id: 'R2', name: 'r2', action: { decision: 'DENY', reason: 'no' }, priority: 1 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    // R2 DENY (pri=1) evaluates first   DENY. R1 ALLOW (pri=default) after DENY,
    // non-override   popped (DO-011: ALLOW cannot override DENY without override flag)
    expect(result.totalEvaluated).toBe(2);
    expect(result.totalMatched).toBe(1); // only DENY matched; ALLOW after DENY popped
    expect(result.decision).toBe('DENY');
  });
});

describe('ERDL Evaluator  — Execution Rings', () => {
  it('Ring 0 DENY short-circuits all higher rings', () => {
    const rules = [
      makeRule({
        id: 'R0',
        action: { decision: 'DENY', ring: 0, reason: 'Ring 0 block' },
        priority: 1,
      }),
      makeRule({ id: 'R3', action: { decision: 'ALLOW', ring: 3 }, priority: 100 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
    expect(result.primaryReason).toBe('Ring 0 block');
  });

  it('Ring 0 EMERGENCY_HALT short-circuits immediately', () => {
    const rules = [
      makeRule({
        id: 'R0',
        action: { decision: 'EMERGENCY_HALT', ring: 0, reason: 'halt' },
        priority: 1,
      }),
      makeRule({ id: 'R1', action: { decision: 'ALLOW', ring: 1 }, priority: 1 }),
      makeRule({ id: 'R2', action: { decision: 'ALLOW', ring: 2 }, priority: 1 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('EMERGENCY_HALT');
  });

  it('Higher ring rules evaluate when lower ring has only ALLOW', () => {
    const rules = [
      makeRule({ id: 'R0', action: { decision: 'ALLOW', ring: 0 } }),
      makeRule({ id: 'R1', action: { decision: 'DENY', ring: 1, reason: 'Ring 1 block' } }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
    expect(result.primaryReason).toBe('Ring 1 block');
  });

  it('Within same ring, lower priority wins', () => {
    const rules = [
      makeRule({ id: 'hi', action: { decision: 'ALLOW' }, priority: 10 }),
      makeRule({ id: 'lo', action: { decision: 'DENY', reason: 'block' }, priority: 5 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY'); // priority 5 < 10, evaluated first
  });

  it('ALLOW + DENY in same ring: DENY wins', () => {
    const rules = [
      makeRule({ id: 'allow', action: { decision: 'ALLOW' }, priority: 1 }),
      makeRule({ id: 'deny', action: { decision: 'DENY', reason: 'block' }, priority: 2 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });
});

describe('ERDL Evaluator  — Condition operators', () => {
  it('eq matches exact value', () => {
    const r = makeRule({
      conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
    });
    expect(evaluator.evaluate([r], { 'tool.name': 'exec' }).decision).toBe('DENY');
    expect(evaluator.evaluate([r], { 'tool.name': 'read' }).decision).toBe('ALLOW');
  });

  it('ne matches non-equal', () => {
    const r = makeRule({
      conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'ne', value: 'exec' }],
    });
    expect(evaluator.evaluate([r], { 'tool.name': 'read' }).decision).toBe('DENY');
  });

  it('in matches array membership', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.name', operator: 'in', value: ['exec', 'bash'] },
      ],
    });
    expect(evaluator.evaluate([r], { 'tool.name': 'bash' }).decision).toBe('DENY');
    expect(evaluator.evaluate([r], { 'tool.name': 'search' }).decision).toBe('ALLOW');
  });

  it('not_in rejects array membership', () => {
    const r = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'not_in',
          value: ['exec', 'bash'],
        },
      ],
      action: { decision: 'ALLOW' },
    });
    expect(evaluator.evaluate([r], { 'tool.name': 'search' }).decision).toBe('ALLOW');
    expect(evaluator.evaluate([r], { 'tool.name': 'exec' }).decision).toBe('ALLOW');
  });

  it('contains matches substring', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.args.command', operator: 'contains', value: 'rm' },
      ],
    });
    expect(evaluator.evaluate([r], { 'tool.args.command': 'rm -rf /' }).decision).toBe('DENY');
    expect(evaluator.evaluate([r], { 'tool.args.command': 'ls -la' }).decision).toBe('ALLOW');
  });

  it('not_contains rejects substring', () => {
    const r = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.args.command',
          operator: 'not_contains',
          value: 'safe',
        },
      ],
      action: { decision: 'ALLOW' },
    });
    expect(evaluator.evaluate([r], { 'tool.args.command': 'dangerous' }).decision).toBe('ALLOW');
  });

  it('match supports regex', () => {
    const r = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.args.command',
          operator: 'match',
          value: '^git\\s+push.*--force',
        },
      ],
    });
    expect(
      evaluator.evaluate([r], { 'tool.args.command': 'git push origin main --force' }).decision,
    ).toBe('DENY');
    expect(evaluator.evaluate([r], { 'tool.args.command': 'git push origin main' }).decision).toBe(
      'ALLOW',
    );
  });

  it('exists checks presence', () => {
    const r = makeRule({
      conditions: [{ kind: 'context_matches', field: 'tool.args.path', operator: 'exists' }],
    });
    expect(evaluator.evaluate([r], { 'tool.args.path': '/tmp' }).decision).toBe('DENY');
    expect(evaluator.evaluate([r], { 'tool.args': {} }).decision).toBe('ALLOW');
  });

  it('gt / lt for numbers', () => {
    const r = makeRule({
      conditions: [{ kind: 'context_matches', field: 'step', operator: 'gt', value: 5 }],
    });
    expect(evaluator.evaluate([r], { step: 10 }).decision).toBe('DENY');
    expect(evaluator.evaluate([r], { step: 3 }).decision).toBe('ALLOW');
  });
});

describe('ERDL Evaluator  — AND / OR logic', () => {
  it('AND: all conditions must match', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' },
        { kind: 'context_matches', field: 'tool.args.command', operator: 'contains', value: 'rm' },
      ],
      conditionLogic: 'AND',
    });
    expect(
      evaluator.evaluate([r], { 'tool.name': 'exec', 'tool.args.command': 'rm -rf' }).decision,
    ).toBe('DENY');
    expect(
      evaluator.evaluate([r], { 'tool.name': 'exec', 'tool.args.command': 'ls' }).decision,
    ).toBe('ALLOW');
  });

  it('OR: any condition match is enough', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' },
        { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'bash' },
      ],
      conditionLogic: 'OR',
    });
    expect(evaluator.evaluate([r], { 'tool.name': 'bash' }).decision).toBe('DENY');
  });
});

describe('ERDL Evaluator  — Priority ordering', () => {
  it('Lower priority value = higher evaluation priority', () => {
    const rules = [
      makeRule({ id: 'P100', action: { decision: 'ALLOW' }, priority: 100 }),
      makeRule({ id: 'P1', action: { decision: 'DENY', reason: 'p1 block' }, priority: 1 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });

  it('Allows ALLOW and DENY in same ring, DENY wins', () => {
    const rules = [
      makeRule({ id: 'a', action: { decision: 'ALLOW' }, priority: 1 }),
      makeRule({ id: 'b', action: { decision: 'DENY', reason: 'block' }, priority: 2 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });
});

describe('ERDL Evaluator  — Multiple rules matched', () => {
  it('all matched rules are reported (DENY does NOT short-circuit per DO-010)', () => {
    // SPEC v1.1 DO-010: DENY does NOT short-circuit   all rules evaluated
    // ALLOW (R1) + DENY (R2) + ALLOW (R3 non-override skipped: finalDecision!=PASS) = 2 matched
    const rules = [
      makeRule({ id: 'R1', action: { decision: 'ALLOW' }, priority: 1 }),
      makeRule({ id: 'R2', action: { decision: 'DENY', reason: 'block' }, priority: 2 }),
      makeRule({ id: 'R3', action: { decision: 'ALLOW' }, priority: 3 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
    expect(result.matchedRules).toHaveLength(2); // ALLOW (R1) + DENY (R2); R3 ALLOW skipped (non-override, finalDecision set)
  });

  it('PASS with no rules returns empty matchedRules', () => {
    const result = evaluator.evaluate([], { 'tool.name': 'exec' });
    expect(result.matchedRules).toHaveLength(0);
    expect(result.totalEvaluated).toBe(0);
    expect(result.totalMatched).toBe(0);
  });
});

describe('ERDL Evaluator  — deepContains / deepMatch', () => {
  it('deepContains finds substring in nested objects', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.args', operator: 'contains', value: 'danger' },
      ],
      conditionLogic: 'AND',
    });
    const result = evaluator.evaluate([r], {
      'tool.args': { command: 'run-dangerous-thing', nested: { value: 'safe' } },
    });
    expect(result.decision).toBe('DENY');
  });

  it('deepMatch finds regex in nested objects', () => {
    const r = makeRule({
      conditions: [
        { kind: 'context_matches', field: 'tool.args', operator: 'match', value: 'secret_' },
      ],
      conditionLogic: 'AND',
    });
    const result = evaluator.evaluate([r], {
      'tool.args': { key: 'secret_token', nested: { type: 'bearer' } },
    });
    expect(result.decision).toBe('DENY');
  });
});

describe('ERDL Evaluator  — CORRECT semantics', () => {
  it('CORRECT decision sets correction field', () => {
    const rules = [
      makeRule({
        action: {
          decision: 'CORRECT',
          correction: 'use --dry-run first',
          reason: 'Safe alternative',
        },
      }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('CORRECT');
    expect(result.primaryCorrection).toBe('use --dry-run first');
  });
});

describe('ERDL Evaluator  — Instruction accumulation', () => {
  it('Multiple ALLOW rules accumulate instructions', () => {
    const rules = [
      makeRule({
        id: 'R1',
        action: { decision: 'ALLOW', instruction: 'Log to audit' },
        priority: 1,
      }),
      makeRule({ id: 'R2', action: { decision: 'ALLOW', instruction: 'Warn user' }, priority: 2 }),
    ];
    const result = evaluator.evaluate(rules, { 'tool.name': 'exec' });
    expect(result.decision).toBe('ALLOW');
    expect(result.primaryInstruction).toContain('Log to audit');
    expect(result.primaryInstruction).toContain('Warn user');
  });
});

describe('ERDL Evaluator   SPEC v1.1  3.2.2 unless exemption', () => {
  it('unless ƥ     ⣬  DENY', () => {
    const rule = makeRule({
      action: { decision: 'DENY', reason: 'Block exec' },
      unless: {
        logic: 'AND',
        conditions: [
          { kind: 'context_matches', field: 'user.role', operator: 'eq', value: 'admin' },
        ],
      },
    });
    // Admin user running exec   unless matches   exempt
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec', 'user.role': 'admin' });
    // unless ƥ        ALLOW
    // SPEC v1.1 vectors DO-024/DO-026: unless exemption   matched_rules=0
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedRules).toHaveLength(0);
  });

  it('unless  ƥ      DENY', () => {
    const rule = makeRule({
      action: { decision: 'DENY', reason: 'Block exec' },
      unless: {
        logic: 'AND',
        conditions: [
          { kind: 'context_matches', field: 'user.role', operator: 'eq', value: 'admin' },
        ],
      },
    });
    // Normal user running exec   unless does not match   block
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec', 'user.role': 'user' });
    expect(result.decision).toBe('DENY');
    expect(result.matchedRules).toHaveLength(1);
  });

  it('unless OR  ߼     һ ƥ 伴 ', () => {
    const rule = makeRule({
      action: { decision: 'DENY', reason: 'Block write' },
      unless: {
        logic: 'OR',
        conditions: [
          { kind: 'context_matches', field: 'user.role', operator: 'eq', value: 'admin' },
          {
            kind: 'context_matches',
            field: 'file.path',
            operator: 'match',
            value: '.*\\.config\\.ts$',
          },
        ],
      },
    });
    // Normal user editing .config.ts   OR matches (file.path)   exempt
    const result = evaluator.evaluate([rule], {
      'tool.name': 'write_file',
      'user.role': 'user',
      'file.path': 'vite.config.ts',
    });
    // unless OR ƥ  (config file)       ALLOW
    expect(result.decision).toBe('ALLOW');
  });

  it('  unless    ݣ ', () => {
    const rule = makeRule({
      action: { decision: 'DENY', reason: 'Block exec' },
    });
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });

  it('unless      ', () => {
    const rule = makeRule({
      action: { decision: 'DENY', reason: 'Block exec' },
      unless: { logic: 'AND', conditions: [] },
    });
    // Empty unless = no exemption
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec' });
    expect(result.decision).toBe('DENY');
  });
});

// ============================================
// v1.1  6.1    ֵ  (Null Propagation)
// ============================================

describe('v1.1  6.1  ֵ ֵ ߼ ȫʧ ܣ ', () => {
  it(' ֶ ȱʧʱ !=  Ƚ Ӧ  false 򲻴 ', () => {
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches' as any,
          field: 'user.role',
          operator: 'ne' as any,
          value: 'admin',
        },
      ],
      action: { decision: 'DENY', reason: 'Not admin' },
    });
    // user.role     Ӧ  false
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec' });
    expect(result.decision).toBe('ALLOW');
  });

  it(' ֶ ȱʧʱ gt  Ƚ Ӧ  false', () => {
    const rule = makeRule({
      conditions: [
        { kind: 'context_matches' as any, field: 'api.count', operator: 'gt' as any, value: 1000 },
      ],
      action: { decision: 'DENY', reason: 'Rate exceeded' },
    });
    const result = evaluator.evaluate([rule], { 'tool.name': 'api_call' });
    expect(result.decision).toBe('ALLOW');
  });

  it(' ֶδ Ϊ null ʱ eq  Ƚ Ӧ  false', () => {
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches' as any,
          field: 'user.role',
          operator: 'eq' as any,
          value: 'admin',
        },
      ],
      action: { decision: 'DENY', reason: 'Not admin' },
    });
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec', 'user.role': null });
    expect(result.decision).toBe('ALLOW');
  });

  it('!= null  ֶδ Ҳ Ϊ null ʱ  true', () => {
    const rule = makeRule({
      conditions: [
        { kind: 'context_matches' as any, field: 'user.role', operator: 'ne' as any, value: null },
      ],
      action: { decision: 'ALLOW', reason: 'Has role' },
    });
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec', 'user.role': 'admin' });
    expect(result.decision).toBe('ALLOW');
  });

  it('exists  ֶ ȱʧ   false', () => {
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches' as any,
          field: 'agent.id',
          operator: 'exists' as any,
          value: true,
        },
      ],
      action: { decision: 'ALLOW', reason: 'Identity verified' },
    });
    const result = evaluator.evaluate([rule], { 'tool.name': 'exec' });
    expect(result.decision).toBe('ALLOW');
  });

  it('exists  ֶδ    true', () => {
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches' as any,
          field: 'agent.id',
          operator: 'exists' as any,
          value: true,
        },
      ],
      action: { decision: 'ALLOW', reason: 'Identity verified' },
    });
    const result = evaluator.evaluate([rule], {
      'tool.name': 'exec',
      'agent.id': 'did:erdl:sha256:abc123',
    });
    expect(result.decision).toBe('ALLOW');
  });

  //  6.1  ϸ ƥ     У gt/gte/lt/lte  Ѿ  typeof
  it(' ַ  "100" > 50 Ӧ  false ϸ ƥ 䣬 ʽת ', () => {
    const rule = makeRule({
      conditions: [
        { kind: 'context_matches' as any, field: 'claim.amount', operator: 'gt' as any, value: 50 },
      ],
      action: { decision: 'REQUEST_HUMAN', reason: 'High value' },
    });
    // claim.amount is string "100", not number 100
    const result = evaluator.evaluate([rule], {
      'tool.name': 'claim_decision',
      'claim.amount': '100',
    });
    expect(result.decision).toBe('ALLOW');
  });
});

// ============================================
// within/rate 状态累积行为基线测试
// 目的：锁定现有「滑动时间戳数组」语义，作为状态外置重构的安全网。
// ============================================

describe('within/rate 状态累积行为（业界限流/去重语义）', () => {
  function makeRateRule(maxCount: number): RuleDefinition {
    return makeRule({
      id: 'RATE-001',
      name: 'Rate limit rule',
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'eq',
          value: 'exec',
          rate: `${maxCount}/1m`,
        },
      ],
      action: { decision: 'DENY', reason: 'Rate exceeded' },
    });
  }

  it('rate 前 N 次放行，第 N+1 次拦截（业界限流语义）', () => {
    const ev = new Evaluator();
    const rules = [makeRateRule(2)];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW'); // 第 1 次放行
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW'); // 第 2 次放行
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('DENY'); // 第 3 次拦截
  });

  it('rate 超限后持续拦截（窗口内不恢复）', () => {
    const ev = new Evaluator();
    const rules = [makeRateRule(1)];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW'); // 第 1 次放行
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('DENY'); // 第 2 次拦截
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('DENY'); // 第 3 次仍拦截
  });

  it('rate 字段不匹配不计数（read 不占 exec 额度）', () => {
    const ev = new Evaluator();
    const rules = [makeRateRule(1)];
    // read 不匹配 exec → 规则不命中 → 不计数
    expect(ev.evaluate(rules, { 'tool.name': 'read' }).decision).toBe('ALLOW');
    expect(ev.evaluate(rules, { 'tool.name': 'read' }).decision).toBe('ALLOW');
    // exec 首次 → 放行（额度未被 read 占用）
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW');
    // exec 第二次 → 拦截
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('DENY');
  });

  it('rate 不同 value 隔离（exec 不占 write_file 额度）', () => {
    const ev = new Evaluator();
    const ruleA = makeRule({
      id: 'A',
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'eq',
          value: 'exec',
          rate: '1/1m',
        },
      ],
      action: { decision: 'DENY', reason: 'A limit' },
    });
    const ruleB = makeRule({
      id: 'B',
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'eq',
          value: 'write_file',
          rate: '1/1m',
        },
      ],
      action: { decision: 'DENY', reason: 'B limit' },
    });
    // exec 首次 → 放行（exec 计数 1）
    expect(ev.evaluate([ruleA, ruleB], { 'tool.name': 'exec' }).decision).toBe('ALLOW');
    // write_file 首次 → 放行（write_file 独立计数，不受 exec 影响）
    expect(ev.evaluate([ruleA, ruleB], { 'tool.name': 'write_file' }).decision).toBe('ALLOW');
    // exec 第二次 → 拦截（exec 已超限）
    expect(ev.evaluate([ruleA, ruleB], { 'tool.name': 'exec' }).decision).toBe('DENY');
  });

  it('within 首次放行，窗口内第二次拦截（去重语义）', () => {
    const ev = new Evaluator();
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'eq',
          value: 'exec',
          within: '5m',
        },
      ],
      action: { decision: 'DENY', reason: 'within window' },
    });
    // 首次：无历史 → 放行（并记录）
    expect(ev.evaluate([rule], { 'tool.name': 'exec' }).decision).toBe('ALLOW');
    // 第二次：有历史 → 拦截
    expect(ev.evaluate([rule], { 'tool.name': 'exec' }).decision).toBe('DENY');
    // 第三次：仍拦截（窗口内持续）
    expect(ev.evaluate([rule], { 'tool.name': 'exec' }).decision).toBe('DENY');
  });

  it('within 字段不匹配不记录（read 不影响 exec 去重）', () => {
    const ev = new Evaluator();
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          field: 'tool.name',
          operator: 'eq',
          value: 'exec',
          within: '5m',
        },
      ],
      action: { decision: 'DENY', reason: 'within window' },
    });
    // read 不匹配 → 不记录
    expect(ev.evaluate([rule], { 'tool.name': 'read' }).decision).toBe('ALLOW');
    expect(ev.evaluate([rule], { 'tool.name': 'read' }).decision).toBe('ALLOW');
    // exec 首次 → 放行（未被 read 污染）
    expect(ev.evaluate([rule], { 'tool.name': 'exec' }).decision).toBe('ALLOW');
    // exec 第二次 → 拦截
    expect(ev.evaluate([rule], { 'tool.name': 'exec' }).decision).toBe('DENY');
  });

  // ══ §12 Expression 投影面：结构化表达式树（含时间运算）经 expr 字段求值 ══
  it('expr 表达式树：days_between 超时效则 DENY', () => {
    const ev = new Evaluator();
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          expr: { gt: [{ days_between: [{ field: '确诊日期' }, { field: '今天' }] }, 730] },
        },
      ],
      action: { decision: 'DENY', reason: '超时效' },
    });
    // 确诊 2020-01-01，今天 2026-01-01 → 2192 天 > 730 → 匹配 DENY
    expect(ev.evaluate([rule], { 确诊日期: '2020-01-01', 今天: '2026-01-01' }).decision).toBe(
      'DENY',
    );
  });

  it('expr 表达式树：未超时效则不匹配', () => {
    const ev = new Evaluator();
    const rule = makeRule({
      conditions: [
        {
          kind: 'context_matches',
          expr: { gt: [{ days_between: [{ field: '确诊日期' }, { field: '今天' }] }, 730] },
        },
      ],
      action: { decision: 'DENY', reason: '超时效' },
    });
    // 确诊 2025-06-01，今天 2026-01-01 → 214 天 < 730 → 不匹配 → ALLOW
    expect(ev.evaluate([rule], { 确诊日期: '2025-06-01', 今天: '2026-01-01' }).decision).toBe(
      'ALLOW',
    );
  });
});

describe('ERDL Evaluator — §7.1 item 6 catch-all (empty-condition) resolution', () => {
  function emptyRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
    return {
      id: 'CATCHALL-001',
      name: 'Catch-all',
      description: 'fallback rule',
      category: 'custom',
      conditions: [],
      conditionLogic: 'AND',
      action: { decision: 'ALLOW' },
      priority: 100,
      enabled: true,
      ...overrides,
    };
  }

  it('catch-all ALLOW does NOT override an explicit DENY (relax direction)', () => {
    const ev = new Evaluator();
    const rules = [
      makeRule({
        id: 'explicit-deny',
        conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
        action: { decision: 'DENY', reason: 'explicit block', ring: 0 },
        priority: 10,
      }),
      emptyRule({
        id: 'catchall-allow',
        override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
        priority: 20,
      }),
    ];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('DENY');
  });

  it('catch-all ALLOW acts as fallback when nothing explicit matches', () => {
    const ev = new Evaluator();
    const rules = [
      makeRule({
        id: 'explicit-other',
        conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'delete_file' }],
        action: { decision: 'DENY', reason: 'block delete', ring: 0 },
        priority: 10,
      }),
      emptyRule({
        id: 'catchall-allow',
        override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
        priority: 20,
      }),
    ];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW');
  });

  it('catch-all DENY does NOT override an explicit ALLOW (existing, unchanged)', () => {
    const ev = new Evaluator();
    const rules = [
      makeRule({
        id: 'explicit-allow',
        conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
        action: { decision: 'ALLOW', ring: 0 },
        priority: 10,
      }),
      emptyRule({
        id: 'catchall-deny',
        override: 'critical',
        action: { decision: 'DENY', reason: 'fallback block', ring: 3 },
        priority: 20,
      }),
    ];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW');
  });

  it('explicit override ALLOW still overrides an explicit DENY (non-catch-all, unchanged)', () => {
    const ev = new Evaluator();
    const rules = [
      makeRule({
        id: 'explicit-deny',
        conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
        action: { decision: 'DENY', reason: 'explicit block', ring: 0 },
        priority: 10,
      }),
      makeRule({
        id: 'explicit-allow-override',
        conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: 'exec' }],
        override: 'critical',
        action: { decision: 'ALLOW', ring: 3 },
        priority: 20,
      }),
    ];
    expect(ev.evaluate(rules, { 'tool.name': 'exec' }).decision).toBe('ALLOW');
  });
});
