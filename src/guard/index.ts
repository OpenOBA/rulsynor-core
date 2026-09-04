/**
 * Decision Object Builder — standalone (zero framework dependency).
 *
 * Produces Decision Objects aligned to erdl-vectors v1.5 (flat-hash scheme,
 * `erdl-do-v1.5-hash-flat`).
 * All fields enter JCS → SHA-256 → audit.hash.
 *
 * Usage:
 *   import { buildDecisionObject } from '@openoba/rulsynor-core/guard';
 *   const do1 = buildDecisionObject({ rules, context, decision, ... });
 */
import * as crypto from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import { PROVENANCE } from '../provenance.js';
import { getComplianceProfile } from '../compliance/index.js';
import { uuidv7 } from '../uuidv7.js';

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
  priority?: number;
  ring?: number;
}

export interface RuleMatch {
  ruleId: string;
  decision: string;
  reason?: string | null;
  instruction?: string | null;
  correction?: string | null;
  ring?: number;
  /** Canonical expression tree of the matched rule's when (S-expression JSON, RFC-002 §2.1). */
  canonicalTree?: unknown;
}

/**
 * Window count snapshot for stateful operators (within/rate) — RFC-002 §2.4.
 * Field structure frozen: { rule_id, operator, field, window_ms, count, limit? }.
 * Enters the DO as `evaluation.temporal_state` (conditionally activated, Omit when empty).
 */
export interface TemporalStateEntry {
  rule_id: string;
  operator: 'within' | 'rate';
  field: string;
  window_ms: number;
  count: number;
  limit?: number;
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
  /** Stateful-operator window snapshots (RFC-002 §2.4); omitted from the DO when empty. */
  temporalState?: TemporalStateEntry[];
}

/** Strongly-typed Decision Object v1.5 — flat-hash scheme (erdl-do-v1.5-hash-flat), aligned to erdl-vectors authoritative vectors. */
export interface DecisionObject {
  spec: 'decision-object-v1.5';
  decision_id: string;
  compliance_profile: Record<string, unknown>;
  execution_trace_id: string;
  timestamp: string;
  evaluation_duration_ms: number;
  agent: {
    id: string;
    role: string;
    version: string;
    aid?: string;
    algorithm_filing_no?: string;
    model_registration_id?: string;
    tool_registry_hash?: string;
    known_limitations?: string[];
  };
  model_id?: string;
  context: Record<string, unknown>;
  context_snapshot_hash?: string;
  sanitized_context?: string;
  rule_set_version: { id: string; timestamp: string };
  policies: Array<Record<string, unknown>>;
  evaluation: {
    matched_rules: Array<Record<string, unknown>>;
    total_evaluated: number;
    total_matched: number;
    temporal_state?: TemporalStateEntry[];
  };
  result: {
    applied_rule: string | null;
    decision: string;
    reason: string;
    rules_matched: string[];
  };
  human_oversight: { required: boolean };
  audit: {
    chain_id: string;
    chain_seq: number;
    commitment: { agent_id: string; tool_name: string; decision: string };
    mode: 'hash';
    preimage_version: 'erdl-do-v1.5-hash-flat';
    previous_hash: string | null;
    retention: { retention_until: string; retention_basis: string };
    hash: string;
  };
  impact_assessment_id?: string;
  fairness_assessment?: string;
  autonomy_level?: string;
  confidence_score?: number;
  data_modification_expected?: boolean;
  extensions: unknown[];
  /** Signature-mode fields: not output in hash mode (enabled after the signing layer lands) */
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
    temporalState,
  } = opts;
  const timestamp = new Date().toISOString();
  const decisionId = uuidv7();
  const executionTraceId = uuidv7();

  // Agent DID — did:erdl:sha256:<hash>. Extension point: CRM ID binding appends further method segments later.
  const agentDid = `did:erdl:sha256:${crypto.createHash('sha256').update(input.agentId).digest('hex').slice(0, 16)}`;
  const agentRole = /[.:_-]guardian$/i.test(input.agentId)
    ? 'guardian'
    : /[.:_-]operator$/i.test(input.agentId)
      ? 'operator'
      : 'observed';

  // Policies — v1.5 shape (id/name/author_id/when/then/priority/ring/hash)
  const policies = rules.map(r => ({
    id: r.name,
    name: r.name,
    author_id: 'system',
    ...(r.when !== undefined ? { when: r.when } : {}),
    ...(r.then !== undefined ? { then: r.then } : {}),
    priority: r.priority ?? 100,
    ring: r.ring ?? 3,
    hash: `sha256:${crypto.createHash('sha256').update(canonicalize(r)).digest('hex')}`,
  }));

  // Matched rules — v1.5 evaluation.matched_rules (rule_id + canonical_tree, RFC-002 §2.1)
  const doMatchedRules = matchedRules.map(r => ({
    rule_id: r.ruleId,
    ...(r.canonicalTree !== undefined ? { canonical_tree: r.canonicalTree } : {}),
  }));

  const toolRegistryHash = `sha256:${crypto
    .createHash('sha256')
    .update(canonicalize({ count: rules.length, names: rules.map(r => r.name).sort() }))
    .digest('hex')}`;

  // Context — nested (v1.5 convention: context.tool.name)
  const contextObj: Record<string, unknown> = {
    tool: { name: input.toolName, args: input.toolArgs },
  };
  const contextSnapshotHash = `sha256:${crypto.createHash('sha256').update(canonicalize(contextObj)).digest('hex')}`;

  // Rule set version
  const ruleIds = rules
    .map(r => `${r.name}@${r.version ?? 1}`)
    .sort()
    .join('|');
  const ruleSetHash = `sha256:${crypto.createHash('sha256').update(ruleIds).digest('hex')}`;

  // Derived fields
  const humanOversightRequired = decision === 'REQUEST_HUMAN' || decision === 'ESCALATE';
  const confidenceScore =
    totalEvaluated > 0 ? Math.round((totalMatched / totalEvaluated) * 100) : 0;
  const dataModification = isDataModification(input.toolName, actionTaken);
  const appliedRule = matchedRules.length > 0 ? matchedRules[0].ruleId : null;
  const autonomyLevel = process.env['RULSYNOR_AUTONOMY_LEVEL'] || 'L2';

  // Compliance profile
  const complianceProfile = getComplianceProfile();
  // JURISDICTION field activation gate (RFC-002 §1.1 / SPEC §5.3): a JURISDICTION field is
  // emitted only when its field path is declared in activated_fields; otherwise physically
  // omitted (Omit over Null). CORE fields are always emitted.
  const activated = new Set<string>(complianceProfile.activated_fields ?? []);

  // Chain + retention
  const chainId = `chain-${crypto
    .createHash('sha256')
    .update(`${input.sessionId}|${input.runId}`)
    .digest('hex')
    .slice(0, 8)}`;
  const chainSeq = input.step;
  const retention = computeRetention(complianceProfile, timestamp);

  // Agent object — CORE fields (id/role/version) always present; JURISDICTION subfields
  // (aid / tool_registry_hash / algorithm_filing_no / model_registration_id / known_limitations)
  // emitted only when activated (SPEC §5.3 / RFC-002 §1.1).
  const agentObj: Record<string, unknown> = {
    id: agentDid,
    role: agentRole,
    version: PROVENANCE.version,
  };
  if (activated.has('agent.aid')) agentObj.aid = generateAID();
  if (activated.has('agent.algorithm_filing_no'))
    agentObj.algorithm_filing_no = PROVENANCE.algorithmFilingNo;
  if (activated.has('agent.model_registration_id'))
    agentObj.model_registration_id = PROVENANCE.modelRegistrationId;
  if (activated.has('agent.tool_registry_hash')) agentObj.tool_registry_hash = toolRegistryHash;
  if (activated.has('agent.known_limitations'))
    agentObj.known_limitations = PROVENANCE.knownLimitations;

  // ── Assemble v1.5 flat-hash DO ──
  const recordWithoutHash: Record<string, unknown> = {
    spec: 'decision-object-v1.5',
    decision_id: decisionId,
    compliance_profile: complianceProfile,
    execution_trace_id: executionTraceId,
    timestamp,
    evaluation_duration_ms: evaluationDurationMs,
    agent: agentObj,
    context: contextObj,
    rule_set_version: { id: ruleSetHash, timestamp },
    policies,
    evaluation: {
      matched_rules: doMatchedRules,
      total_evaluated: totalEvaluated,
      total_matched: totalMatched,
      ...(temporalState && temporalState.length > 0 ? { temporal_state: temporalState } : {}),
    },
    result: {
      applied_rule: appliedRule,
      decision,
      reason: reason ?? 'rule matched',
      rules_matched: matchedRules.map(r => r.ruleId),
    },
    human_oversight: { required: humanOversightRequired },
    audit: {
      chain_id: chainId,
      chain_seq: chainSeq,
      commitment: { agent_id: agentDid, tool_name: input.toolName, decision },
      mode: 'hash',
      preimage_version: 'erdl-do-v1.5-hash-flat',
      previous_hash: input.previousAuditHash ?? null,
      retention,
    },
    // JURISDICTION fields (activated_fields-gated; omitted when not activated)
    ...(activated.has('model_id')
      ? { model_id: modelId || process.env['RULSYNOR_MODEL_ID'] || 'unknown' }
      : {}),
    ...(activated.has('context_snapshot_hash')
      ? { context_snapshot_hash: contextSnapshotHash }
      : {}),
    // PII sanitization not implemented yet — empty string (no fake placeholder).
    // The DO context is already minimal (`tool.name`/`tool.args`); PII redaction
    // of `tool.args` is a planned compliance-layer feature.
    ...(activated.has('sanitized_context') ? { sanitized_context: '' } : {}),
    ...(activated.has('impact_assessment_id') ? { impact_assessment_id: uuidv7() } : {}),
    ...(activated.has('fairness_assessment') ? { fairness_assessment: 'not_applicable' } : {}),
    ...(activated.has('autonomy_level') ? { autonomy_level: autonomyLevel } : {}),
    ...(activated.has('confidence_score') ? { confidence_score: confidenceScore } : {}),
    ...(activated.has('data_modification_expected')
      ? { data_modification_expected: dataModification }
      : {}),
    extensions: [],
  };

  // JCS + SHA-256 (flat-hash: delete ONLY audit.hash from the preimage)
  const preimage: Record<string, unknown> = { ...recordWithoutHash };
  delete (preimage.audit as Record<string, unknown>).hash;
  delete preimage.signature;
  delete preimage.signing_key_id;

  const canonical = canonicalize(preimage);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  return {
    ...recordWithoutHash,
    audit: {
      ...(recordWithoutHash.audit as Record<string, unknown>),
      hash: `sha256:${hash}`,
    },
  } as DecisionObject;
}

/** Retention policy — jurisdiction-driven (v1.5 flat-hash). CN → GB-Z-185 36-month; default 36-month. */
function computeRetention(
  complianceProfile: { jurisdictions?: string[] },
  timestamp: string,
): { retention_until: string; retention_basis: string } {
  const jurisdictions = complianceProfile.jurisdictions ?? [];
  const retentionBasis = jurisdictions.includes('CN')
    ? 'GB-Z-185-2026-36-month'
    : 'default-36-month';
  const until = new Date(Date.parse(timestamp));
  until.setFullYear(until.getFullYear() + 3);
  return { retention_until: until.toISOString(), retention_basis: retentionBasis };
}

// ── Helpers ──

export function generateAID(): string {
  const registrarId = process.env['RULSYNOR_AID_REGISTRAR'] || '000001';
  const requesterId = process.env['RULSYNOR_AID_REQUESTER'] || '000001';
  const instanceId = crypto
    .createHash('sha256')
    .update(`${process.env['HOSTNAME'] || 'localhost'}-${process.pid}`)
    .digest('hex')
    .slice(0, 6);
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
