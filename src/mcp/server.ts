/**
 * Minimal MCP (Model Context Protocol) stdio server — zero npm dependency.
 *
 * Exposes the CORE capabilities as MCP tools so any MCP-capable host
 * (Claude Desktop, OpenClaw, IDE agents…) can drive the ERDL Guard:
 *
 *   rulsynor_guard_evaluate — evaluate one tool call against all loaded rules
 *   rulsynor_rules_list     — list preset + user rules
 *   rulsynor_audit_recent   — read-only recent audit records (no export)
 *
 * Speaks newline-delimited JSON-RPC 2.0 on stdin/stdout (MCP stdio transport).
 * handleRequest is pure (dependency-injected) and unit-tested; runMcpServer is
 * the thin stdio loop.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { createInterface } from 'node:readline';
import {
  Evaluator,
  GuardStateManager,
  Store,
  buildDecisionObject,
  loadPresetRules,
  loadRulesFromDir,
  toCompiledRules,
} from '../index.js';
import { PROVENANCE } from '../provenance.js';
import { ensureHome, resolvePaths } from '../config.js';

const PROTOCOL_VERSION = '2024-11-05';

export interface JsonRpcRequest {
  jsonrpc: string;
  id?: number | string | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpEvalResult {
  decision: string;
  reason: string | null;
  hash: string;
  matchedRules: string[];
  rulesEvaluated: number;
}

export interface McpRuleInfo {
  name: string;
  category: string;
  ring: number;
  decision: string;
  source: 'preset' | 'user';
}

export interface McpAuditInfo {
  createdAt: string;
  toolName: string;
  decision: string;
  hash: string;
}

export interface McpDeps {
  evaluate(toolName: string, toolArgs: Record<string, unknown>): McpEvalResult;
  listRules(): McpRuleInfo[];
  recentAudit(limit: number): McpAuditInfo[];
  close(): void;
}

/** Wire CORE to the MCP tool surface (rules: preset + user dir; audit persisted). */
export function createMcpDeps(): McpDeps {
  const paths = resolvePaths();
  ensureHome(paths.home);
  const store = new Store(paths.dbPath);

  const presetRules = loadPresetRules();
  const userRules = paths.rulesDir ? loadRulesFromDir(paths.rulesDir) : [];
  const compiled = toCompiledRules([...presetRules, ...userRules]);
  const evaluator = new Evaluator(new GuardStateManager());
  let prevHash: string | null = null;

  return {
    evaluate(toolName: string, toolArgs: Record<string, unknown>): McpEvalResult {
      const startMs = Date.now();
      const result = evaluator.evaluate(compiled, {
        context: { tool: { name: toolName, args: toolArgs } },
        sessionId: 'mcp',
        agentId: 'rulsynor-mcp',
      });
      const doObj = buildDecisionObject({
        input: {
          runId: `mcp-${Date.now()}`,
          step: 0,
          toolName,
          toolArgs,
          context: {},
          agentId: 'rulsynor-mcp',
          sessionId: 'mcp',
          previousAuditHash: prevHash,
        },
        decision: result.decision,
        actionTaken:
          result.decision === 'DENY' || result.decision === 'EMERGENCY_HALT'
            ? 'blocked'
            : result.decision === 'REQUEST_HUMAN'
              ? 'paused'
              : 'allowed',
        reason: result.primaryReason ?? null,
        matchedRules: result.matchedRules,
        totalEvaluated: result.totalEvaluated ?? compiled.length,
        totalMatched: result.totalMatched ?? result.matchedRules.length,
        rules: compiled.map(r => ({ name: r.name, version: 1 })),
        evaluationDurationMs: Date.now() - startMs,
      });
      prevHash = doObj.audit.hash;
      store.recordAudit({
        sessionId: 'mcp',
        agentId: 'rulsynor-mcp',
        step: 0,
        toolName,
        decision: result.decision,
        hash: doObj.audit.hash,
        previousHash: doObj.audit.previous_hash,
        decisionObject: doObj,
      });
      return {
        decision: result.decision,
        reason: result.primaryReason ?? null,
        hash: doObj.audit.hash,
        matchedRules: result.matchedRules.map(m => m.ruleId),
        rulesEvaluated: compiled.length,
      };
    },
    listRules(): McpRuleInfo[] {
      const describe = (
        rules: ReturnType<typeof loadPresetRules>,
        source: 'preset' | 'user',
      ): McpRuleInfo[] =>
        rules.map(r => {
          const then = (r.parsed.then ?? {}) as Record<string, unknown>;
          return {
            name: String(r.parsed.name ?? r.name),
            category: String(r.parsed.category ?? 'security'),
            ring: Number(r.parsed.ring ?? 0),
            decision: String(then.decision ?? 'DENY'),
            source,
          };
        });
      return [...describe(presetRules, 'preset'), ...describe(userRules, 'user')];
    },
    recentAudit(limit: number): McpAuditInfo[] {
      return store.listAudit(limit).map(r => ({
        createdAt: r.createdAt,
        toolName: r.toolName,
        decision: r.decision,
        hash: r.hash,
      }));
    },
    close(): void {
      store.close();
    },
  };
}

const TOOL_DEFS = [
  {
    name: 'rulsynor_guard_evaluate',
    description:
      'Evaluate one tool call against all loaded ERDL rules (presets + user rules). ' +
      'Returns the Guard decision, reason, matched rules and the tamper-evident audit hash.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Name of the tool call to evaluate' },
        tool_args: {
          type: 'object',
          description: 'Arguments of the tool call',
          additionalProperties: true,
        },
      },
      required: ['tool_name'],
    },
  },
  {
    name: 'rulsynor_rules_list',
    description: 'List all loaded ERDL rules (preset + user rules dir).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'rulsynor_audit_recent',
    description:
      'Read-only view of recent audit records (Decision Object hashes). Export is not provided.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max records (default 10)' } },
    },
  },
];

function ok(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function toolText(id: number | string | null, text: string, isError = false): JsonRpcResponse {
  return ok(id, { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) });
}

/** Pure JSON-RPC dispatch — unit-testable without stdio. */
export function handleRequest(req: JsonRpcRequest, deps: McpDeps): JsonRpcResponse | null {
  const id = req.id ?? null;
  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'rulsynor-core', version: PROVENANCE.version },
      });
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOL_DEFS });
    case 'tools/call': {
      const params = (req.params ?? {}) as { name?: string; arguments?: unknown };
      const name = params.name;
      const callArgs =
        params.arguments && typeof params.arguments === 'object'
          ? (params.arguments as Record<string, unknown>)
          : {};
      if (name === 'rulsynor_guard_evaluate') {
        const toolName = typeof callArgs.tool_name === 'string' ? callArgs.tool_name : '';
        if (toolName.length === 0) return toolText(id, 'error: tool_name is required', true);
        const toolArgs =
          callArgs.tool_args && typeof callArgs.tool_args === 'object'
            ? (callArgs.tool_args as Record<string, unknown>)
            : {};
        const r = deps.evaluate(toolName, toolArgs);
        return toolText(
          id,
          JSON.stringify(
            {
              decision: r.decision,
              reason: r.reason,
              matched_rules: r.matchedRules,
              audit_hash: r.hash,
              rules_evaluated: r.rulesEvaluated,
            },
            null,
            2,
          ),
        );
      }
      if (name === 'rulsynor_rules_list') {
        return toolText(id, JSON.stringify(deps.listRules(), null, 2));
      }
      if (name === 'rulsynor_audit_recent') {
        const limit = typeof callArgs.limit === 'number' ? callArgs.limit : 10;
        return toolText(id, JSON.stringify(deps.recentAudit(limit), null, 2));
      }
      return toolText(id, `error: unknown tool "${name ?? ''}"`, true);
    }
    default:
      return fail(id, -32601, `Method not found: ${req.method}`);
  }
}

/** stdio loop: newline-delimited JSON-RPC 2.0. */
export async function runMcpServer(): Promise<void> {
  const deps = createMcpDeps();
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let response: JsonRpcResponse | null;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
        response = fail(req.id ?? null, -32600, 'Invalid Request');
      } else {
        response = handleRequest(req, deps);
      }
    } catch {
      response = fail(null, -32700, 'Parse error');
    }
    if (response !== null) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
  rl.on('close', () => {
    deps.close();
  });
}
