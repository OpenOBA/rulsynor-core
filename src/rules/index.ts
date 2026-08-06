import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PresetRule {
  name: string;
  content: string;
  parsed: Record<string, unknown>;
}

let rulesCache: PresetRule[] | null = null;

export function loadPresetRules(): PresetRule[] {
  if (rulesCache) return rulesCache;
  const dir = join(__dirname);
  const files = readdirSync(dir).filter(f => f.endsWith('.erdl.yaml') || f.endsWith('.erdl.yml'));
  rulesCache = files.map(f => {
    const content = readFileSync(join(dir, f), 'utf-8');
    const parsed = yaml.load(content) as Record<string, unknown>;
    return { name: f, content, parsed };
  });
  return rulesCache;
}

export function toRuleDefinitions(rules: PresetRule[]): Array<{ name: string; when: unknown; then: unknown; version: number }> {
  return rules.map(r => ({
    name: (r.parsed.name as string) || r.name.replace(/\.erdl\.ya?ml$/, ''),
    when: r.parsed.when,
    then: r.parsed.then,
    version: (r.parsed.version as number) || 1,
  }));
}
