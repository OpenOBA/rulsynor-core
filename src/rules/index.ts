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
  rulesCache = [];
  for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf-8');
    // Support YAML multi-document files (--- separator)
    const docs = yaml.loadAll(content) as Array<Record<string, unknown> | null>;
    for (const doc of docs) {
      if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
        const name = (doc.name as string) || f;
        rulesCache.push({ name: `${f}#${name}`, content, parsed: doc });
      }
    }
  }
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

/**
 * Convert preset rules to ERDLRuleSet format for RuleCompiler.
 * Uses a minimal mapping from the YAML structure to the RuleDefinition interface.
 */
export function toERDLRuleSet(rules: PresetRule[]): { protocol: string; version: string; metadata: Record<string, unknown>; rules: Record<string, unknown>[] } {
  const defs: Record<string, unknown>[] = rules.map(r => {
    const p = r.parsed;
    const when = p.when as Record<string, unknown> | undefined;
    const then = p.then as Record<string, unknown> | undefined;
    const conditions = when?.conditions as Array<Record<string, unknown>> | undefined;

    return {
      id: (p.name as string) || r.name.replace(/\.erdl\.ya?ml$/, ''),
      name: (p.name as string) || r.name.replace(/\.erdl\.ya?ml$/, ''),
      description: (p.description as string) || '',
      category: (p.category as string) || 'security',
      priority: (p.priority as number) || 100,
      ring: (p.ring as number) || 0,
      then: (then?.decision as string) || 'DENY',
      message: (then?.instruction as string) || (p.description as string) || '',
      conditions: conditions?.map(c => ({
        field: c.field as string,
        operator: (c.operator as string) || 'eq',
        value: c.value ?? null,
      })) || [],
      conditionLogic: (when?.logic as 'AND' | 'OR') || 'AND',
      enabled: true,
      action: then ? { decision: then.decision as string, reason: (then.instruction as string) || '', ring: (p.ring as number) || 0 } : undefined,
    };
  });

  return { protocol: 'erdl-v1', version: '1.0', metadata: { source: 'rulsynor-core-preset' }, rules: defs };
}
