import { handleRequest } from '../src/mcp/server.js';
import type { JsonRpcRequest, McpDeps } from '../src/mcp/server.js';

function fakeDeps(): McpDeps {
  return {
    evaluate: (toolName, toolArgs) => ({
      decision:
        toolName === 'exec' && String(toolArgs.command ?? '').includes('rm -rf') ? 'DENY' : 'ALLOW',
      reason: toolName === 'exec' ? 'recursive delete blocked' : null,
      hash: 'sha256:fake',
      matchedRules: toolName === 'exec' ? ['block-rm-rf'] : [],
      rulesEvaluated: 30,
    }),
    listRules: () => [
      { name: 'r1', category: 'security', ring: 0, decision: 'DENY', source: 'preset' },
    ],
    recentAudit: limit =>
      Array.from({ length: Math.min(limit, 2) }, (_, i) => ({
        createdAt: `2026-09-02T00:0${i}:00.000Z`,
        toolName: 'exec',
        decision: 'DENY',
        hash: `sha256:h${i}`,
      })),
    close: () => undefined,
  };
}

const req = (method: string, params?: unknown, id: number | string | null = 1): JsonRpcRequest => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params !== undefined ? { params } : {}),
});

describe('MCP stdio server — handleRequest', () => {
  const deps = fakeDeps();

  it('answers initialize with server info and tool capability', () => {
    const res = handleRequest(req('initialize', {}), deps);
    expect(res?.result).toMatchObject({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
    });
    expect((res?.result as { serverInfo: { name: string } }).serverInfo.name).toBe('rulsynor-core');
  });

  it('returns null for notifications (no response)', () => {
    expect(handleRequest(req('notifications/initialized', {}, null), deps)).toBeNull();
  });

  it('lists the three CORE tools', () => {
    const res = handleRequest(req('tools/list'), deps);
    const tools = (res?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map(t => t.name)).toEqual([
      'rulsynor_guard_evaluate',
      'rulsynor_rules_list',
      'rulsynor_audit_recent',
    ]);
  });

  it('evaluates a guarded tool call through the Guard', () => {
    const res = handleRequest(
      req('tools/call', {
        name: 'rulsynor_guard_evaluate',
        arguments: { tool_name: 'exec', tool_args: { command: 'rm -rf /' } },
      }),
      deps,
    );
    const text = (res?.result as { content: Array<{ text: string }> }).content[0].text;
    const parsed = JSON.parse(text) as { decision: string; audit_hash: string };
    expect(parsed.decision).toBe('DENY');
    expect(parsed.audit_hash).toBe('sha256:fake');
  });

  it('reports an error for a missing tool_name', () => {
    const res = handleRequest(
      req('tools/call', { name: 'rulsynor_guard_evaluate', arguments: {} }),
      deps,
    );
    expect((res?.result as { isError?: boolean }).isError).toBe(true);
  });

  it('threads context from tool-call arguments into evaluation', () => {
    let receivedContext: Record<string, unknown> | undefined;
    const ctxDeps: McpDeps = {
      evaluate: (_toolName, _toolArgs, context) => {
        receivedContext = context;
        return {
          decision: 'EMERGENCY_HALT',
          reason: null,
          hash: 'sha256:fake',
          matchedRules: [],
          rulesEvaluated: 34,
        };
      },
      listRules: () => [],
      recentAudit: () => [],
      close: () => undefined,
    };
    handleRequest(
      req('tools/call', {
        name: 'rulsynor_guard_evaluate',
        arguments: {
          tool_name: 'exec',
          tool_args: { command: 'ls' },
          context: { event_type: 'credential_leak' },
        },
      }),
      ctxDeps,
    );
    expect(receivedContext).toEqual({ event_type: 'credential_leak' });
  });

  it('lists rules and recent audit read-only', () => {
    const rules = handleRequest(req('tools/call', { name: 'rulsynor_rules_list' }), deps);
    expect(
      JSON.parse((rules?.result as { content: Array<{ text: string }> }).content[0].text),
    ).toHaveLength(1);
    const audit = handleRequest(
      req('tools/call', { name: 'rulsynor_audit_recent', arguments: { limit: 2 } }),
      deps,
    );
    expect(
      JSON.parse((audit?.result as { content: Array<{ text: string }> }).content[0].text),
    ).toHaveLength(2);
  });

  it('rejects unknown methods and unknown tools', () => {
    const unknown = handleRequest(req('bogus/method'), deps);
    expect(unknown?.error?.code).toBe(-32601);
    const badTool = handleRequest(req('tools/call', { name: 'nope' }), deps);
    expect((badTool?.result as { isError?: boolean }).isError).toBe(true);
  });
});
