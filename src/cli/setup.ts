/**
 * `rulsynor setup` — model configuration (name/baseUrl persisted, API key env-only).
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { createInterface } from 'node:readline/promises';
import { Store } from '../storage/index.js';
import { ensureHome, resolveApiKey, resolvePaths, API_KEY_ENV } from '../config.js';
import { parseFlag } from './flags.js';

/** Show or set model config. The API key is env-only and never printed in full. */
export async function runSetup(args: string[]): Promise<void> {
  const paths = resolvePaths();
  ensureHome(paths.home);
  const store = new Store(paths.dbPath);

  try {
    let modelName = parseFlag(args, 'model');
    let baseUrl = parseFlag(args, 'base-url');

    // Interactive when nothing given on the command line.
    if (modelName === undefined && baseUrl === undefined && !args.includes('--show')) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const current = store.getModelConfig();
        modelName = (
          await rl.question(`Model name [${current.modelName ?? 'gpt-4o-mini'}]: `)
        ).trim();
        baseUrl = (
          await rl.question(`Base URL [${current.baseUrl ?? 'https://api.openai.com/v1'}]: `)
        ).trim();
        modelName = modelName.length > 0 ? modelName : (current.modelName ?? undefined);
        baseUrl = baseUrl.length > 0 ? baseUrl : (current.baseUrl ?? undefined);
      } finally {
        rl.close();
      }
    }

    if (modelName !== undefined || baseUrl !== undefined) {
      store.setModelConfig({
        ...(modelName !== undefined ? { modelName } : {}),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
      });
      console.log('✓ Model config saved.');
    }

    const cfg = store.getModelConfig();
    const key = resolveApiKey();
    console.log('');
    console.log('── rulsynor config ────────────────────────────');
    console.log(`  home:      ${paths.home}`);
    console.log(`  db:        ${paths.dbPath}`);
    console.log(`  rules dir: ${paths.rulesDir ?? '(none — put *.erdl.yaml in ./rules or ~/.rulsynor/rules)'}`);
    console.log(`  model:     ${cfg.modelName ?? 'gpt-4o-mini (default)'}`);
    console.log(`  base url:  ${cfg.baseUrl ?? 'https://api.openai.com/v1 (default)'}`);
    console.log(
      `  api key:   ${key ? `✓ set via ${API_KEY_ENV} (${key.slice(0, 4)}…)` : `✗ set ${API_KEY_ENV} in your environment`}`,
    );
    console.log('───────────────────────────────────────────────');
    if (!key) {
      console.log(`\nNext: export ${API_KEY_ENV}=*** then run \`rulsynor chat\`.`);
    }
  } finally {
    store.close();
  }
}
