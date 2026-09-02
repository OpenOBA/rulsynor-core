/**
 * `rulsynor chat` — interactive terminal chat with the full 7-step method.
 *
 * Download + API key + go: rules come from the bundled presets plus the user
 * rules dir; every guarded tool call lands one tamper-evident Decision Object
 * in the local audit DB (view with `rulsynor audit list` — read-only).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  Evaluator,
  GuardStateManager,
  Store,
  createOpenAiCompatibleLlm,
  createToolExecutor,
  loadPresetRules,
  loadRulesFromDir,
  runReActLoop,
  toCompiledRules,
} from '../index.js';
import type { ToolExecutor } from '../index.js';
import type { LlmToolSchema } from '../llm.js';
import { API_KEY_ENV, ensureHome, resolveApiKey, resolvePaths } from '../config.js';
import { dim, parseFlag } from './flags.js';

const TOOL_TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT = 20_000;

const STEP_LABELS: Record<number, string> = {
  1: '① 理解意图',
  2: '② 制定计划',
  3: '③ 组装依据',
  4: '④ 推理决策',
  5: '⑤ 规则把关',
  6: '⑥ 执行操作',
  7: '⑦ 审计落链',
};

const TOOL_SCHEMAS: LlmToolSchema[] = [
  {
    name: 'exec',
    description: 'Run a shell command on the local machine and return its output.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'The shell command to run' } },
      required: ['command'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from disk and return its content.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path to read' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_dir',
    description: 'List directory entries (files and folders).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory path to list' } },
      required: ['path'],
      additionalProperties: false,
    },
  },
];

function runShell(command: string): Promise<string> {
  return new Promise(done => {
    let settled = false;
    const finish = (s: string): void => {
      if (!settled) {
        settled = true;
        done(s);
      }
    };
    const child = spawn(command, { shell: true, timeout: TOOL_TIMEOUT_MS });
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('error', (e: Error) => finish(`error: ${e.message}`));
    child.on('close', (code: number | null) =>
      finish(`${out.slice(0, OUTPUT_LIMIT)}\n[exit ${code ?? 'unknown'}]`),
    );
  });
}

function buildTools(): Record<string, ToolExecutor> {
  return {
    exec: createToolExecutor(async args => {
      const command = typeof args.command === 'string' ? args.command : '';
      if (command.length === 0) return 'error: exec requires a "command" argument';
      return runShell(command);
    }),
    read_file: createToolExecutor(async args => {
      const p = typeof args.path === 'string' ? args.path : '';
      if (p.length === 0) return 'error: read_file requires a "path" argument';
      try {
        const content = readFileSync(resolve(p), 'utf8');
        return content.length > OUTPUT_LIMIT
          ? `${content.slice(0, OUTPUT_LIMIT)}\n[truncated]`
          : content;
      } catch (e: unknown) {
        return `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }),
    list_dir: createToolExecutor(async args => {
      const p = typeof args.path === 'string' ? args.path : '.';
      try {
        const entries = readdirSync(resolve(p))
          .sort()
          .map(name => {
            try {
              return statSync(resolve(p, name)).isDirectory() ? `${name}/` : name;
            } catch {
              return name;
            }
          });
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      } catch (e: unknown) {
        return `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }),
  };
}

/** Interactive chat, or one-shot with `--once "message"`. */
export async function runChat(args: string[]): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      `${API_KEY_ENV} is not set. Export your LLM API key first (see \`rulsynor setup\`).`,
    );
  }

  const paths = resolvePaths();
  ensureHome(paths.home);
  const store = new Store(paths.dbPath);

  try {
    const modelCfg = store.getModelConfig();
    const presetRules = loadPresetRules();
    const userRules = paths.rulesDir ? loadRulesFromDir(paths.rulesDir) : [];
    const compiled = toCompiledRules([...presetRules, ...userRules]);
    const rulesMeta = compiled.map(r => ({ name: r.name, version: 1 }));

    const llm = createOpenAiCompatibleLlm(modelCfg, apiKey, TOOL_SCHEMAS);
    const evaluator = new Evaluator(new GuardStateManager());
    const tools = buildTools();
    const sessionId = `cli-${Date.now()}`;

    const runOnce = async (message: string): Promise<void> => {
      const result = await runReActLoop({
        llm,
        evaluator,
        compiledRules: compiled,
        rules: rulesMeta,
        tools,
        userMessage: message,
        agentId: 'rulsynor-cli',
        sessionId,
        onStep: (step, detail) =>
          console.log(dim(`   ${STEP_LABELS[step] ?? `step ${step}`} · ${detail}`)),
        onDecisionObject: (doObj, meta) => {
          store.recordAudit({
            sessionId: meta.sessionId,
            agentId: meta.agentId,
            step: meta.step,
            toolName: meta.toolName,
            decision: doObj.result.decision,
            hash: doObj.audit.hash,
            previousHash: doObj.audit.previous_hash,
            decisionObject: doObj,
          });
        },
      });
      console.log(`\nagent> ${result.finalResponse}`);
      console.log(
        dim(
          `   [${result.decision} · ${result.steps} ReAct round(s) · ${result.auditHashes.length} audit record(s) — review: rulsynor audit list]`,
        ),
      );
    };

    const once = parseFlag(args, 'once');
    if (once !== undefined) {
      await runOnce(once);
      return;
    }

    console.log(
      `rulsynor chat — ${compiled.length} rules (${presetRules.length} preset + ${userRules.length} user) · model ${modelCfg.modelName ?? 'gpt-4o-mini'}`,
    );
    console.log(
      dim(
        `rules dir: ${paths.rulesDir ?? '(none)'} · audit db: ${paths.dbPath} · type "exit" to quit`,
      ),
    );

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      for (;;) {
        const line = (await rl.question('\nyou> ')).trim();
        if (line.length === 0) continue;
        if (line === 'exit' || line === 'quit' || line === ':q') break;
        try {
          await runOnce(line);
        } catch (e: unknown) {
          console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      rl.close();
    }
  } finally {
    store.close();
  }
}
