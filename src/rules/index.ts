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
import { parseErdlDocument } from '../engine/erdl-loader.js';
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
 * True when `parsed` is a canonical ERDL document (language spec v2.0 §2.1):
 * top-level `protocol: "erdl/v2"` + a `rules[]` array. The legacy flat format
 * (one rule per YAML document, `then` as an object) is the pre-spec projection.
 */
export function isCanonicalDocument(parsed: Record<string, unknown>): boolean {
  return parsed.protocol === 'erdl/v2' && Array.isArray(parsed.rules);
}

/**
 * Load ERDL rules from any directory. Accepts BOTH the canonical document format
 * (`protocol`/`version`/`metadata`/`rules[]`) and the legacy flat format (one rule per
 * YAML document). This is the user-facing loader behind "write your own rules, drop
 * them in a folder, they take effect" — see docs/RULE-AUTHORING.md.
 */
export function loadRulesFromDir(dir: string): PresetRule[] {
  const rules: PresetRule[] = [];
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.erdl.yaml') || f.endsWith('.erdl.yml'))
    .sort();
  for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf-8');
    // Support YAML multi-document files (--- separator); the canonical format is a
    // single document per file, the legacy format is one rule per document.
    const docs = yaml.loadAll(content) as Array<Record<string, unknown> | null>;
    for (const doc of docs) {
      if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
        if (isCanonicalDocument(doc)) {
          // One canonical document per file; expand its rules in toCompiledRules.
          const name = ((doc.metadata as Record<string, unknown> | undefined)?.name as
            string) || f;
          rules.push({ name, content, parsed: doc });
        } else {
          const name = (doc.name as string) || f;
          rules.push({ name: `${f}#${name}`, content, parsed: doc });
        }
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

/**
 * Legacy flat-format mapping (pre-spec projection). Kept for backward compatibility
 * with rules authored before the canonical format was finalized. Canonical documents
 * are handled by `toCompiledRules` via `parseErdlDocument` — do NOT pass canonical
 * documents through this function.
 */
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
 * Convert LEGACY flat rules to the legacy ERDLRuleSet format.
 * Deprecated: use `toCompiledRules` (canonical-aware) instead. Preserved for the
 * legacy path only.
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

/** Map a single legacy flat rule (already converted to the ruleset shape) to RuleDefinition. */
function legacyMapToRuleDefinition(r: Record<string, unknown>): RuleDefinition {
  return {
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
  };
}

/**
 * Convert preset/user rules into `CompiledRule[]` — the exact shape consumed by
 * `new Evaluator(new GuardStateManager())`.
 *
 * Canonical documents (language spec v2.0 §2.1) are parsed by `parseErdlDocument`,
 * which maps every spec-defined field (unless/override/message/instruction/explanation/
 * alternative/legal_basis/source_text/correction). Legacy flat rules fall back to the
 * pre-spec mapping for backward compatibility.
 *
 * ```ts
 * import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules } from '@openoba/rulsynor-core';
 *
 * const evaluator = new Evaluator(new GuardStateManager());
 * const rules = toCompiledRules(loadPresetRules());
 * const decision = evaluator.evaluate(rules, {
 *   tool: { name: 'exec', args: { command: 'rm -rf /' } },
 *   sessionId: 's1',
 *   agentId: 'my-agent',
 * });
 * ```
 */
export function toCompiledRules(presetRules: PresetRule[]): RuleDefinition[] {
  const compiled: RuleDefinition[] = [];
  for (const pr of presetRules) {
    if (isCanonicalDocument(pr.parsed)) {
      // Canonical: parse the full document (protocol/version/metadata/rules[]).
      compiled.push(...parseErdlDocument(pr.content).rules);
    } else {
      // Legacy flat: map via the pre-spec path.
      compiled.push(...toERDLRuleSet([pr]).rules.map(legacyMapToRuleDefinition));
    }
  }

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

/**
 * Resolve the merged fallback decision (`metadata.decision`) from canonical documents.
 * Returns the single decision when every canonical document agrees; `undefined` when
 * there is no canonical decision or the documents conflict (callers default to ALLOW).
 */
export function getFallbackDecision(presetRules: PresetRule[]): Decision | undefined {
  const decisions: Decision[] = [];
  for (const pr of presetRules) {
    if (!isCanonicalDocument(pr.parsed)) continue;
    const md = pr.parsed.metadata as { decision?: unknown } | undefined;
    if (md && typeof md.decision === 'string' && md.decision.length > 0) {
      decisions.push(md.decision as Decision);
    }
  }
  const unique = [...new Set(decisions)];
  return unique.length === 1 ? unique[0] : undefined;
}
