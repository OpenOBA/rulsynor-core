/**
 * R3 回归：runtime 决策穷尽分发 + previous_hash 审计链（审计报告 2026-08-21 R3）
 *
 * 修复前：ESCALATE/CORRECT/DEFER/DELEGATE/WORKFLOW 落入 fall-through 照常执行工具（越权执行）；
 * 且每步 DO 未传 previousAuditHash，审计链每条都是 genesis。
 *
 * CORRECT 现为原始设计的 3 轮纠正循环（D21）：纠偏指引回注 Agent 重新发起，每次重试重新裁决，
 * 3 轮未解决 → 升级人工。任何情况下都不执行原始参数（不复活 4c6f653 修的 fail-open 洞）。
 */
import { runReActLoop, type LLMResponse } from '../src/runtime.js';
import { Evaluator } from '../src/engine/evaluator.js';
import type { RuleDefinition } from '../src/engine/rule-definition.js';
import { buildDecisionObject } from '../src/guard/index.js';
import { loadPresetRules, toCompiledRules } from '../src/index.js';

function makeRule(decision: string, toolName: string, correction?: string): RuleDefinition {
  return {
    id: `RT-${decision}`,
    name: `Rule ${decision}`,
    description: 'runtime dispatch test',
    category: 'custom',
    conditions: [
      {
        kind: 'context_matches',
        // Canonical field path (ERDL SPEC §3/§4): `tool.name` — NOT `context.tool.name`.
        field: 'tool.name',
        operator: 'eq',
        value: toolName,
      },
    ],
    conditionLogic: 'AND',
    action: {
      decision: decision as RuleDefinition['action']['decision'],
      reason: `${decision} triggered`,
      correction,
    },
    priority: 1,
    enabled: true,
  };
}

function makeLLM(toolName: string, rounds = 1): (msgs: unknown[]) => Promise<LLMResponse> {
  let call = 0;
  return async () => {
    call++;
    if (call <= rounds) {
      return {
        content: 'calling tool',
        toolCalls: [{ name: toolName, arguments: { path: '/tmp/x' } }],
      };
    }
    return { content: 'done' };
  };
}

function makeTool(log: unknown[][]): { execute(args: Record<string, unknown>): Promise<string> } {
  return {
    async execute(args: Record<string, unknown>) {
      log.push([args]);
      return 'tool-output';
    },
  };
}

const baseOpts = (toolName: string, decision: string, correction?: string) => {
  const executed: unknown[][] = [];
  const compiledRules = [makeRule(decision, toolName, correction)];
  return {
    executed,
    opts: {
      llm: makeLLM(toolName),
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { [toolName]: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
    },
  };
};

/** Rule matching tool.name + tool.args.path (AND) — for CORRECT-loop retry scenarios. */
function makeArgsRule(
  toolName: string,
  path: string,
  decision: string,
  correction?: string,
): RuleDefinition {
  return {
    id: `RTA-${decision}-${path.replace(/[^a-z0-9]/gi, '')}`,
    name: `Rule ${decision} ${path}`,
    description: 'correct loop test',
    category: 'custom',
    conditions: [
      { kind: 'context_matches', field: 'tool.name', operator: 'eq', value: toolName },
      { kind: 'context_matches', field: 'tool.args.path', operator: 'eq', value: path },
    ],
    conditionLogic: 'AND',
    action: {
      decision: decision as RuleDefinition['action']['decision'],
      reason: `${decision} triggered`,
      correction,
    },
    priority: 1,
    enabled: true,
  };
}

describe('runReActLoop — 决策穷尽分发（R3a）', () => {
  it('ALLOW → 执行工具', async () => {
    const { executed, opts } = baseOpts('safe_tool', 'ALLOW');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(1);
    expect(result.decision).toBe('ALLOW');
  });

  it('DENY → 不执行工具', async () => {
    const { executed, opts } = baseOpts('danger', 'DENY');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('DENY');
  });

  it('ESCALATE → 不执行工具（修复前会直通执行）', async () => {
    const { executed, opts } = baseOpts('danger', 'ESCALATE');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('ESCALATE');
    expect(result.finalResponse).toContain('Escalated');
  });

  it('DEFER → 不执行工具', async () => {
    const { executed, opts } = baseOpts('danger', 'DEFER');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('DEFER');
  });

  it('DELEGATE → 不执行工具', async () => {
    const { executed, opts } = baseOpts('danger', 'DELEGATE');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('DELEGATE');
  });

  it('CORRECT 后重试命中 DENY → 按 DENY 封锁（退出循环，不转人工）', async () => {
    const executed: unknown[][] = [];
    const compiledRules = [makeArgsRule('drill', '/tmp/bad', 'CORRECT'), makeArgsRule('drill', '/tmp/evil', 'DENY')];
    let call = 0;
    const result = await runReActLoop({
      llm: async () => {
        call++;
        if (call === 1)
          return { content: 'try', toolCalls: [{ name: 'drill', arguments: { path: '/tmp/bad' } }] };
        if (call === 2)
          return { content: 'retry', toolCalls: [{ name: 'drill', arguments: { path: '/tmp/evil' } }] };
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { drill: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('DENY');
    expect(result.finalResponse).toContain('blocked');
  });
});

describe('runReActLoop — CORRECT 3 轮纠正循环（原始设计 D21）', () => {
  it('CORRECT → 纠偏回注 → 重试 ALLOW → 执行纠正后的参数', async () => {
    const executed: unknown[][] = [];
    const loopStates: string[] = [];
    const compiledRules = [makeArgsRule('fixer', '/tmp/bad', 'CORRECT', 'use /tmp/safe instead')];
    let call = 0;
    const result = await runReActLoop({
      llm: async (msgs: Array<{ role: string; content: string }>) => {
        call++;
        if (call === 1) {
          return { content: 'try', toolCalls: [{ name: 'fixer', arguments: { path: '/tmp/bad' } }] };
        }
        if (call === 2) {
          // The correction feedback must reach the model as a tool message before the retry.
          const last = msgs[msgs.length - 1];
          expect(last.role).toBe('tool');
          expect(last.content).toContain('use /tmp/safe instead');
          return { content: 'retry', toolCalls: [{ name: 'fixer', arguments: { path: '/tmp/safe' } }] };
        }
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { fixer: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
      onCorrectLoop: state => loopStates.push(state),
    });
    // 原始参数永不执行；只执行纠正后的调用。
    expect(executed).toHaveLength(1);
    expect(executed[0][0]).toEqual({ path: '/tmp/safe' });
    expect(result.decision).toBe('ALLOW');
    // 状态机轨迹：首轮纠正 → ALLOW 解决
    expect(loopStates).toEqual(['correct_round_1', 'correct_resolved']);
    // 两次裁决各落一条 DO（CORRECT + ALLOW）
    expect(result.auditHashes).toHaveLength(2);
  });

  it('CORRECT ×4 冥顽不改 → 3 轮后升级人工（不执行）', async () => {
    const executed: unknown[][] = [];
    const loopStates: string[] = [];
    const compiledRules = [makeArgsRule('stubborn', '/tmp/x', 'CORRECT', 'fix the format')];
    const result = await runReActLoop({
      llm: makeLLM('stubborn', 10),
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { stubborn: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
      onCorrectLoop: state => loopStates.push(state),
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('REQUEST_HUMAN');
    expect(result.finalResponse).toContain('exhausted');
    expect(result.finalResponse).toContain('fix the format');
    // 原始调用 + 3 轮重试 = 4 次 CORRECT 裁决，各落一条 DO 审计链
    expect(result.auditHashes).toHaveLength(4);
    expect(loopStates).toEqual([
      'correct_round_1',
      'correct_round_2',
      'correct_round_3',
      'correct_escalated',
    ]);
  });

  it('CORRECT 时 Agent 明示请求人工 → 人工信号优先，不进纠正循环', async () => {
    const executed: unknown[][] = [];
    const loopStates: string[] = [];
    const compiledRules = [makeArgsRule('asker', '/tmp/x', 'CORRECT', 'fix it')];
    const result = await runReActLoop({
      llm: async () => ({
        content: 'REQUEST_HUMAN: need approval before touching this path',
        toolCalls: [{ name: 'asker', arguments: { path: '/tmp/x' } }],
      }),
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { asker: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
      onCorrectLoop: state => loopStates.push(state),
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('REQUEST_HUMAN');
    expect(loopStates).toEqual([]); // 循环从未启动
    expect(result.auditHashes).toHaveLength(1); // 只落了这一次裁决的 DO
  });

  it('CORRECT 后下一个调用命中 NOTIFY → 循环静默结束，状态报告不说谎', async () => {
    const executed: unknown[][] = [];
    const loopStates: string[] = [];
    const compiledRules = [
      makeArgsRule('fixer', '/tmp/bad', 'CORRECT', 'use /tmp/safe'),
      { ...makeArgsRule('notifier', '/tmp/x', 'NOTIFY'), id: 'RTN-notifier' },
    ];
    let call = 0;
    const result = await runReActLoop({
      llm: async () => {
        call++;
        if (call === 1)
          return { content: 'try', toolCalls: [{ name: 'fixer', arguments: { path: '/tmp/bad' } }] };
        if (call === 2)
          return { content: 'switch', toolCalls: [{ name: 'notifier', arguments: { path: '/tmp/x' } }] };
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { fixer: makeTool(executed), notifier: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
      onCorrectLoop: state => loopStates.push(state),
    });
    expect(result.decision).toBe('ALLOW');
    expect(executed).toHaveLength(1); // NOTIFY 照常规执行（记录不中断）
    // 只报告过第 1 轮；序列因 NOTIFY 静默结束，不谎报「进入第 2 轮」
    expect(loopStates).toEqual(['correct_round_1']);
  });

  it('CORRECT 后 Agent 放弃重试（不再发起调用）→ 汇总报 CORRECT 而非 ALLOW', async () => {
    const executed: unknown[][] = [];
    const compiledRules = [makeArgsRule('giver', '/tmp/bad', 'CORRECT', 'fix it')];
    let call = 0;
    const result = await runReActLoop({
      llm: async () => {
        call++;
        if (call === 1)
          return { content: 'try', toolCalls: [{ name: 'giver', arguments: { path: '/tmp/bad' } }] };
        return { content: 'I give up' };
      },
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { giver: makeTool(executed) },
      userMessage: 'do it',
      agentId: 'test-agent',
      sessionId: 'test-session',
      planFirst: false,
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('CORRECT'); // 未解决的纠正不得伪装成 ALLOW
    expect(result.finalResponse).toBe('I give up');
    expect(result.auditHashes).toHaveLength(1);
  });
});

describe('runReActLoop — previous_hash 审计链（R3b）', () => {
  it('多步执行产生逐步累积的审计哈希（每步落链）', async () => {
    const executed: unknown[][] = [];
    const compiledRules = [makeRule('ALLOW', 'safe_tool')];
    let llmCall = 0;
    const result = await runReActLoop({
      llm: async () => {
        llmCall++;
        if (llmCall <= 2)
          return { content: 'step', toolCalls: [{ name: 'safe_tool', arguments: {} }] };
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules,
      rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
      tools: { safe_tool: makeTool(executed) },
      userMessage: 'go',
      planFirst: false,
    });
    expect(executed).toHaveLength(2);
    // 每次工具调用一条 DO，两步落链两条
    expect(result.auditHashes).toHaveLength(2);
    expect(result.auditHashes[0]).toMatch(/^sha256:/);
    expect(result.auditHashes[1]).toMatch(/^sha256:/);
    expect(result.auditHashes[0]).not.toBe(result.auditHashes[1]);
  });

  it('buildDecisionObject 锚定 previousAuditHash（链式语义单元验证）', () => {
    const first = buildDecisionObject({
      input: {
        runId: 'r',
        step: 0,
        toolName: 't',
        toolArgs: {},
        context: {},
        agentId: 'a',
        sessionId: 's',
      },
      decision: 'ALLOW',
      actionTaken: 'allowed',
      reason: null,
      matchedRules: [],
      totalEvaluated: 0,
      totalMatched: 0,
      rules: [],
      evaluationDurationMs: 1,
    });
    expect(first.audit.previous_hash).toBeNull();

    const second = buildDecisionObject({
      input: {
        runId: 'r',
        step: 1,
        toolName: 't',
        toolArgs: {},
        context: {},
        agentId: 'a',
        sessionId: 's',
        previousAuditHash: first.audit.hash,
      },
      decision: 'ALLOW',
      actionTaken: 'allowed',
      reason: null,
      matchedRules: [],
      totalEvaluated: 0,
      totalMatched: 0,
      rules: [],
      evaluationDurationMs: 1,
    });
    expect(second.audit.previous_hash).toBe(first.audit.hash);
    expect(second.audit.commitment).toEqual(
      expect.objectContaining({ agent_id: expect.any(String), tool_name: 't', decision: 'ALLOW' }),
    );
  });
});

describe('runReActLoop — 7 步工作法编排（①②③④）', () => {
  it('planFirst 时依次触发 ①理解意图 ②制定计划 ③组装依据 ④推理决策', async () => {
    const steps: string[] = [];
    await runReActLoop({
      llm: async () => ({ content: 'done' }),
      evaluator: new Evaluator(),
      compiledRules: [],
      rules: [],
      tools: {},
      userMessage: 'do it',
      planFirst: true,
      onStep: s => steps.push(String(s)),
    });
    for (const n of ['1', '2', '3', '4']) {
      expect(steps).toContain(n);
    }
  });

  it('knowledge 组装注入系统消息（③ 组装依据）', async () => {
    let systemContent = '';
    await runReActLoop({
      llm: async (msgs: Array<{ role: string; content: string }>) => {
        systemContent = msgs[0].content;
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules: [],
      rules: [],
      tools: {},
      userMessage: 'do it',
      planFirst: false,
      knowledge: [
        {
          fragmentId: 'f1',
          knowledgeId: 'kb-1',
          contentType: 'markdown',
          text: 'SOP: use list before exec',
          score: 0.9,
          knowledgeVersion: 'v1',
        },
      ],
    });
    expect(systemContent).toContain('SOP: use list before exec');
  });
});

describe('runReActLoop — business context 注入（context.* 规则）', () => {
  it('context.event_type=credential_leak → EMERGENCY_HALT 且不执行工具', async () => {
    const preset = toCompiledRules(loadPresetRules());
    const executed: unknown[][] = [];
    const result = await runReActLoop({
      llm: async () => ({
        content: 'call',
        toolCalls: [{ name: 'exec', arguments: { command: 'ls' } }],
      }),
      evaluator: new Evaluator(),
      compiledRules: preset,
      rules: preset.map(r => ({ name: r.name, version: 1 })),
      tools: { exec: makeTool(executed) },
      userMessage: 'do it',
      planFirst: false,
      context: { event_type: 'credential_leak' },
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('EMERGENCY_HALT');
  });

  it('无 context → exec ls ALLOW（context.* 规则静默）', async () => {
    const preset = toCompiledRules(loadPresetRules());
    const executed: unknown[][] = [];
    let calls = 0;
    const result = await runReActLoop({
      llm: async () => {
        calls++;
        if (calls === 1)
          return { content: 'call', toolCalls: [{ name: 'exec', arguments: { command: 'ls' } }] };
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules: preset,
      rules: preset.map(r => ({ name: r.name, version: 1 })),
      tools: { exec: makeTool(executed) },
      userMessage: 'do it',
      planFirst: false,
    });
    expect(result.decision).toBe('ALLOW');
  });
});

describe('runReActLoop — previous_promise 派生（ETH-001 言行一致）', () => {
  it('计划声明 read-only 后写工具 → REQUEST_HUMAN 且不执行', async () => {
    const preset = toCompiledRules(loadPresetRules());
    const executed: unknown[][] = [];
    let call = 0;
    const result = await runReActLoop({
      llm: async () => {
        call++;
        if (call === 1) {
          // ② 制定计划：只读计划（所有步骤 OP_READ）
          return {
            content:
              'PLAN:\nStep 1: read the file | tools: read_file | op: READ | purpose: inspect',
          };
        }
        if (call === 2) {
          // ④ 推理：违背只读承诺，尝试写
          return {
            content: 'writing now',
            toolCalls: [
              { name: 'write_file', arguments: { path: '/app/x.txt', content: 'hello' } },
            ],
          };
        }
        return { content: 'done' };
      },
      evaluator: new Evaluator(),
      compiledRules: preset,
      rules: preset.map(r => ({ name: r.name, version: 1 })),
      tools: { write_file: makeTool(executed) },
      userMessage: 'read the file',
      planFirst: true,
    });
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('REQUEST_HUMAN');
  });
});
