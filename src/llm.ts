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
}

export interface LlmResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export interface LlmConfig {
  modelName?: string;
  baseUrl?: string;
}

/**
 * Build an OpenAI-compatible `llm` function.
 * `apiKey` is passed in (from the caller / environment) — CORE never persists it.
 */
export function createOpenAiCompatibleLlm(
  cfg: LlmConfig,
  apiKey: string,
): (messages: LlmMessage[]) => Promise<LlmResponse> {
  const base = (cfg.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = cfg.modelName ?? 'gpt-4o-mini';

  return async (messages: LlmMessage[]) => {
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LLM request failed (${resp.status}): ${text.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ function: { name: string; arguments: string } }>;
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
        return { name: tc.function.name, arguments: args };
      }),
    };
  };
}
