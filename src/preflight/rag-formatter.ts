/**
 * RAG Fragment Trust Label — computes a human-readable trust rating for a knowledge fragment.
 *
 * Criteria:
 *   - knowledgeStatus: 'published' → higher trust, 'draft' → lower
 *   - recency: updated within 90 days → boosts trust
 *   - score: RAG relevance score
 *
 * Returns a label string suitable for display in GuidancePanel.
 *
 * @since 2026-08-12 (implemented from stub)
 */
export function trustLabel(
  f: { knowledgeStatus?: string; knowledgeVersion?: string; updatedAt?: string; score?: number },
  nowMs?: number,
): string {
  const status = f.knowledgeStatus ?? 'draft';
  const score = f.score ?? 0;
  const now = nowMs ?? Date.now();
  const updatedMs = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
  const daysSinceUpdate = updatedMs ? (now - updatedMs) / 86400000 : 999;

  // Published + high relevance + recent → Official
  if (status === 'published' && score >= 0.7 && daysSinceUpdate <= 90) {
    return '📄 Official';
  }

  // Published but older or lower relevance → Verified
  if (status === 'published') {
    return '📄 Verified';
  }

  // Draft status → Draft
  if (status === 'draft') {
    return '📝 Draft';
  }

  // Deprecated / archived
  if (status === 'deprecated' || status === 'archived') {
    return '⚠️ Deprecated';
  }

  return '📄 Reference';
}
