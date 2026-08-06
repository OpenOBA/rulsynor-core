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

// ── Public API ──

export function buildDecisionObject(opts: DecisionObjectInput): Record<string, unknown> {
  const { input, decision, actionTaken, reason, matchedRules, totalEvaluated, totalMatched, rules, evaluationDurationMs, modelId } = opts;
  const timestamp = new Date().toISOString();
  const decisionId = crypto.randomUUID();
  const executionTraceId = crypto.randomUUID();

  // Policies
  const policies = rules.map((r) => ({
    id: r.name,
    name: r.name,
    author_id: 'system',
    version: r.version ?? 1,
    hash: `sha256:${crypto.createHash('sha256').update(canonicalize(r)).digest('hex')}`,
  }));

  // Matched rules
  const doMatchedRules = matchedRules.map((r) => ({
    rule_id: r.ruleId,
    decision: r.decision,
    ...(r.reason ? { reason: r.reason } : {}),
    ...(r.instruction ? { instruction: r.instruction } : {}),
    ...(r.correction ? { correction: r.correction } : {}),
    ...(r.ring !== undefined ? { ring: r.ring } : {}),
  }));

  // Agent
  const agentRole = input.agentId.includes('guardian') ? 'guardian'
    : input.agentId.includes('operator') ? 'operator'
    : 'observed';

  const toolRegistryHash = `sha256:${crypto.createHash('sha256')
    .update(canonicalize({ count: rules.length, names: rules.map(r => r.name).sort() }))
    .digest('hex')}`;

  // Context
  const contextObj: Record<string, unknown> = {
    'tool.name': input.toolName,
    'tool.args': input.toolArgs,
  };
  const contextSnapshotHash = `sha256:${crypto.createHash('sha256').update(canonicalize(contextObj)).digest('hex')}`;

  // Rule set version
  const ruleIds = rules.map(r => `${r.name}@${r.version ?? 1}`).sort().join('|');
  const ruleSetHash = `sha256:${crypto.createHash('sha256').update(ruleIds).digest('hex')}`;

  // Derived fields
  const humanOversight = decision === 'REQUEST_HUMAN' || decision === 'ESCALATE';
  const decisionType = deriveDecisionType(decision);
  const confidenceScore = totalEvaluated > 0 ? Math.round((totalMatched / totalEvaluated) * 100) : 0;
  const dataModification = isDataModification(input.toolName, actionTaken);
  const appliedRule = matchedRules.length > 0 ? matchedRules[0].ruleId : null;
  const autonomyLevel = process.env['RULSYNOR_AUTONOMY_LEVEL'] || 'L2';
  const commitment = `${timestamp}|${input.agentId}|${input.toolName}|${decision}`;

  // Compliance profile
  const complianceProfile = getComplianceProfile();

  // ── Assemble 25-field DO ──
  const recordWithoutHash: Record<string, unknown> = {
    spec: 'decision-object-v1.0',
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
      evaluation_details: { total_evaluated: totalEvaluated, total_matched: totalMatched, evaluation_duration_ms: evaluationDurationMs },
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
    signature: 'NOT_SIGNED',
    signing_key_id: 'no-key-v1',
  };

  // JCS + SHA-256
  // E3 fix (Erik Newton): only delete audit.hash — audit.previous_hash
  // and audit.commitment MUST stay in the nested JCS preimage for chain
  // position tampering detection (AV-013 canary).
  const preimage: Record<string, unknown> = { ...recordWithoutHash };
  delete (preimage.audit as Record<string, unknown>).hash;
  delete preimage.signature;
  delete preimage.signing_key_id;

  const canonical = canonicalize(preimage);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  return {
    ...recordWithoutHash,
    audit: { previous_hash: input.previousAuditHash ?? null, commitment, hash: `sha256:${hash}` },
  };
}

// ── Helpers ──

export function generateAID(): string {
  const registrarId = process.env['RULSYNOR_AID_REGISTRAR'] || '000001';
  const requesterId = process.env['RULSYNOR_AID_REQUESTER'] || '000001';
  const instanceId = crypto.createHash('sha256')
    .update(`${process.env['HOSTNAME'] || 'localhost'}-${process.pid}`)
    .digest('hex').slice(0, 8);
  return `${PROVENANCE.aidOidPrefix}.1.${registrarId}.${requesterId}.${instanceId}`;
}

function deriveDecisionType(decision: string): string {
  switch (decision) {
    case 'ALLOW': return 'allow';
    case 'DENY': return 'block';
    case 'CORRECT': return 'correct';
    case 'REQUEST_HUMAN': return 'human';
    case 'ESCALATE': return 'escalate';
    case 'ROLLBACK': return 'rollback';
    case 'QUARANTINE': return 'quarantine';
    case 'EMERGENCY_HALT': return 'halt';
    case 'NOTIFY': return 'notify';
    default: return 'unknown';
  }
}

function isDataModification(toolName: string, _actionTaken: string): boolean {
  const writeVerbs = ['write', 'create', 'update', 'delete', 'remove', 'save', 'insert', 'upsert', 'patch', 'put', 'post'];
  const lower = toolName.toLowerCase();
  return writeVerbs.some(v => lower.includes(v));
}
