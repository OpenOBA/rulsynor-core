/**
 * CORE configuration resolution — home dir, DB path, user rules dir, API key.
 *
 * Design decisions (2026-09-02):
 * - Home defaults to `~/.rulsynor` (override: RULSYNOR_HOME).
 * - The API key comes from the environment (RULSYNOR_API_KEY) and is NEVER
 *   persisted — CORE stores model name/baseUrl only (see storage/index.ts).
 * - User rules dir resolution order: RULSYNOR_RULES_DIR env > ./rules (cwd) > ~/.rulsynor/rules.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const HOME_ENV = 'RULSYNOR_HOME';
export const RULES_DIR_ENV = 'RULSYNOR_RULES_DIR';
export const API_KEY_ENV = 'RULSYNOR_API_KEY';

export interface RulsynorPaths {
  /** CORE home directory (DB + shared rules). */
  home: string;
  /** SQLite database file (node:sqlite). */
  dbPath: string;
  /** Resolved user rules directory, or null when none exists yet. */
  rulesDir: string | null;
}

/** Resolve CORE paths from the environment. Pure — creates nothing on disk. */
export function resolvePaths(): RulsynorPaths {
  const envHome = process.env[HOME_ENV];
  const home = envHome && envHome.trim().length > 0 ? resolve(envHome) : join(homedir(), '.rulsynor');
  return {
    home,
    dbPath: join(home, 'rulsynor.db'),
    rulesDir: resolveRulesDir(home),
  };
}

function resolveRulesDir(home: string): string | null {
  const fromEnv = process.env[RULES_DIR_ENV];
  if (fromEnv && fromEnv.trim().length > 0) return resolve(fromEnv);
  const local = resolve(process.cwd(), 'rules');
  if (existsSync(local)) return local;
  const shared = join(home, 'rules');
  if (existsSync(shared)) return shared;
  return null;
}

/** Create the home directory when missing. Idempotent. */
export function ensureHome(home: string): void {
  if (!existsSync(home)) mkdirSync(home, { recursive: true });
}

/** Read the API key from the environment. Returns undefined when unset/blank. */
export function resolveApiKey(): string | undefined {
  const key = process.env[API_KEY_ENV];
  return key && key.trim().length > 0 ? key : undefined;
}
