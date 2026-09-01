/**
 * Knowledge pipeline utilities — validation, chunking, RAG formatting,
 * mode gates, tool filtering and budget resolution.
 *
 * Consumed by the frontend (knowledge editor / guidance panel / token budget)
 * and exported from the core index for the frontend smoke-test contract.
 *
 * @since 2026-08-10
 */

import { ATCF_DOMAIN_VALUES, isAtcfDomain } from './types.js';
import type { AtcfDomain, KnowledgeFragment, ScoredFragment } from './types.js';

// ═══════════════════════════════════════════════════════════════
// RING_K disclaimer — shown when knowledge fragments are injected
// ═══════════════════════════════════════════════════════════════

export const RING_K_DISCLAIMER =
  'The following knowledge fragments are injected from the RING_K knowledge base, for reference only; execution decisions follow the deterministic ERDL Guard rules.';

// ═══════════════════════════════════════════════════════════════
// Intent → domain resolution
// ═══════════════════════════════════════════════════════════════

/** Keyword table used to resolve free text into an ATCF domain. */
export const INTENT_DOMAIN_MAP: Record<AtcfDomain, string[]> = {
  financial: ['审批', '金额', '退款', '限额', '预算', '报销', '权限'],
  customer_privacy: ['删除', '隐私', '注销', '身份验证', '留存', '同意'],
  security_compliance: ['审计', '合规', '认证', '加密', '权限'],
  database_write: ['写入', '更新', '批量', '删除'],
  database_read: ['查询', '读取', '检索', '统计'],
  file_operation: ['文件', '路径', '读写'],
  external_api: ['API', '接口', '调用', '超时'],
  order_management: ['订单', '发货', '履约', '取消'],
  inventory: ['库存', '入库', '出库', '盘点'],
  customer_mgmt: ['客户', '会员', '积分', '等级'],
  documentation: ['文档', '模板', '格式', '导出'],
  analytics: ['报表', '趋势', '分析', '统计'],
};

/** Resolve the most likely ATCF domain for a piece of text (null when no keyword hits). */
export function resolveDomain(text: string): AtcfDomain | null {
  let best: AtcfDomain | null = null;
  let bestScore = 0;
  for (const domain of ATCF_DOMAIN_VALUES) {
    const score = INTENT_DOMAIN_MAP[domain].filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════
// Knowledge validation (front matter level)
// ═══════════════════════════════════════════════════════════════

export interface KnowledgeValidatorInput {
  id?: string;
  name?: string;
  domain?: string;
  version?: string;
  status?: string;
  type?: string;
  body?: string;
}

export interface KnowledgeValidationResult {
  valid: boolean;
  errors: string[];
}

const KNOWLEDGE_STATUSES = ['draft', 'published', 'deprecated'];
const KNOWLEDGE_TYPES = ['policy', 'api_reference', 'sop', 'faq', 'legal'];

/** Validate parsed knowledge fields (front matter + body presence). */
export function validateKnowledge(input: KnowledgeValidatorInput): KnowledgeValidationResult {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('name is required');
  if (!input.domain) errors.push('domain is required');
  else if (!isAtcfDomain(input.domain)) errors.push(`unknown domain: ${input.domain}`);
  if (!input.version?.trim()) errors.push('version is required');
  if (!input.body?.trim()) errors.push('body is required');
  if (input.status && !KNOWLEDGE_STATUSES.includes(input.status)) {
    errors.push(`invalid status: ${input.status}`);
  }
  if (input.type && !KNOWLEDGE_TYPES.includes(input.type)) {
    errors.push(`invalid type: ${input.type}`);
  }
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
// Chunking — split markdown into fragments by headings
// ═══════════════════════════════════════════════════════════════

/** Split raw markdown into fragments on `##+` headings (front matter kept with preamble). */
export function chunkKnowledge(rawMarkdown: string): KnowledgeFragment[] {
  const fragments: KnowledgeFragment[] = [];
  const lines = rawMarkdown.split(/\r?\n/);
  let sectionPath = '';
  let buf: string[] = [];
  let idx = 0;

  const flush = (): void => {
    const text = buf.join('\n').trim();
    if (text) {
      fragments.push({
        fragmentId: `frag-${idx++}`,
        knowledgeId: '',
        contentType: 'markdown',
        text,
        sectionPath: sectionPath || undefined,
        tokenEstimate: Math.ceil(text.length / 4),
      });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = /^(#{2,})\s+(.+)$/.exec(line);
    if (m) {
      flush();
      sectionPath = m[2].trim();
    }
    buf.push(line);
  }
  flush();
  return fragments;
}

// ═══════════════════════════════════════════════════════════════
// RAG context formatting
// ═══════════════════════════════════════════════════════════════

/** Format scored fragments into system-prompt RAG context text. */
export function formatRagContext(fragments: ScoredFragment[]): string {
  if (!fragments.length) return '';
  return fragments
    .map((f, i) => {
      const source = f.knowledgeName ?? f.knowledgeId;
      return `[Knowledge ${i + 1}] ${source} (relevance ${f.score.toFixed(2)})\n${f.text}`;
    })
    .join('\n\n');
}

// ═══════════════════════════════════════════════════════════════
// Knowledge mode gates (off | shadow | live)
// ═══════════════════════════════════════════════════════════════

export interface ModeGateStatus {
  gate: string;
  passed: boolean;
  value: number;
  threshold: number;
}

const GRADE_SCORE: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

/** Evaluate promotion gates for knowledge mode. live = grade ≥ B + citation ≥ 0.2; shadow = citation ≥ 0.1. */
export function checkModeGates(
  mode: 'off' | 'shadow' | 'live',
  stats: { qualityGrade?: string; citationRate?: number },
): ModeGateStatus[] {
  const gates: ModeGateStatus[] = [];
  if (mode === 'off') return gates;
  const gradeScore = GRADE_SCORE[stats.qualityGrade ?? 'D'] ?? 0;
  const citationRate = stats.citationRate ?? 0;
  if (mode === 'live') {
    gates.push({ gate: 'quality_grade', passed: gradeScore >= 3, value: gradeScore, threshold: 3 });
    gates.push({
      gate: 'citation_rate',
      passed: citationRate >= 0.2,
      value: citationRate,
      threshold: 0.2,
    });
  } else {
    gates.push({
      gate: 'citation_rate',
      passed: citationRate >= 0.1,
      value: citationRate,
      threshold: 0.1,
    });
  }
  return gates;
}

// ═══════════════════════════════════════════════════════════════
// Tool helpers (occupation filtering / profile / anchors / governed-by)
// ═══════════════════════════════════════════════════════════════

/** Filter tools visible to an occupation (undefined occupations = visible to all). */
export function filterToolsByOccupation<T extends { occupations?: string[] }>(
  tools: T[],
  occupation: string,
): T[] {
  return tools.filter(t => !t.occupations || t.occupations.includes(occupation));
}

/** Render a one-line entity/tool profile for prompt composition. */
export function formatEntityProfile(entity: {
  name?: string;
  displayName?: string;
  securityLevel?: string;
  description?: string;
}): string {
  return [
    entity.displayName ?? entity.name ?? 'unknown',
    entity.securityLevel ? `[${entity.securityLevel}]` : '',
    entity.description ?? '',
  ]
    .join(' ')
    .trim();
}

export interface ToolAnchorInput {
  name: string;
  requiredCertLevel?: string;
}

export interface ToolAnchor {
  name: string;
  available: boolean;
  reason?: string;
}

const CERT_ORDER = ['L0', 'L1', 'L2', 'L3'];

/** Collect tool anchors with availability against the agent's cert level. */
export function collectToolAnchors(tools: ToolAnchorInput[], certLevel = 'L1'): ToolAnchor[] {
  return tools.map(t => {
    const need = t.requiredCertLevel ?? 'L0';
    const available = CERT_ORDER.indexOf(certLevel) >= CERT_ORDER.indexOf(need);
    return { name: t.name, available, reason: available ? undefined : `requires ${need} certificate` };
  });
}

/** Build an index of tool name → rule ids governing it. */
export function buildGovernedByIndex<T extends { name: string; relatedRules?: string[] }>(
  tools: T[],
): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const t of tools) index[t.name] = [...(t.relatedRules ?? [])];
  return index;
}

/** Compose a `data_ref:` reference used by ERDL rule data directives. */
export function dataRef(dataRefId: string, version?: string): string {
  return version ? `data_ref:${dataRefId}@${version}` : `data_ref:${dataRefId}`;
}

// ═══════════════════════════════════════════════════════════════
// Token budget resolution (ring × cert level)
// ═══════════════════════════════════════════════════════════════

const RING_BASE_BUDGET: Record<string, number> = {
  RING_0: 2000,
  RING_K: 4000,
  RING_1: 8000,
  RING_2: 16000,
};

const CERT_BUDGET_MULTIPLIER: Record<string, number> = {
  L0: 0.5,
  L1: 1,
  L2: 2,
  L3: 4,
};

/** Resolve the token budget for a ring at a cert level (defaults documented in TokenBudgetBar). */
export function resolveBudget(ring: string, certLevel = 'L1'): number {
  const base = RING_BASE_BUDGET[ring] ?? 4000;
  return Math.round(base * (CERT_BUDGET_MULTIPLIER[certLevel] ?? 1));
}
