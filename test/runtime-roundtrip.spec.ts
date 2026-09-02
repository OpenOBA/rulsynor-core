/**
 * Regression: runReActLoop structured tool-call round-trip.
 *
 * The runtime echoes the assistant tool_calls back to the model and emits
 * `role: 'tool'` results keyed by tool_call_id (OpenAI function-calling contract).
 * Before this was a plain-text "Tool result:" user message with the tool_calls lost.
 */
import { runReActLoop } from '../src/runtime.js';
import type { LLMMessage, LLMResponse } from '../src/runtime.js';
import { Evaluator } from '../src/engine/evaluator.js';
import type { RuleDefinition } from '../src/engine/rule-definition.js';

function allowRule(toolName: string): RuleDefinition {
  return {
    id: `RT-${toolName}`,
    name: `RT ${toolName}`,
    description: 'roundtrip test',
    category: 'custom',
    conditions: [{ kind: 'context_matches', field: 'tool.name', operator: 'eq', value: toolName }],
    conditionLogic: 'AND',
    action: { decision: 'ALLOW', reason: 'ok' },
    priority: 1,
    enabled: true,
  };
}

function makeCapturingLlm(
  responses: LLMResponse[],
): { llm: (messages: LLMMessage[]) => Promise<LLMResponse>; captured: LLMMessage[][] } {
  const captured: LLMMessage[][] = [];
  let i = 0;
  return {
    captured,
    llm: async (messages: LLMMessage[]) => {
      captured.push(messages);
      return responses[i++] ?? { content: 'done' };
    },
  };
}

describe('runReActLoop — structured tool-call round-trip', () => {
  it('echoes assistant tool_calls and emits tool-role results keyed by tool_call_id', async () => {
    const { llm, captured } = makeCapturingLlm([
      { content: '', toolCalls: [{ id: 'call_abc', name: 'exec', arguments: { command: 'ls' } }] },
      { content: 'done' },
    ]);
    const rules = [allowRule('exec')];
    const result = await runReActLoop({
      llm,
      evaluator: new Evaluator(),
      compiledRules: rules,
      rules: rules.map(r => ({ name: r.name, version: 1 })),
      tools: { exec: { execute: async () => 'file1\nfile2' } },
      userMessage: 'list files',
      agentId: 'a',
      sessionId: 's',
      planFirst: false,
    });

    expect(result.finalResponse).toBe('done');
    expect(captured).toHaveLength(2);

    const round2 = captured[1];
    const assistant = round2.find(m => m.role === 'assistant');
    expect(assistant).toMatchObject({
      role: 'assistant',
      tool_calls: [{ id: 'call_abc', name: 'exec', arguments: { command: 'ls' } }],
    });
    const toolMsg = round2.find(m => m.role === 'tool');
    expect(toolMsg).toMatchObject({ role: 'tool', tool_call_id: 'call_abc', content: 'file1\nfile2' });
  });

  it('emits a tool-role message for an unknown tool (id preserved)', async () => {
    const { llm, captured } = makeCapturingLlm([
      { content: '', toolCalls: [{ id: 'call_x', name: 'nope', arguments: {} }] },
      { content: 'done' },
    ]);
    const rules = [allowRule('nope')];
    await runReActLoop({
      llm,
      evaluator: new Evaluator(),
      compiledRules: rules,
      rules: rules.map(r => ({ name: r.name, version: 1 })),
      tools: {},
      userMessage: 'x',
      planFirst: false,
    });

    const toolMsg = captured[1].find(m => m.role === 'tool');
    expect(toolMsg).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_x',
      content: expect.stringContaining('not found'),
    });
  });

  it('generates a stable id when the model omits one', async () => {
    const { llm, captured } = makeCapturingLlm([
      { content: '', toolCalls: [{ name: 'exec', arguments: { command: 'ls' } }] },
      { content: 'done' },
    ]);
    const rules = [allowRule('exec')];
    await runReActLoop({
      llm,
      evaluator: new Evaluator(),
      compiledRules: rules,
      rules: rules.map(r => ({ name: r.name, version: 1 })),
      tools: { exec: { execute: async () => 'ok' } },
      userMessage: 'x',
      planFirst: false,
    });

    const assistant = captured[1].find(m => m.role === 'assistant');
    const toolMsg = captured[1].find(m => m.role === 'tool');
    const generatedId = assistant?.tool_calls?.[0].id;
    expect(generatedId).toBeDefined();
    expect(toolMsg?.tool_call_id).toBe(generatedId);
  });
});
