/**
 * Default LLM client — OpenAI-compatible chat completions via Node's built-in fetch.
 *
 * Completes the "set model" flow: CORE stores model name/baseUrl (Store), the API key
 * comes from the environment (never the DB), and this factory builds the `llm` function
 * the runtime consumes. Zero npm dependency (global fetch).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Tool result (role='tool'): the id of the tool_call this message answers. */
  tool_call_id?: string;
  /** Assistant tool calls replayed back (structured function-calling round-trip). */
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export interface LlmResponse {
  content: string;
  toolCalls?: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>;
}

export interface LlmConfig {
  modelName?: string;
  baseUrl?: string;
}

/** JSON-schema tool definition advertised to the model (OpenAI function-calling shape). */
export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Build an OpenAI-compatible `llm` function.
 * `apiKey` is passed in (from the caller / environment) — CORE never persists it.
 * Optional `tools` are advertised via the standard function-calling schema so the
 * runtime's ReAct loop receives real tool calls.
 */
export function createOpenAiCompatibleLlm(
  cfg: LlmConfig,
  apiKey: string,
  tools?: LlmToolSchema[],
): (messages: LlmMessage[]) => Promise<LlmResponse> {
  const base = (cfg.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = cfg.modelName ?? 'gpt-4o-mini';
  const toolDefs =
    tools && tools.length > 0 ? tools.map(t => ({ type: 'function', function: t })) : undefined;

  return async (messages: LlmMessage[]) => {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => {
          const wire: Record<string, unknown> = { role: m.role, content: m.content };
          if (m.tool_call_id !== undefined) wire.tool_call_id = m.tool_call_id;
          if (m.tool_calls !== undefined && m.tool_calls.length > 0) {
            // OpenAI convention: assistant content is null when tool_calls are present.
            wire.content = m.content || null;
            wire.tool_calls = m.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }));
          }
          return wire;
        }),
        ...(toolDefs ? { tools: toolDefs } : {}),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LLM request failed (${resp.status}): ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }>;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    return {
      content: msg?.content ?? '',
      toolCalls: msg?.tool_calls?.map(tc => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      }),
    };
  };
}
