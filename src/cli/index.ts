#!/usr/bin/env node
/**
 * rulsynor CLI — download + API key + go.
 *
 * Commands:
 *   chat [--once "msg"]        Interactive chat with the full 7-step method
 *   setup [--model M --base-url U | --show]  Model configuration (API key stays in env)
 *   rules list                 Show loaded rules (preset + user dir)
 *   audit list | audit show <hash-prefix>     Read-only audit viewer (no export)
 *   mcp                        MCP stdio server
 *   demo                       One-shot Guard demo (legacy playground)
 *
 * Legacy form `rulsynor --tool=exec --cmd=...` still runs the demo.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

const HELP = `rulsynor — ERDL-guarded Agent runtime (7-step method, tamper-evident audit)

Usage: rulsynor <command> [options]

Commands:
  chat [--once "msg"]          Chat with the Agent (7-step: intent → plan → evidence →
                               reason → guard → execute → audit). Needs ${'RULSYNOR_API_KEY'}.
  setup [--model M --base-url U | --show]
                               Configure model name/base URL. The API key is read from
                               the environment only — it is never stored.
  rules list                   Show all loaded rules (preset + user rules dir).
  audit list [--limit N]       Recent audit records (read-only view).
  audit show <hash-prefix>     Show one Decision Object (read-only view).
  mcp                          Start the MCP stdio server.
  demo                         One-shot Guard demo (no API key needed).
  help                         Show this help.

Environment:
  RULSYNOR_API_KEY             LLM API key (OpenAI-compatible) — required for chat
  RULSYNOR_HOME                CORE home dir (default ~/.rulsynor)
  RULSYNOR_RULES_DIR           User rules dir (default ./rules or ~/.rulsynor/rules)
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  // Legacy playground form: `rulsynor --tool=exec --cmd=...`
  if (cmd !== undefined && cmd.startsWith('--tool=')) {
    await import('../playground.js');
    return;
  }

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      return;
    case 'demo':
      // Re-dispatch with remaining args so playground sees them.
      process.argv = [process.argv[0], process.argv[1], ...args.slice(1)];
      await import('../playground.js');
      return;
    case 'setup': {
      const { runSetup } = await import('./setup.js');
      await runSetup(args.slice(1));
      return;
    }
    case 'chat': {
      const { runChat } = await import('./chat.js');
      await runChat(args.slice(1));
      return;
    }
    case 'rules': {
      const { runRules } = await import('./rules.js');
      await runRules(args.slice(1));
      return;
    }
    case 'audit': {
      const { runAudit } = await import('./audit.js');
      await runAudit(args.slice(1));
      return;
    }
    case 'mcp': {
      const { runMcpServer } = await import('../mcp/server.js');
      await runMcpServer();
      return;
    }
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`rulsynor: ${msg}`);
  process.exitCode = 1;
});
