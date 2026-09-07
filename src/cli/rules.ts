/**
 * `rulsynor rules list` — show preset + user rules and their quality-gate status.
 *
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { loadPresetRules, loadRulesFromDir, toCompiledRules } from '../index.js';
import type { PresetRule } from '../index.js';
import { resolvePaths } from '../config.js';

function printRule(r: PresetRule): void {
  const p = r.parsed;
  const then = (p.then ?? {}) as Record<string, unknown>;
  const name = String(p.name ?? r.name);
  const category = String(p.category ?? 'security');
  const ring = String(p.ring ?? 0);
  const decision = String(then.decision ?? 'DENY');
  console.log(`  - ${name}  [${category} · ring ${ring} · ${decision}]`);
}

export async function runRules(args: string[]): Promise<void> {
  const sub = args[0] ?? 'list';
  if (sub !== 'list') throw new Error('usage: rulsynor rules list');

  const paths = resolvePaths();
  const preset = loadPresetRules();
  const user = paths.rulesDir ? loadRulesFromDir(paths.rulesDir) : [];

  console.log(`Preset rules: ${preset.length}`);
  for (const r of preset) printRule(r);

  console.log(
    `\nUser rules — ${paths.rulesDir ?? '(no rules dir; create ./rules or ~/.rulsynor/rules and drop *.erdl.yaml in)'}: ${user.length}`,
  );
  for (const r of user) printRule(r);

  try {
    const compiled = toCompiledRules([...preset, ...user]);
    console.log(`\n✓ Quality gate: all ${compiled.length} rules load cleanly.`);
  } catch (e: unknown) {
    console.error(`\n✗ Quality gate rejected load:\n${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}
