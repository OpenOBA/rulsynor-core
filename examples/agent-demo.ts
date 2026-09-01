/**
 * example: Full ReAct Agent with Guard — minimal, runnable demo
 *
 * Uses OpenAI-compatible API. Set OPENAI_API_KEY (or compatible provider
 * via OPENAI_BASE_URL) to run.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   npx tsx examples/agent-demo.ts "List files in the current directory"
 *
 * Works with any OpenAI-compatible endpoint (DeepSeek, Qwen, local vLLM, etc.):
 *   export OPENAI_BASE_URL=https://api.deepseek.com/v1
 *   export OPENAI_API_KEY=sk-...
 *   export OPENAI_MODEL=deepseek-v4-pro
 *   npx tsx examples/agent-demo.ts "Check disk usage"
 */

import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules, runReActLoop, createToolExecutor } from '@rulsynor/core';
import { execSync } from 'child_process';

// ── API Key configuration ──
const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY not set.');
  console.error('   export OPENAI_API_KEY=sk-...');
  console.error('   (Works with any OpenAI-compatible provider: DeepSeek, Qwen, etc.)');
  process.exit(1);
}

// ── LLM function (OpenAI-compatible API) ──
async function callLLM(messages: Array<{ role: string; content: string }>) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
  };

  const choice = data.choices[0]?.message;
  return {
    content: choice?.content || '',
    toolCalls: choice?.tool_calls?.map((tc: { function: { name: string; arguments: string } }) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    })),
  };
}

// ── Tool executors (minimal demo tools) ──
const tools: Record<string, ReturnType<typeof createToolExecutor>> = {
  list_files: createToolExecutor(async (args: Record<string, unknown>) => {
    const dir = (args.path as string) || '.';
    try {
      return execSync(`ls -la "${dir}"`, { encoding: 'utf-8' });
    } catch {
      return `Error listing directory: ${dir}`;
    }
  }),
  exec: createToolExecutor(async (args: Record<string, unknown>) => {
    const cmd = (args.command as string) || '';
    console.log(`  [Tool: exec] ${cmd}`);
    try {
      return execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    } catch (e: any) {
      return `Command failed: ${e.message}`;
    }
  }),
  read_file: createToolExecutor(async (args: Record<string, unknown>) => {
    const path = (args.path as string) || '';
    try {
      return require('fs').readFileSync(path, 'utf-8');
    } catch {
      return `Error reading file: ${path}`;
    }
  }),
  write_file: createToolExecutor(async (args: Record<string, unknown>) => {
    const path = (args.path as string) || '';
    const content = (args.content as string) || '';
    require('fs').writeFileSync(path, content);
    return `File written: ${path}`;
  }),
};

// ── Main ──
async function main() {
  const userMessage = process.argv.slice(2).join(' ') || 'List files in current directory';
  console.log(`\n=== Rulsynor Guard Agent Demo ===\n`);
  console.log(`📋 User: ${userMessage}`);
  console.log(`🤖 Model: ${MODEL}  @ ${BASE_URL}\n`);

  const evaluator = new Evaluator(new GuardStateManager());
  const compiledRules = toCompiledRules(loadPresetRules());

  const result = await runReActLoop({
    llm: callLLM,
    evaluator,
    compiledRules,
    rules: compiledRules.map(r => ({ name: r.name, version: 1 })),
    tools,
    userMessage,
    maxSteps: 8,
    onGuardEval: (decision, auditHash, step) => {
      if (decision !== 'ALLOW') {
        console.log(`  🛡️  Step ${step + 1}: ${decision} — ${auditHash.substring(0, 18)}...`);
      }
    },
    onToolCall: (toolName, args, step) => {
      console.log(`  🔧 Step ${step + 1}: ${toolName}(${JSON.stringify(args).substring(0, 60)})`);
    },
  });

  console.log(`\n───────────────────────────────────────`);
  console.log(`📊 Result: ${result.decision} in ${result.steps} steps`);
  console.log(`📝 Response: ${result.finalResponse}`);
  console.log(`🔗 Audit chain: ${result.auditHashes.length} records sealed\n`);
}

main().catch(console.error);
