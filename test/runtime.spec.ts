/**
 * R3 回归：runtime 决策穷尽分发 + previous_hash 审计链（审计报告 2026-08-21 R3）
 *
 * 修复前：ESCALATE/CORRECT/DEFER/DELEGATE/WORKFLOW 落入 fall-through 照常执行工具（越权执行）；
 * 且每步 DO 未传 previousAuditHash，审计链每条都是 genesis。
 */
import { runReActLoop, type LLMResponse } from '../src/runtime.js';
import { Evaluator } from '../src/engine/evaluator.js';
import type { RuleDefinition } from '../src/engine/rule-definition.js';
import { buildDecisionObject } from '../src/guard/index.js';

function makeRule(decision: string, toolName: string, correction?: string): RuleDefinition {
  return {
    id: `RT-${decision}`,
    name: `Rule ${decision}`,
    description: 'runtime dispatch test',
    category: 'custom',
    conditions: [
      {
        kind: 'context_matches',
        // Canonical field path (SPEC v2.0 DO field 8): runtime wraps the tool call in `context.tool`.
        field: 'context.tool.name',
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

  it('CORRECT 带纠偏 → 执行且参数携带纠偏内容', async () => {
    const { executed, opts } = baseOpts('fixable', 'CORRECT', 'use /tmp/safe instead');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(1);
    expect((executed[0][0] as Record<string, unknown>)['__correction']).toBe(
      'use /tmp/safe instead',
    );
    expect(result.decision).toBe('ALLOW');
  });

  it('CORRECT 无纠偏 → fail-close 不执行', async () => {
    const { executed, opts } = baseOpts('fixable', 'CORRECT');
    const result = await runReActLoop(opts);
    expect(executed).toHaveLength(0);
    expect(result.decision).toBe('CORRECT');
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
