/**
 * ERDL - Document Loader (YAML -> RuleDefinition[]).
 *
 * Parses an `*.erdl.yaml` document (ERDL language spec v2.0 §2.1 top-level format)
 * and maps it to `RuleDefinition[]` objects ready for evaluation. This is the canonical
 * forward half of the parse/evaluate pipeline: `RuleYamlSerializer` emits YAML, this
 * loader reads it back.
 *
 * This file is a port of `repos/erdl/src/erdl-loader.ts` (the MIT reference
 * implementation) into rulsynor-core. The canonical document format is the single
 * source of truth — a flat per-rule YAML document is the legacy projection, NOT the
 * canonical format. Keep this loader byte-faithful to the reference unless the spec
 * itself changes.
 *
 * Supported `when` forms:
 *   - Simple:        `{ logic: "AND"|"OR", conditions: [...] }`
 *   - Expression:    `{ expr: {...} }`  (S-expression JSON shape)
 *   - Catch-all:     `"true"` (empty conditions)
 *   - Decision table: NOT yet supported (throws).
 *
 * @license BSL 1.1
 */

import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import type {
  Decision,
  OverrideLevel,
  RingLevel,
  RuleCategory,
  RuleCondition,
  RuleDefinition,
} from './rule-definition.js';

/** Document-level metadata (ERDL language spec v2.0 §2.2). */
export interface ErdlMetadata {
  name: string;
  description?: string;
  category?: RuleCategory;
  /** Fallback decision used when no rule matches. */
  decision?: Decision;
  tags?: string[];
}

/** A parsed ERDL document (§2.1 top-level structure). */
export interface ErdlDocument {
  protocol: string;
  version: string;
  metadata: ErdlMetadata;
  rules: RuleDefinition[];
}

// ============================================
// Raw YAML shapes (pre-mapping)
// ============================================

interface RawCondition {
  field?: string;
  operator?: string;
  value?: unknown;
  within?: string;
  rate?: string;
  pattern?: string;
  keywords?: string[];
  expr?: unknown;
}

interface RawWhen {
  logic?: string;
  conditions?: RawCondition[];
  expr?: unknown;
  kind?: string;
}

interface RawRule {
  name: string;
  description?: string;
  category?: string;
  priority?: number;
  override?: string;
  ring?: number;
  when?: RawWhen | string;
  then: string;
  message?: string;
  instruction?: string;
  /** Correction target text (CORRECT decision). See note on `correction` below. */
  correction?: string;
  unless?: RawWhen | string | null;
  explanation?: string | { zh: string; en: string };
  alternative?: string | { zh: string; en: string };
  legal_basis?: string;
  source_text?: string;
  enabled?: boolean;
}

interface RawDocument {
  protocol?: string;
  version?: string;
  metadata?: {
    name?: string;
    description?: string;
    category?: string;
    decision?: string;
    tags?: unknown[];
  };
  rules?: RawRule[];
}

// ============================================
// Mapping helpers
// ============================================

/** Derive a machine-friendly rule id from its name (e.g. "SEC-001-refund-limit" -> "sec_001_refund_limit"). */
function deriveId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
}

function mapCondition(c: RawCondition): RuleCondition {
  const cond: RuleCondition = {};
  if (c.field !== undefined) cond.field = c.field;
  if (c.operator !== undefined) cond.operator = c.operator as RuleCondition['operator'];
  if (c.value !== undefined) cond.value = c.value;
  if (c.within !== undefined) cond.within = c.within;
  if (c.rate !== undefined) cond.rate = c.rate;
  if (c.pattern !== undefined) cond.pattern = c.pattern;
  if (c.keywords !== undefined) cond.keywords = c.keywords;
  if (c.expr !== undefined) cond.expr = c.expr;
  return cond;
}

interface MappedWhen {
  conditions: RuleCondition[];
  conditionLogic?: 'AND' | 'OR';
}

function mapWhen(when: RawWhen | string | undefined): MappedWhen {
  if (when === undefined || when === null) return { conditions: [] };
  if (typeof when === 'string') {
    // when: "true" - catch-all, matches every operation
    return { conditions: [] };
  }
  if (when.kind === 'decision_table') {
    throw new Error(
      'decision table loading is not yet supported; compile it to Simple or Expression form first',
    );
  }
  if (when.expr !== undefined) {
    // Expression form: when.expr -> a single condition carrying the S-expression
    return { conditions: [{ expr: when.expr }] };
  }
  if (Array.isArray(when.conditions)) {
    return {
      conditions: when.conditions.map(mapCondition),
      conditionLogic: when.logic === 'OR' ? 'OR' : 'AND',
    };
  }
  return { conditions: [] };
}

function mapUnless(unless: RawWhen | string | null | undefined): RuleDefinition['unless'] {
  if (unless === undefined || unless === null) return undefined;
  if (typeof unless === 'string') return { conditions: [] };
  const mapped = mapWhen(unless);
  return { logic: mapped.conditionLogic, conditions: mapped.conditions };
}

function mapRule(raw: RawRule, defaultCategory: RuleCategory): RuleDefinition {
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error('A rule is missing a non-empty "name" field');
  }
  if (typeof raw.then !== 'string' || raw.then.length === 0) {
    throw new Error(`Rule "${raw.name}" is missing a non-empty "then" field`);
  }
  const when = mapWhen(raw.when);
  const category = (raw.category ?? defaultCategory ?? 'custom') as RuleCategory;
  return {
    id: deriveId(raw.name),
    name: raw.name,
    description: raw.description ?? '',
    category,
    conditions: when.conditions,
    conditionLogic: when.conditionLogic,
    action: {
      decision: raw.then as Decision,
      instruction: raw.instruction,
      reason: raw.message,
      ring: (raw.ring as RingLevel) ?? undefined,
      explanation: raw.explanation,
      alternative: raw.alternative,
      correction: raw.correction,
    },
    priority: raw.priority ?? 100,
    enabled: raw.enabled ?? true,
    override: (raw.override as OverrideLevel) ?? undefined,
    legal_basis: raw.legal_basis ?? null,
    source_text: raw.source_text ?? null,
    unless: mapUnless(raw.unless),
  };
}

// ============================================
// Public API
// ============================================

/**
 * Parse an ERDL YAML document string into `RuleDefinition[]`.
 *
 * NOTE on `correction`: the language spec v2.0 §7.0.3 output contract requires
 * `primary_correction` for CORRECT decisions, and the product spec DO maps
 * `matched_rules[].correction`. The language spec §4.1 rule-field table omits a
 * `correction` field (it lists `message`/`instruction`/`alternative` but not
 * `correction`) — a spec gap tracked for amendment. Until then, this loader reads an
 * optional rule-level `correction` field directly so CORRECT rules carry their fix text.
 */
export function parseErdlDocument(yamlText: string): ErdlDocument {
  const raw = yaml.load(yamlText) as RawDocument | null;
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('ERDL document is empty or not a YAML mapping');
  }
  if (raw.protocol !== 'erdl/v2') {
    throw new Error(`Unsupported protocol "${String(raw.protocol)}"; expected "erdl/v2"`);
  }
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('Missing or invalid version field');
  }

  const metadata: ErdlMetadata = {
    name: raw.metadata?.name ?? '',
    description: raw.metadata?.description,
    category: (raw.metadata?.category as RuleCategory) ?? undefined,
    decision: (raw.metadata?.decision as Decision) ?? undefined,
    tags: raw.metadata?.tags?.map(t => String(t)),
  };

  const rules = (raw.rules ?? []).map(r => mapRule(r, metadata.category ?? 'custom'));

  return { protocol: raw.protocol, version: raw.version, metadata, rules };
}

/** Read an ERDL document from a file path. */
export function loadErdlFile(filePath: string): ErdlDocument {
  return parseErdlDocument(fs.readFileSync(filePath, 'utf-8'));
}
