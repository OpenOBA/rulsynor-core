import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';
import type {
  RuleDefinition,
  RuleCategory,
  ConditionOperator,
  Decision,
  RingLevel,
} from '../engine/rule-definition.js';
import { ruleQualityGate } from '../engine/rule-quality-gate.js';

// eval('import.meta') avoids Jest's static SyntaxError on import.meta in CJS wrapper.
// In Node ESM, import.meta.url is available. In Jest, eval is never reached.
const _dirname: string = (() => {
  try {
    return dirname(new Function('return import.meta.url')());
  } catch {
    return join(process.cwd(), 'src', 'rules');
  }
})();

export interface PresetRule {
  name: string;
  content: string;
  parsed: Record<string, unknown>;
}

let rulesCache: PresetRule[] | null = null;

/**
 * Load ERDL rule documents (*.erdl.yaml / *.erdl.yml, multi-doc supported) from any
 * directory. This is the user-facing loader behind "write your own rules, drop them
 * in a folder, they take effect" — see docs/RULE-AUTHORING.md.
 */
export function loadRulesFromDir(dir: string): PresetRule[] {
  const rules: PresetRule[] = [];
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.erdl.yaml') || f.endsWith('.erdl.yml'))
    .sort();
  for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf-8');
    // Support YAML multi-document files (--- separator)
    const docs = yaml.loadAll(content) as Array<Record<string, unknown> | null>;
    for (const doc of docs) {
      if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
        const name = (doc.name as string) || f;
        rules.push({ name: `${f}#${name}`, content, parsed: doc });
      }
    }
  }
  return rules;
}

export function loadPresetRules(): PresetRule[] {
  if (rulesCache) return rulesCache;
  rulesCache = loadRulesFromDir(join(_dirname));
  return rulesCache;
}

export function toRuleDefinitions(
  rules: PresetRule[],
): Array<{ name: string; when: unknown; then: unknown; version: number }> {
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
export function toERDLRuleSet(rules: PresetRule[]): {
  protocol: string;
  version: string;
  metadata: Record<string, unknown>;
  rules: Record<string, unknown>[];
} {
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
      conditions:
        conditions?.map(c => ({
          field: c.field as string,
          operator: (c.operator as string) || 'eq',
          value: c.value ?? null,
        })) || [],
      conditionLogic: ((when?.logic || when?.conditionLogic) as 'AND' | 'OR') || 'AND',
      enabled: true,
      action: then
        ? {
            decision: then.decision as string,
            reason: (then.instruction as string) || '',
            ring: (p.ring as number) || 0,
            alternative: then.alternative
              ? typeof then.alternative === 'string'
                ? then.alternative
                : (then.alternative as Record<string, string>).en ||
                  JSON.stringify(then.alternative)
              : undefined,
            correction: (then.correction as string) || undefined,
          }
        : undefined,
    };
  });

  return {
    protocol: 'erdl/v2',
    version: '2.0.0',
    metadata: { source: 'rulsynor-core-preset' },
    rules: defs,
  };
}

/**
 * Convert preset rules into `CompiledRule[]` — the exact shape consumed by
 * `new Evaluator(new GuardStateManager())`.
 *
 * This is the blessed entry point for using the bundled rules:
 *
 * ```ts
 * import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules } from '@openoba/rulsynor-core';
 *
 * const evaluator = new Evaluator(new GuardStateManager());
 * const rules = toCompiledRules(loadPresetRules());
 * const decision = evaluator.evaluate(rules, {
 *   context: { tool: { name: 'exec', args: { command: 'rm -rf /' } } },
 *   sessionId: 's1',
 *   agentId: 'my-agent',
 * });
 * ```
 */
export function toCompiledRules(presetRules: PresetRule[]): RuleDefinition[] {
  const compiled: RuleDefinition[] = toERDLRuleSet(presetRules).rules.map(r => ({
    id: (r.id as string) || (r.name as string),
    name: (r.name as string) || (r.id as string),
    description: (r.description as string) || '',
    category: (r.category as RuleCategory) || 'security',
    priority: (r.priority as number) || 100,
    enabled: (r.enabled as boolean) ?? true,
    conditions: ((r.conditions as Array<Record<string, unknown>>) || []).map(c => ({
      field: (c.field as string) || '',
      operator: (c.operator as ConditionOperator) || 'eq',
      value: c.value ?? undefined,
    })),
    conditionLogic: (r.conditionLogic as 'AND' | 'OR') || 'AND',
    action: {
      decision: (r.then as Decision) || 'DENY',
      reason: (r.message as string) || (r.description as string) || 'Rule matched',
      ring: (r.ring as RingLevel) || 0,
      alternative: (r.action as Record<string, unknown> | undefined)?.alternative as
        string | undefined,
      correction: (r.action as Record<string, unknown> | undefined)?.correction as
        string | undefined,
    },
  }));

  // SPEC v2.0 §16 load-time quality gate: error-level violations fail-close and reject load
  const report = ruleQualityGate.check(compiled);
  if (report.errors > 0) {
    const errLines = report.details
      .filter(d => d.issues.some(i => i.level === 'error'))
      .map(
        d =>
          `  ${d.ruleName}: ${d.issues
            .filter(i => i.level === 'error')
            .map(i => i.code)
            .join(', ')}`,
      )
      .join('\n');
    throw new Error(
      `Rule quality gate rejected load (${report.errors} error-level violation(s)):\n${errLines}`,
    );
  }

  return compiled;
}
