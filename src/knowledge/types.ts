/**
 * Knowledge domain types — shared contracts for frontend/backend.
 *
 * Shared domain types consumed by `packages/frontend/src/api/contracts/common.ts`
 * (re-exported to all API contract modules) and aligned with the backend
 * KnowledgeEntry / quality_signal entities (snake_case DB columns are mapped
 * to camelCase in these frontend-facing contracts).
 *
 * Frontend path mapping: `@rulsynor/core/knowledge/types` → this file.
 *
 * @since 2026-08-10
 */

// ═══════════════════════════════════════════════════════════════
// ATCF Domains
// ═══════════════════════════════════════════════════════════════

/** ATCF knowledge domain classification (12 domains). */
export type AtcfDomain =
  | 'financial'
  | 'customer_privacy'
  | 'security_compliance'
  | 'database_write'
  | 'database_read'
  | 'file_operation'
  | 'external_api'
  | 'order_management'
  | 'inventory'
  | 'customer_mgmt'
  | 'documentation'
  | 'analytics'

export const ATCF_DOMAIN_VALUES: AtcfDomain[] = [
  'financial',
  'customer_privacy',
  'security_compliance',
  'database_write',
  'database_read',
  'file_operation',
  'external_api',
  'order_management',
  'inventory',
  'customer_mgmt',
  'documentation',
  'analytics',
]

export function isAtcfDomain(value: unknown): value is AtcfDomain {
  return typeof value === 'string' && (ATCF_DOMAIN_VALUES as string[]).includes(value)
}

// ═══════════════════════════════════════════════════════════════
// Occupations
// ═══════════════════════════════════════════════════════════════

/**
 * Occupation (digital employee role) identifier.
 * Known values are listed explicitly; `(string & {})` keeps the type open
 * for backend-defined occupations while preserving autocomplete.
 */
export type Occupation =
  | 'customer_service'
  | 'financial_officer'
  | 'data_analyst'
  | 'content_writer'
  | string

export const OCCUPATION_LABELS: Record<Occupation, string> = {
  customer_service: '数字客服专员',
  financial_officer: '数字财务专员',
  data_analyst: '数据分析师',
  content_writer: '内容运营专员',
  // 蓝图打通（2026-08-27）：后端 occupation_blueprint 真实岗位
  shuibao_reviewer: '水保方案审查员',
  xinfang_reviewer: '信访合规审查员',
  huzhu_reviewer: '互助保障审核员',
}

// ═══════════════════════════════════════════════════════════════
// Knowledge entry
// ═══════════════════════════════════════════════════════════════

/** Content type of a knowledge fragment. */
export type KnowledgeContentType = 'markdown' | 'table' | 'code' | 'flowchart' | 'citation'

/** Knowledge lifecycle status. */
export type KnowledgeStatusValue = 'draft' | 'published' | 'deprecated'

/** Knowledge entry type. */
export type KnowledgeTypeValue = 'policy' | 'api_reference' | 'sop' | 'faq' | 'legal'

/** Free-form annotations attached to a knowledge entry. */
export interface KnowledgeAnnotations {
  source?: string
  owner?: string
  reviewNote?: string
  [key: string]: unknown
}

/**
 * Knowledge entry (camelCase contract, aligned with backend `knowledge_entry`
 * entity columns).
 */
export interface Knowledge {
  id: string
  entryId: string
  name: string
  domain: AtcfDomain
  version: string
  status: KnowledgeStatusValue
  type: KnowledgeTypeValue
  tags: string[]
  rawMarkdown: string
  frontMatter: Record<string, unknown>
  body: string
  annotations: KnowledgeAnnotations
  structured: Record<string, unknown>
  taxonomy?: string | null
  lifecycleStage: string
  reviewDue?: string | null
  deprecates?: string | null
  supersededBy?: string | null
  authorityLevel: number
  retrievalCount: number
  citationRate: number
  fragmentCount: number
  qualityGrade: string
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════════
// Fragments + retrieval
// ═══════════════════════════════════════════════════════════════

/** Fragment metadata (heading path / anchor / extension fields). */
export interface FragmentMetadata {
  headingPath?: string[]
  anchor?: string
  [key: string]: unknown
}

/** A single chunk produced by the knowledge fragmentation pipeline. */
export interface KnowledgeFragment {
  fragmentId: string
  knowledgeId: string
  contentType: KnowledgeContentType
  text: string
  sectionPath?: string
  tokenEstimate?: number
  metadata?: FragmentMetadata
}

/** Fragment returned by semantic retrieval (K9 / RAG injection). */
export interface ScoredFragment extends KnowledgeFragment {
  /** Relevance score in [0, 1]. */
  score: number
  knowledgeName?: string
  /** Version of the source knowledge entry. */
  knowledgeVersion?: string
  /** Lifecycle status of the source knowledge entry. */
  knowledgeStatus?: KnowledgeStatusValue | string
  /** Whether the fragment carries an anchor/citation backing. */
  anchored?: boolean
  /** Last update time of the source knowledge (ISO string). */
  updatedAt?: string
  /** Expiry of the source knowledge (ISO string) if any. */
  effectiveUntil?: string | null
  /** Trust label hint (may be overridden by core trustLabel()). */
  trustLabel?: string
}

/** RAG context leaf — one retrieval round recorded for audit (K15). */
export interface RagContextLeaf {
  ragQueryId: string
  query: string
  domain?: AtcfDomain | string
  fragments: ScoredFragment[]
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════
// Quality signals (K13/K14)
// ═══════════════════════════════════════════════════════════════

export type QualitySignalSeverity = 'info' | 'warn' | 'critical'

/** Knowledge quality signal (camelCase contract for `quality_signal` entity). */
export interface KnowledgeQualitySignal {
  id: string
  knowledgeId: string
  knowledgeName: string
  signalType: string
  status: string
  severity: QualitySignalSeverity
  note: string
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════════
// Constraint export (knowledge → ERDL rule data directives)
// ═══════════════════════════════════════════════════════════════

export type ConstraintKindValue = 'enum' | 'pattern' | 'required' | 'range'

/** A constraint extracted from knowledge, exported toward the rule engine. */
export interface ConstraintExport {
  constraintId: string
  kind: ConstraintKindValue
  fieldPath: string
  value: unknown
  sourceKnowledgeId?: string
  note?: string
}

// ═══════════════════════════════════════════════════════════════
// Data directives
// ═══════════════════════════════════════════════════════════════

/** An approved data directive version backing a `data_ref:` rule field. */
export interface DataDirective {
  dataRefId: string
  version: string
  tableData: unknown
  source?: 'manual' | 'knowledge_proposal'
  approvedBy?: string
  approvedAt?: string
  active: boolean
  contentHash?: string
}
