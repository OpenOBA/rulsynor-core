import { createOpenAiCompatibleLlm } from '../src/llm.js';

describe('createOpenAiCompatibleLlm', () => {
  const originalFetch = globalThis.fetch;
  let captured: { url: string; init?: RequestInit } = { url: '' };
  let jsonResponse: unknown = { choices: [{ message: { content: 'hi' } }] };

  beforeEach(() => {
    captured = { url: '' };
    jsonResponse = { choices: [{ message: { content: 'hi' } }] };
    globalThis.fetch = (async (input, init) => {
      captured.url = String(input);
      captured.init = init;
      return {
        ok: true,
        status: 200,
        json: async () => jsonResponse,
        text: async () => '',
      } as unknown as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function body(): Record<string, unknown> {
    return JSON.parse(String(captured.init?.body)) as Record<string, unknown>;
  }

  it('sends model + messages + bearer auth to baseUrl (trailing slash normalized)', async () => {
    const llm = createOpenAiCompatibleLlm(
      { modelName: 'qwen-test', baseUrl: 'https://x.example/v1/' },
      'sk-key',
    );
    await llm([{ role: 'user', content: 'hi' }]);
    expect(captured.url).toBe('https://x.example/v1/chat/completions');
    expect(body().model).toBe('qwen-test');
    expect(body().messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(captured.init?.headers).toMatchObject({ Authorization: 'Bearer sk-key' });
  });

  it('advertises tool schemas when provided, and omits them otherwise', async () => {
    const withTools = createOpenAiCompatibleLlm({}, 'k', [
      { name: 'exec', description: 'd', parameters: { type: 'object' } },
    ]);
    await withTools([{ role: 'user', content: 'x' }]);
    expect(body().tools).toEqual([
      { type: 'function', function: { name: 'exec', description: 'd', parameters: { type: 'object' } } },
    ]);

    const withoutTools = createOpenAiCompatibleLlm({}, 'k');
    await withoutTools([{ role: 'user', content: 'x' }]);
    expect(body().tools).toBeUndefined();
  });

  it('parses tool_calls preserving id + JSON arguments', async () => {
    jsonResponse = {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [{ id: 'call_1', function: { name: 'exec', arguments: '{"command":"ls"}' } }],
          },
        },
      ],
    };
    const llm = createOpenAiCompatibleLlm({}, 'k');
    const res = await llm([{ role: 'user', content: 'x' }]);
    expect(res.toolCalls).toEqual([{ id: 'call_1', name: 'exec', arguments: { command: 'ls' } }]);
  });

  it('tolerates malformed tool_calls arguments JSON (→ empty object)', async () => {
    jsonResponse = {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [{ id: 'call_1', function: { name: 'exec', arguments: 'not-json' } }],
          },
        },
      ],
    };
    const llm = createOpenAiCompatibleLlm({}, 'k');
    const res = await llm([{ role: 'user', content: 'x' }]);
    expect(res.toolCalls?.[0].arguments).toEqual({});
  });

  it('throws with status on non-OK response', async () => {
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => 'unauthorized',
      }) as unknown as Response) as typeof fetch;
    const llm = createOpenAiCompatibleLlm({}, 'k');
    await expect(llm([{ role: 'user', content: 'x' }])).rejects.toThrow(/401/);
  });

  it('round-trips assistant tool_calls and tool results to the wire format', async () => {
    const llm = createOpenAiCompatibleLlm({}, 'k', [
      { name: 'exec', description: 'd', parameters: { type: 'object' } },
    ]);
    await llm([
      { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', name: 'exec', arguments: { command: 'ls' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: 'output' },
    ]);
    expect(body().messages).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'exec', arguments: '{"command":"ls"}' } },
        ],
      },
      { role: 'tool', content: 'output', tool_call_id: 'call_1' },
    ]);
  });
});
