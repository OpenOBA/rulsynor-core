/**
 * Decision Object Builder — standalone (zero framework dependency).
 *
 * Produces 25-field Decision Objects aligned to erdl-vectors v1.3.
 * All fields enter JCS → SHA-256 → audit.hash.
 *
 * Usage:
 *   import { buildDecisionObject } from '@rulsynor/core/guard';
 *   const do1 = buildDecisionObject({ rules, context, decision, ... });
 */
import * as crypto from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import { PROVENANCE } from '../provenance.js';
import { getComplianceProfile } from '../compliance/index.js';

// ── Types ──

export interface GuardInput {
  runId: string;
  step: number;
  toolName: string;
  toolArgs: Record<string, unknown>;
  context: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  previousAuditHash?: string | null;
}

export interface RuleDefinition {
  name: string;
  version?: number;
  when?: unknown;
  then?: unknown;
}

export interface RuleMatch {
  ruleId: string;
  decision: string;
  reason?: string | null;
  instruction?: string | null;
  correction?: string | null;
  ring?: number;
}

export interface DecisionObjectInput {
  input: GuardInput;
  decision: string;
  actionTaken: string;
  reason: string | null;
  matchedRules: RuleMatch[];
  totalEvaluated: number;
  totalMatched: number;
  rules: RuleDefinition[];
  evaluationDurationMs: number;
  modelId?: string;
}

/** Strongly-typed Decision Object — for type-safe consumption by frontend and integrators. */
export interface DecisionObject {
  spec: string;
  decision_id: string;
  compliance_profile: Record<string, unknown>;
  execution_trace_id: string;
  timestamp: string;
  evaluation_duration_ms: number;
  agent: {
    id: string;
    role: string;
    version: string;
    aid: string;
    algorithm_filing_no: string;
    model_registration_id: string;
    known_limitations: string[];
    tool_registry_hash: string;
  };
  model_id: string;
  context: Record<string, unknown>;
  context_snapshot_hash: string;
  sanitized_context: null | Record<string, unknown>;
  rule_set_version: { id: string; timestamp: string };
  policies: Array<{ id: string; name: string; author_id: string; version: number; hash: string }>;
  evaluation: {
    evaluation_details: {
      total_evaluated: number;
      total_matched: number;
      evaluation_duration_ms: number;
    };
    matched_rules: Array<Record<string, unknown>>;
    triggered_rules: Array<Record<string, unknown>>;
  };
  result: {
    applied_rule: string | null;
    decision: string;
    decision_type: string;
    reason: string;
    rules_matched: string[];
  };
  human_oversight: boolean;
  audit: {
    previous_hash: string | null;
    commitment: string;
    hash: string;
  };
  impact_assessment_id: string;
  fairness_assessment: string;
  autonomy_level: string;
  confidence_score: number;
  data_modification_expected: boolean;
  extensions: unknown[];
  /** 签名模式字段：哈希模式下不输出（签名层落地后启用） */
  signature?: string;
  signing_key_id?: string;
}

// ── Public API ──

export function buildDecisionObject(opts: DecisionObjectInput): DecisionObject {
  const {
    input,
    decision,
    actionTaken,
    reason,
    matchedRules,
    totalEvaluated,
    totalMatched,
    rules,
    evaluationDurationMs,
    modelId,
  } = opts;
  const timestamp = new Date().toISOString();
  const decisionId = crypto.randomUUID();
  const executionTraceId = crypto.randomUUID();

  // Policies
  const policies = rules.map(r => ({
    id: r.name,
    name: r.name,
    author_id: 'system',
    version: r.version ?? 1,
    hash: `sha256:${crypto.createHash('sha256').update(canonicalize(r)).digest('hex')}`,
  }));

  // Matched rules
  const doMatchedRules = matchedRules.map(r => ({
    rule_id: r.ruleId,
    decision: r.decision,
    ...(r.reason ? { reason: r.reason } : {}),
    ...(r.instruction ? { instruction: r.instruction } : {}),
    ...(r.correction ? { correction: r.correction } : {}),
    ...(r.ring !== undefined ? { ring: r.ring } : {}),
  }));

  // Agent — role inferred from id suffix pattern (best-effort; explicit role should be passed by caller)
  const agentRole = /[.:_-]guardian$/i.test(input.agentId)
    ? 'guardian'
    : /[.:_-]operator$/i.test(input.agentId)
      ? 'operator'
      : 'observed';

  const toolRegistryHash = `sha256:${crypto
    .createHash('sha256')
    .update(canonicalize({ count: rules.length, names: rules.map(r => r.name).sort() }))
    .digest('hex')}`;

  // Context
  const contextObj: Record<string, unknown> = {
    'tool.name': input.toolName,
    'tool.args': input.toolArgs,
  };
  const contextSnapshotHash = `sha256:${crypto.createHash('sha256').update(canonicalize(contextObj)).digest('hex')}`;

  // Rule set version
  const ruleIds = rules
    .map(r => `${r.name}@${r.version ?? 1}`)
    .sort()
    .join('|');
  const ruleSetHash = `sha256:${crypto.createHash('sha256').update(ruleIds).digest('hex')}`;

  // Derived fields
  const humanOversight = decision === 'REQUEST_HUMAN' || decision === 'ESCALATE';
  // decision_type maps SPEC decision to lowercase for tooling compatibility (legacy; prefer `decision`)
  const decisionType = decision.toLowerCase();
  const confidenceScore =
    totalEvaluated > 0 ? Math.round((totalMatched / totalEvaluated) * 100) : 0;
  const dataModification = isDataModification(input.toolName, actionTaken);
  const appliedRule = matchedRules.length > 0 ? matchedRules[0].ruleId : null;
  const autonomyLevel = process.env['RULSYNOR_AUTONOMY_LEVEL'] || 'L2';
  const commitment = `${timestamp}|${input.agentId}|${input.toolName}|${decision}|${input.previousAuditHash ?? 'genesis'}`;

  // Compliance profile
  const complianceProfile = getComplianceProfile();

  // ── Assemble 25-field DO ──
  const recordWithoutHash: Record<string, unknown> = {
    spec: 'decision-object-v1.3',
    decision_id: decisionId,
    compliance_profile: complianceProfile,
    execution_trace_id: executionTraceId,
    timestamp,
    evaluation_duration_ms: evaluationDurationMs,
    agent: {
      id: input.agentId,
      role: agentRole,
      version: PROVENANCE.version,
      aid: generateAID(),
      algorithm_filing_no: PROVENANCE.algorithmFilingNo,
      model_registration_id: PROVENANCE.modelRegistrationId,
      known_limitations: PROVENANCE.knownLimitations,
      tool_registry_hash: toolRegistryHash,
    },
    model_id: modelId || process.env['RULSYNOR_MODEL_ID'] || 'unknown',
    context: contextObj,
    context_snapshot_hash: contextSnapshotHash,
    sanitized_context: null,
    rule_set_version: { id: ruleSetHash, timestamp },
    policies,
    evaluation: {
      evaluation_details: {
        total_evaluated: totalEvaluated,
        total_matched: totalMatched,
        evaluation_duration_ms: evaluationDurationMs,
      },
      matched_rules: doMatchedRules,
      triggered_rules: doMatchedRules,
    },
    result: {
      applied_rule: appliedRule,
      decision,
      decision_type: decisionType,
      reason: reason ?? 'rule matched',
      rules_matched: matchedRules.map(r => r.ruleId),
    },
    human_oversight: humanOversight,
    audit: { previous_hash: input.previousAuditHash ?? null, commitment },
    impact_assessment_id: crypto.randomUUID(),
    fairness_assessment: 'not_applicable',
    autonomy_level: autonomyLevel,
    confidence_score: confidenceScore,
    data_modification_expected: dataModification,
    extensions: [],
    // 哈希模式下 MUST NOT 输出 signature / signing_key_id（RFC-002 §1.1：签名模式字段，
    // 哈希模式不存在；§1.3#6 Omit over Null：禁置空/占位值）。
    // 历史实现曾输出 signature:'NOT_SIGNED' / signing_key_id:'no-key-v1' 占位值 ——
    // 后果是合规假阳（fail-open）：若 activated_fields 声明了 signature，
    // 存在性检查会因「字段存在」而通过，而实际并未签名（见 2026-08-25 深度 review）。
  };

  // JCS + SHA-256
  // E3 fix (Erik Newton): only delete audit.hash — audit.previous_hash
  // and audit.commitment MUST stay in the nested JCS preimage for chain
  // position tampering detection (AV-013 canary).
  const preimage: Record<string, unknown> = { ...recordWithoutHash };
  delete (preimage.audit as Record<string, unknown>).hash;
  // 防御性删除（RUNNER_CONTRACT R2）：哈希模式下两字段不存在，删除为 no-op；
  // 签名层落地后仍 MUST 剔除，故保留。
  delete preimage.signature;
  delete preimage.signing_key_id;

  const canonical = canonicalize(preimage);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  return {
    ...recordWithoutHash,
    audit: { previous_hash: input.previousAuditHash ?? null, commitment, hash: `sha256:${hash}` },
  } as DecisionObject;
}

// ── Helpers ──

export function generateAID(): string {
  const registrarId = process.env['RULSYNOR_AID_REGISTRAR'] || '000001';
  const requesterId = process.env['RULSYNOR_AID_REQUESTER'] || '000001';
  const instanceId = crypto
    .createHash('sha256')
    .update(`${process.env['HOSTNAME'] || 'localhost'}-${process.pid}`)
    .digest('hex')
    .slice(0, 8);
  return `${PROVENANCE.aidOidPrefix}.1.${registrarId}.${requesterId}.${instanceId}`;
}

function isDataModification(toolName: string, actionTaken: string): boolean {
  // DENIED / blocked / paused actions have no data modification effect
  if (actionTaken !== 'allowed') return false;
  // Whitelist known write-verb tools (avoids substring false positives like 'post' matching 'postprocess')
  const writeVerbs = [
    'write',
    'create',
    'update',
    'delete',
    'remove',
    'save',
    'insert',
    'upsert',
    'patch',
    'put',
    'post',
  ];
  const lower = toolName.toLowerCase();
  // Match whole word boundaries: tool name must START with or equal a write verb,
  // or have it at word boundary (e.g. 'write_file', 'createOrder')
  return writeVerbs.some(
    v => lower === v || lower.startsWith(v + '_') || lower.startsWith(v + '-'),
  );
}
