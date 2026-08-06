/**
 * Guard Integration + DO Payload Writers — Sprint D21
 *
 * CORRECT blocking (Henry 方案 A) + Agent REQUEST_HUMAN path + DO payload injection.
 * These are interface contracts for backend implementation, defined in @rulsynor/core
 * for type safety and cross-package contract enforcement.
 */

// ═══════════════════════════════════════════════════════════════
// CORRECT Loop State Machine (D21 — Henry 方案 A)
// ═══════════════════════════════════════════════════════════════

export type CorrectLoopState =
  | 'correct_round_1'    // first correction injected, waiting LLM re-evaluation
  | 'correct_round_2'    // second correction
  | 'correct_round_3'    // final attempt before escalation
  | 'correct_resolved'   // Agent adopted correction → ALLOW
  | 'correct_escalated'; // 3 rounds exhausted → REQUEST_HUMAN

export interface CorrectLoopContext {
  ruleId: string;
  originalToolCall: { name: string; args: Record<string, unknown> };
  correction: string;
  round: number;            // 1-3
  state: CorrectLoopState;
}

/**
 * Advance the CORRECT loop state machine.
 * Returns the next state and whether tool execution should proceed.
 */
export function advanceCorrectLoop(ctx: CorrectLoopContext, newDecision: string): {
  state: CorrectLoopState;
  execute: boolean;        // true = tool may now execute
  escalate: boolean;       // true = trigger REQUEST_HUMAN
} {
  if (newDecision === 'ALLOW') {
    return { state: 'correct_resolved', execute: true, escalate: false };
  }

  if (ctx.round >= 3) {
    return { state: 'correct_escalated', execute: false, escalate: true };
  }

  return {
    state: `correct_round_${ctx.round + 1}` as CorrectLoopState,
    execute: false,
    escalate: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// Agent REQUEST_HUMAN Template Parser (D21)
// ═══════════════════════════════════════════════════════════════

export interface RequestHumanSignal {
  detected: boolean;
  reason?: string;
  urgency?: 'normal' | 'high';
  suggestedAction?: string;
}

/**
 * Parse Agent reply for explicit REQUEST_HUMAN markers.
 * Matches templates like:
 *   "请求人工审批：金额超¥5,000，需要财务经理审批"
 *   "REQUEST_HUMAN: GDPR删除请求需身份验证"
 */
const RH_PATTERNS = [
  /请求人工审批[：:]\s*(.+)/,
  /REQUEST_HUMAN[：:]\s*(.+)/i,
  /需要人工(?:审批|介入|审核)[：:]\s*(.+)/,
  /请升级(?:至|到)人工[：:]\s*(.+)/,
];

export function parseRequestHumanSignal(agentReply: string): RequestHumanSignal {
  for (const pattern of RH_PATTERNS) {
    const m = agentReply.match(pattern);
    if (m) {
      return {
        detected: true,
        reason: m[1].trim(),
        urgency: agentReply.includes('紧急') || agentReply.includes('立即') ? 'high' : 'normal',
        suggestedAction: m[1].trim(),
      };
    }
  }
  return { detected: false };
}

// ═══════════════════════════════════════════════════════════════
// DO Payload Builder (D21 — P0-07 fix)
// ═══════════════════════════════════════════════════════════════

export interface DoPayload {
  ragQueryId?: string;
  chunkSetHash?: string;
  dataRefs?: Array<{ dataRefId: string; version: string }>;
  pinnedFromVersions?: Array<{ knowledgeId: string; version: string }>;
}

/**
 * Build DO payload for injection into the chat:done event.
 * Payload is kept under 500 bytes (ragQueryId=36 + chunkSetHash=64 + overhead).
 */
export function buildDoPayload(params: {
  ragQueryId?: string;
  chunkSetHash?: string;
  dataRefs?: Array<{ dataRefId: string; version: string }>;
  pinnedFromVersions?: Array<{ knowledgeId: string; version: string }>;
}): DoPayload {
  const payload: DoPayload = {};
  if (params.ragQueryId) payload.ragQueryId = params.ragQueryId;
  if (params.chunkSetHash) payload.chunkSetHash = params.chunkSetHash;
  if (params.dataRefs?.length) payload.dataRefs = params.dataRefs;
  if (params.pinnedFromVersions?.length) payload.pinnedFromVersions = params.pinnedFromVersions;
  return payload;
}

// ═══════════════════════════════════════════════════════════════
// A/B Experiment Assignment (D25)
// ═══════════════════════════════════════════════════════════════

export type AbArm = 'control' | 'treatment';

/**
 * Deterministic A/B arm assignment by agentId hash.
 * Same agent always gets same arm (persistent assignment).
 * 50/50 split on average.
 */
export function assignAbArm(agentId: string): AbArm {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'control' : 'treatment';
}
