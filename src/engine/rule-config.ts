/**
 * rule-config — pure type definition of RuleConfig (stripped of TypeORM entity decorators)
 *
 * The original rulsynor RuleConfig is a TypeORM entity (@Entity/@Column); core is zero-dependency,
 * so it becomes a pure TS interface (same fields, decorators removed), used by rule YAML serialization and storage interfaces.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-21 (M2 stripped rule-config.entity dependency)
 * @license BSL 1.1
 */

export interface RuleConfig {
  id: string;
  name: string;
  category: string;
  content: Record<string, unknown>;
  source: string;
  /** Source of the regulation clause the rule is based on */
  legal_basis: string | null;
  /** Full text of the original regulation the rule is based on */
  source_text: string | null;
  /** Natural-language readable readback of the rule (gloss) */
  gloss: string | null;
  /** Rule grade A/B/C */
  grade: string | null;
  version: number;
  user_id: string | null;
  owner_id: string | null;
  scope: string;
  overrides_rule_name: string | null;
  is_overridden: boolean;
  priority: number;
  decision: string;
  ring_level: number;
  enabled: boolean;
  is_draft: boolean;
  is_deleted: boolean;
  /** Rule kind: guard (tool-call guard) / approval (business approval) */
  rule_kind: string;
  /** Rule set (department/business-scenario isolation dimension) */
  rule_set: string;
  hit_count: number;
  last_hit_at: Date | null;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}
