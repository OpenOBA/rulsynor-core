/**
 * Rulsynor — Rule YAML Serializer
 *
 * Converts RuleConfig DB entities to ERDL SPEC v2.0 §11 YAML files.
 *
 * SPEC v2.0 §11 format ironclad rules (F1-F8):
 *   F1 top-level order: protocol → version → metadata → rules
 *   F2 metadata: name → description → category → decision → tags
 *   F3 rules[]: name → description → priority → override → ring → when → then → message → instruction → unless
 *   F4 when.conditions[]: field → operator → value
 *   F6 natural-language strings double-quoted / enums bare / tags bare
 *   F7 2-space indentation
 *   F8 protocol must come first
 *
 * Implementation strategy: not relying on yaml.dump() (uncontrollable JS object key order and quoting),
 * instead using a custom template to concatenate field by field, ensuring field order and quoting style satisfy SPEC v2.0 §11.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-07-20 · P2 DB → FS sync
 * @rework 2026-07-26 · template-splicing aligned with SPEC v2.0 §11 F1-F8
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RuleConfig } from './rule-config.js';
import { RulsynorLogger } from './logger.js';
import { fromSExpr } from './expr-tree/s-expression.js';

const log = new RulsynorLogger('RuleYamlSerializer');

// ============================================
// Types
// ============================================

interface Spec5Metadata {
  name: string;
  description: string;
  category: string;
  decision: string;
  /** SPEC v2.0 §11 F2: tags is a bare-word list, optional */
  tags?: unknown[];
}

interface Spec5Rule {
  name: string;
  description?: string;
  priority?: number;
  override?: string;
  ring?: number;
  when: Record<string, unknown> | string;
  then: string;
  message?: string;
  instruction?: string;
  unless?: Record<string, unknown> | string;
  explanation?: string | { zh: string; en: string };
  alternative?: string | { zh: string; en: string };
  /** Source of the law/regulation the rule is based on (e.g. Article X of the "XX Administrative Measures") */
  legal_basis?: string;
  /** Full text of the original regulation the rule is based on */
  source_text?: string;
}

interface Spec5Document {
  protocol: string;
  version: string;
  metadata: Spec5Metadata;
  rules: Spec5Rule[];
}

/** SPEC v2.0 §11 structured data extracted from rule.content */
export interface ExtractedSpec5 {
  protocol: string;
  version: string;
  metadata: Record<string, unknown>;
  rules: Record<string, unknown>[];
}

// ============================================
// Serializer
// ============================================

export class RuleYamlSerializer {
  private readonly rulesDir: string;

  constructor(rulesDir: string) {
    this.rulesDir = rulesDir;
  }

  /**
   * Convert a RuleConfig DB entity to SPEC v2.0 §11 YAML string.
   *
   * Template-splicing: concatenate field by field per F1-F8, not relying on yaml.dump().
   * Prioritizes reading the full SPEC structure from rule.content; if content is not the SPEC5 nested format,
   * constructs a minimal structure from DB fields.
   */
  toSpec5Yaml(rule: RuleConfig): string {
    return this.serializeSpec5(this.extractSpec5(rule));
  }

  /**
   * Write a rule to the file system:
   *   ~/.openoba/rules/{category}/{safe-name}.erdl.yaml
   *
   * Returns the written file path.
   */
  /**
   * P0-26 fix: Validate category against whitelist to prevent path traversal.
   * Without this, category="../../../etc" could write rule files to arbitrary directories.
   */
  private static readonly VALID_CATEGORIES = new Set([
    'coding',
    'engineering',
    'security',
    'testing',
    'performance',
    'writing',
    'design',
    'observability',
    'compliance',
    'accessibility',
    'custom',
  ]);

  private validateCategory(category: string): string {
    const cat = category || 'custom';
    if (!RuleYamlSerializer.VALID_CATEGORIES.has(cat)) {
      throw new Error(
        `Invalid category: "${cat}". Must be one of: ${[...RuleYamlSerializer.VALID_CATEGORIES].join(', ')}`,
      );
    }
    return cat;
  }

  writeRuleFile(rule: RuleConfig): string {
    // P0-26 fix: validate category before path.join to prevent path traversal
    const category = this.validateCategory(rule.category || 'custom');
    const categoryDir = path.join(this.rulesDir, category);
    // Defense in depth: verify resolved path stays within rulesDir
    const resolvedDir = path.resolve(categoryDir);
    const resolvedRoot = path.resolve(this.rulesDir);
    if (resolvedDir !== resolvedRoot && !resolvedDir.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Path traversal detected: category="${category}" escapes rules directory`);
    }
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    const safeName = rule.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const filePath = path.join(categoryDir, `${safeName}.erdl.yaml`);

    const yamlStr = this.toSpec5Yaml(rule);
    fs.writeFileSync(filePath, yamlStr, 'utf-8');
    log.log(`[yaml-sync] Wrote: ${filePath}`);
    return filePath;
  }

  /**
   * Remove a rule's YAML file from the file system.
   */
  removeRuleFile(name: string, category: string): void {
    // P0-26 fix: validate category before path operations
    const safeCategory = this.validateCategory(category || 'custom');
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const dir = path.join(this.rulesDir, safeCategory);
    const filePath = path.join(dir, `${safeName}.erdl.yaml`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.log(`[yaml-sync] Removed: ${filePath}`);
    }
  }

  /**
   * Full sync: write all DB rules to the file system.
   * Returns count of written files.
   */
  syncAll(rules: RuleConfig[]): number {
    let count = 0;
    const writtenDirs = new Set<string>();

    for (const rule of rules) {
      try {
        this.writeRuleFile(rule);
        writtenDirs.add(path.join(this.rulesDir, rule.category || 'custom'));
        count++;
      } catch (err) {
        log.log(
          `[yaml-sync] Error writing rule "${rule.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    log.log(`[yaml-sync] Synced ${count} rules to ${this.rulesDir}`);
    return count;
  }

  // ============================================
  // Private: structured document (for programmatic consumption, structure aligned with SPEC v2.0 §11 F2)
  // ============================================

  /** Return the SPEC v2.0 §11 structured document object (metadata no longer includes priority/ring/enabled/source). */
  toSpec5Document(rule: RuleConfig): Spec5Document {
    const data = this.extractSpec5(rule);
    const m = data.metadata;
    const docMetadata: Spec5Metadata = {
      name: String(m.name ?? ''),
      description: String(m.description ?? ''),
      category: String(m.category ?? 'custom'),
      decision: String(m.decision ?? 'ALLOW'),
    };
    if (m.tags !== undefined) docMetadata.tags = m.tags as unknown[];
    return {
      protocol: data.protocol,
      version: data.version,
      metadata: docMetadata,
      rules: data.rules.map(r => this.toSpec5Rule(r)),
    };
  }

  private toSpec5Rule(r: Record<string, unknown>): Spec5Rule {
    const out: Spec5Rule = {
      name: String(r.name ?? ''),
      when: (r.when as Spec5Rule['when']) ?? 'true',
      then: String(r.then ?? 'ALLOW'),
    };
    if (r.description !== undefined) out.description = String(r.description);
    if (r.priority !== undefined) out.priority = Number(r.priority);
    const ov = this.normalizeOverride(r.override);
    if (ov) out.override = ov;
    if (r.ring !== undefined) out.ring = Number(r.ring);
    if (r.message !== undefined) out.message = String(r.message);
    if (r.instruction !== undefined) out.instruction = String(r.instruction);
    if (r.unless !== undefined) out.unless = r.unless as Spec5Rule['unless'];
    if (r.explanation !== undefined) out.explanation = r.explanation as Spec5Rule['explanation'];
    if (r.alternative !== undefined) out.alternative = r.alternative as Spec5Rule['alternative'];
    if (r.legal_basis !== undefined) out.legal_basis = String(r.legal_basis);
    if (r.source_text !== undefined) out.source_text = String(r.source_text);
    return out;
  }

  // ============================================
  // Private: extraction + template serialization
  // ============================================

  /**
   * Extract the SPEC v2.0 §11 structure from a RuleConfig.
   * Prioritizes the full { protocol, version, metadata, rules } already in content;
   * otherwise constructs a minimal structure from DB fields (compatible with flat/legacy content).
   */
  private extractSpec5(rule: RuleConfig): ExtractedSpec5 {
    const content = (rule.content as Record<string, unknown>) ?? {};

    if (
      content.protocol === 'erdl/v2' &&
      Array.isArray(content.rules) &&
      content.rules.length > 0
    ) {
      return {
        protocol: String(content.protocol),
        version: String(content.version ?? '2.0.0'),
        metadata: (content.metadata as Record<string, unknown>) ?? {},
        rules: content.rules as Record<string, unknown>[],
      };
    }

    // Fallback: flat / legacy content → construct minimal SPEC v2.0 §11
    const raw = content;
    const name = (raw.name as string) ?? rule.name;
    const decision = (raw.then as string) ?? rule.decision ?? 'ALLOW';
    const metadata: Record<string, unknown> = {
      name,
      description: (raw.description as string) ?? name,
      category: (raw.category as string) ?? rule.category ?? 'custom',
      decision,
    };
    const ruleEntry: Record<string, unknown> = {
      name,
      priority: (raw.priority as number) ?? rule.priority ?? 100,
      ring: rule.ring_level ?? 3,
      when: raw.when ?? 'true',
      then: decision,
      message: (raw.message as string) ?? (raw.instruction as string) ?? '',
    };
    if (raw.override !== undefined) ruleEntry.override = raw.override;
    if (raw.unless !== undefined) ruleEntry.unless = raw.unless;
    if (raw.instruction !== undefined) ruleEntry.instruction = raw.instruction;
    if (raw.explanation !== undefined) ruleEntry.explanation = raw.explanation;
    if (raw.alternative !== undefined) ruleEntry.alternative = raw.alternative;
    return { protocol: 'erdl/v2', version: '2.0.0', metadata, rules: [ruleEntry] };
  }

  /**
   * Template-splicing: generate the YAML string line by line per F1-F8.
   * Public so template-engine can produce SPEC v2.0 §11 YAML without a RuleConfig entity.
   */
  serializeSpec5(data: ExtractedSpec5): string {
    const lines: string[] = [];

    // F1 / F8: protocol at the start, followed by version
    lines.push(`protocol: ${this.q(data.protocol)}`);
    lines.push(`version: ${this.q(data.version)}`);
    lines.push('');

    // F2: metadata: name → description → category → decision → tags
    const m = data.metadata;
    lines.push('metadata:');
    lines.push(`  name: ${this.q(m.name)}`);
    if (m.description !== undefined) lines.push(`  description: ${this.q(m.description)}`);
    if (m.category !== undefined) lines.push(`  category: ${this.bare(m.category)}`);
    if (m.decision !== undefined) lines.push(`  decision: ${this.bare(m.decision)}`);
    const tagsLine = this.serializeTags(m.tags);
    if (tagsLine !== null) lines.push(`  tags: ${tagsLine}`);
    lines.push('');

    // F3: rules
    lines.push('rules:');
    for (const rule of data.rules) {
      lines.push(...this.serializeRule(rule));
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Serialize a single rule (F3 field order).
   * Indentation: rules top level 0, rule item `- ` at 2, rule fields at 4.
   */
  private serializeRule(rule: Record<string, unknown>): string[] {
    const lines: string[] = [];
    // F3: name → description → priority → override → ring → when → then → message → instruction → unless
    lines.push(`  - name: ${this.q(rule.name)}`);
    if (rule.description !== undefined) lines.push(`    description: ${this.q(rule.description)}`);
    if (rule.priority !== undefined) lines.push(`    priority: ${this.bare(rule.priority)}`);
    const ov = this.normalizeOverride(rule.override);
    if (ov) lines.push(`    override: ${this.bare(ov)}`);
    if (rule.ring !== undefined) lines.push(`    ring: ${this.bare(rule.ring)}`);
    // when
    lines.push(...this.serializeWhenOrUnless('when', rule.when, 4));
    // then
    if (rule.then !== undefined) lines.push(`    then: ${this.bare(rule.then)}`);
    // message
    if (rule.message !== undefined) lines.push(`    message: ${this.q(rule.message)}`);
    // instruction
    if (rule.instruction !== undefined) lines.push(`    instruction: ${this.q(rule.instruction)}`);
    // unless
    if (rule.unless !== undefined)
      lines.push(...this.serializeWhenOrUnless('unless', rule.unless, 4));
    // explanation / alternative (optional, placed at the end)
    if (rule.explanation !== undefined) {
      lines.push(...this.serializeBilingual('explanation', rule.explanation, 4));
    }
    if (rule.alternative !== undefined) {
      lines.push(...this.serializeBilingual('alternative', rule.alternative, 4));
    }
    // legal_basis / source_text (legal basis + original text, placed at the end)
    if (rule.legal_basis !== undefined) lines.push(`    legal_basis: ${this.q(rule.legal_basis)}`);
    if (rule.source_text !== undefined) lines.push(`    source_text: ${this.q(rule.source_text)}`);
    return lines;
  }

  /**
   * Serialize a when / unless block (same structure).
   * Supports three forms (by priority):
   *  - S-expression expression tree (when is a tree at the top level)
   *  - flat { logic, conditions: [...] } (Simple projection)
   *  - string 'true' / other string
   * F4: conditions[]: field → operator → value
   */
  private serializeWhenOrUnless(key: 'when' | 'unless', block: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent);
    const lines: string[] = [];

    if (block === undefined || block === null || block === 'true') {
      // the string 'true' uses single quotes to preserve semantics, avoiding YAML parsing it as boolean
      lines.push(`${pad}${key}: 'true'`);
      return lines;
    }

    if (typeof block === 'string') {
      lines.push(`${pad}${key}: ${this.q(block)}`);
      return lines;
    }

    if (typeof block === 'object' && !Array.isArray(block)) {
      const w = block as Record<string, unknown>;

      // SPEC v2.0 §12 authoritative: when.expr wrapped form ({ expr: {tree} })
      if ('expr' in w) {
        try {
          const inner = w.expr;
          fromSExpr(inner);
          lines.push(`${pad}${key}:`);
          lines.push(`${pad}  expr:`);
          lines.push(...this.serializeSExprTree(inner, indent + 4));
          return lines;
        } catch {
          // not a valid expression tree, fall through to the flat path
        }
      }

      // §12 Expression projection + compatible form: when is an S-expression expression tree at the top level
      // (no conditions / logic / expr keys, try serializing as a tree; fall back to flat on failure)
      if (!('conditions' in w) && !('logic' in w) && !('expr' in w)) {
        try {
          fromSExpr(w);
          lines.push(`${pad}${key}:`);
          lines.push(...this.serializeSExprTree(w, indent + 2));
          return lines;
        } catch {
          // not a valid S-expression, fall through to the flat path
        }
      }

      lines.push(`${pad}${key}:`);
      lines.push(`${pad}  logic: ${this.bare(w.logic ?? 'AND')}`);
      const conds = w.conditions as Array<Record<string, unknown>> | undefined;
      if (conds && Array.isArray(conds) && conds.length > 0) {
        lines.push(`${pad}  conditions:`);
        for (const c of conds) {
          lines.push(`${pad}    - field: ${this.q(c.field)}`);
          lines.push(`${pad}      operator: ${this.bare(c.operator ?? 'eq')}`);
          lines.push(`${pad}      value: ${this.serializeValue(c.value)}`);
        }
      }
      return lines;
    }

    // fallback
    lines.push(`${pad}${key}: 'true'`);
    return lines;
  }

  /**
   * Recursively serialize an S-expression expression tree into YAML (key name is the node, children nested).
   * Consistent with the toSExpr spec:
   * - bare value (number/string/boolean/null) = leaf, use serializeValue directly
   * - { field: "path" } / { var: "path" } = field/var node
   * - { <op>: [ ...children ] } = operator node, child node array inlined
   * - { <op>: { unit, base, amount } } = parameterized node (date_add/date_part)
   *
   * Indentation level is controlled by the caller; returned line by line here.
   */
  private serializeSExprTree(node: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent);
    const lines: string[] = [];

    // leaf: bare value
    if (node === null || typeof node !== 'object') {
      lines.push(`${pad}${this.serializeValue(node)}`);
      return lines;
    }
    if (Array.isArray(node)) {
      // child node array: each element on its own line (list item)
      for (const child of node) {
        lines.push(...this.serializeSExprTreeListItem(child, indent));
      }
      return lines;
    }

    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);

    // single-field node: field / var / parameterized object
    if (keys.length === 1) {
      const k = keys[0];
      const v = obj[k];

      if (k === 'field' || k === 'var') {
        lines.push(`${pad}${k}: ${this.q(v)}`);
        return lines;
      }

      // parameterized node (date_add / date_part: { unit, base, amount }/{ unit, arg })
      // child node array (compare/string/arith/in/between/days_between/quantifier/aggregate etc.)
      if (Array.isArray(v)) {
        lines.push(`${pad}${k}:`);
        for (const child of v) {
          lines.push(...this.serializeSExprTreeListItem(child, indent + 2));
        }
        return lines;
      }

      if (typeof v === 'object' && v !== null) {
        // parameterized object (date_add/date_part/quantifier)
        lines.push(`${pad}${k}:`);
        lines.push(...this.serializeParamObject(v as Record<string, unknown>, indent + 2));
        return lines;
      }

      // single key but bare value (theoretically never a valid fromSExpr tree, but fallback)
      lines.push(`${pad}${k}: ${this.serializeValue(v)}`);
      return lines;
    }

    // fallback: multi-key object (should not appear, serialized as map)
    for (const [k, v] of Object.entries(obj)) {
      lines.push(`${pad}${k}: ${this.serializeValue(v)}`);
    }
    return lines;
  }

  /**
   * Serialize a parameterized object (value of date_add/date_part/quantifier, e.g. { unit, base, amount }).
   * unit/binding are bare words, other fields (base/amount/arg) serialized recursively, avoiding [object Object].
   */
  private serializeParamObject(inner: Record<string, unknown>, indent: number): string[] {
    const pad = ' '.repeat(indent);
    const lines: string[] = [];
    for (const [ik, iv] of Object.entries(inner)) {
      if (ik === 'unit' || ik === 'binding') {
        lines.push(`${pad}${ik}: ${this.bare(iv)}`);
      } else if (typeof iv === 'object' && iv !== null && !Array.isArray(iv)) {
        lines.push(`${pad}${ik}:`);
        lines.push(...this.serializeSExprTree(iv, indent + 2));
      } else if (Array.isArray(iv)) {
        lines.push(`${pad}${ik}:`);
        for (const child of iv) {
          lines.push(...this.serializeSExprTreeListItem(child, indent + 2));
        }
      } else {
        lines.push(`${pad}${ik}: ${this.serializeValue(iv)}`);
      }
    }
    return lines;
  }

  /** List item serialization: each element in the child node array (non-leaf uses `- <content>` form) */
  private serializeSExprTreeListItem(child: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent);
    const lines: string[] = [];

    if (child === null || typeof child !== 'object') {
      // leaf bare value: `- "value"` / `- 123`
      lines.push(`${pad}- ${this.serializeValue(child)}`);
      return lines;
    }

    const obj = child as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1) {
      const k = keys[0];
      const v = obj[k];
      if (k === 'field' || k === 'var') {
        lines.push(`${pad}- ${k}: ${this.q(v)}`);
        return lines;
      }
      if (Array.isArray(v)) {
        lines.push(`${pad}- ${k}:`);
        for (const c of v) {
          lines.push(...this.serializeSExprTreeListItem(c, indent + 2));
        }
        return lines;
      }
      if (typeof v === 'object' && v !== null) {
        // single key + object value (parameterized node like date_add/date_part/quantifier):
        // directly serialize the parameterized object fields, avoiding [object Object] or duplicate key names
        lines.push(`${pad}- ${k}:`);
        lines.push(...this.serializeParamObject(v as Record<string, unknown>, indent + 2));
        return lines;
      }
      lines.push(`${pad}- ${k}: ${this.serializeValue(v)}`);
      return lines;
    }

    // fallback
    lines.push(`${pad}- ${this.serializeValue(child)}`);
    return lines;
  }

  /** Serialize conditions[].value: strings double-quoted, array strings double-quoted, numbers/booleans bare. */
  private serializeValue(val: unknown): string {
    if (val === undefined || val === null) return '""';
    if (Array.isArray(val)) {
      return `[${val.map(v => (typeof v === 'string' ? this.q(v) : this.bare(v))).join(', ')}]`;
    }
    if (typeof val === 'string') return this.q(val);
    return this.bare(val);
  }

  /** Serialize explanation/alternative: strings double-quoted; { zh, en } object output as a block map. */
  private serializeBilingual(key: string, val: unknown, indent: number): string[] {
    const pad = ' '.repeat(indent);
    if (typeof val === 'string') {
      return [`${pad}${key}: ${this.q(val)}`];
    }
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const lines = [`${pad}${key}:`];
      for (const [k, v] of Object.entries(obj)) {
        lines.push(`${pad}  ${k}: ${this.q(v)}`);
      }
      return lines;
    }
    return [`${pad}${key}: ${this.q(val)}`];
  }

  // ============================================
  // Private: scalar formatting helpers
  // ============================================

  /** Wrap natural-language/identifier strings in double quotes, escaping YAML special characters. */
  private q(val: unknown): string {
    if (val === undefined || val === null) return '""';
    const s = String(val);
    const escaped = s
      .replace(/\\/g, '\\\\') // escape backslash first
      .replace(/"/g, '\\"') // double quote
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }

  /** Bare word (enum/number/identifier), unquoted. */
  private bare(val: unknown): string {
    return String(val);
  }

  /** tags bare-word list: [tag1, tag2, ...]; empty or missing returns null (omit the line). */
  private serializeTags(val: unknown): string | null {
    if (val === undefined || val === null) return null;
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      return `[${val.map(v => this.bare(v)).join(', ')}]`;
    }
    return this.bare(val);
  }

  /**
   * Normalize override: boolean → string, legacy value → canonical.
   */
  private normalizeOverride(val: unknown): string | undefined {
    if (val === true) return 'high';
    if (val === false || val === null || val === undefined) return undefined;
    const s = String(val);
    if (['critical', 'high', 'normal', 'low'].includes(s)) return s;
    if (s === 'true') return 'high';
    return undefined;
  }
}
