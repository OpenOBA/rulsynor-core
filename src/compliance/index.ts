/**
 * Compliance Profile — standalone (zero framework dependency).
 *
 * Design principle (globally neutral and flat, RFC-002 §5.2): **the framework does not guess the compliance jurisdiction for the user**.
 * The three activation dimensions (jurisdiction / industry / risk) are all "not preset" — unset means "not selected",
 * no default jurisdiction, no default industry, no default risk level, and no warning:
 * which jurisdiction to operate in, whether to fall under a certain industry condition layer, what risk level to assume obligations at,
 * are all explicitly declared by the deployer (Human Sovereignty); the framework only activates fields per the declaration.
 *
 * When not selected, the corresponding key is **physically omitted** per "Omit over Null" (RFC-002 §1.3#6),
 * no empty array / placeholder written — omission and empty produce different bytes under JCS.
 *
 * Environment variables:
 *   RULSYNOR_JURISDICTIONS  comma-separated jurisdiction codes (CN/EU/US/SG/BR/IN), unset = not selected
 *   RULSYNOR_INDUSTRIES     comma-separated industry codes (compatible with the old single-value RULSYNOR_INDUSTRY), unset = not selected
 *   RULSYNOR_RISK_LEVEL     risk level (low/limited/high/critical), unset = not selected
 */
import { createHash } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export interface ComplianceProfile {
  profile_id: string;
  profile_hash: string;
  /** Omitted when not selected (no empty array written) */
  jurisdictions?: string[];
  /** Omitted when not selected (industry condition layer inactive by default) */
  industries?: string[];
  /** Omitted when not selected */
  risk_level?: string;
  /** Omitted when no jurisdiction is activated */
  activated_fields?: string[];
  /** Omitted when no jurisdiction is activated */
  regulatory_references?: RegulatoryReference[];
}

export interface RegulatoryReference {
  framework: string;
  version: string;
  jurisdiction: string;
  effective_date?: string;
  amended_by?: string;
  requires_fields?: string[];
}

// Note: the full 14-framework catalog (RFC-002 §5.2) is not yet built into the runtime, currently 6;
// the three-layer activation (industry condition layer / risk condition layer) is not implemented, validateActivatedFields not wired in,
// a registered P1 engineering gap (rfc-002-audit plan §12.3), to be filled in a later refactor.
const REGULATORY_REFERENCES: RegulatoryReference[] = [
  {
    framework: 'EU-AI-Act',
    version: 'Regulation-2024-1689',
    amended_by: 'Digital-Omnibus-2026',
    jurisdiction: 'EU',
    effective_date: '2027-12-02',
  },
  { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
  { framework: 'NIST-AI-RMF', version: '1.0', jurisdiction: 'US' },
  { framework: 'COSO-GenAI', version: '2026', jurisdiction: 'ALL' },
  {
    framework: 'LGPD',
    version: 'Lei-13.709-2018',
    jurisdiction: 'BR',
    effective_date: '2020-09-18',
  },
  { framework: 'DPDP', version: '2023-Act-22', jurisdiction: 'IN' },
];

// Jurisdiction → activated-field map (same source as vector set V-COMP group 1: RFC-002 §9.1)
//
// [Why signature is not in each jurisdiction set] 2026-08-25 deep-review fix:
// The historical implementation declared signature in the CN/EU/US sets, but the signing layer is not yet implemented (V-SIGN planned) —
// "declared activated but cannot fill" causes two bad outcomes: ① if the field is really missing, every DO is judged
// compliance_field_missing; ② if filled with a placeholder, it instead causes a compliance false-positive (fail-open).
// Hence aligned with the vector set: the hash layer does not declare signature, to be added after the signing layer lands.
const JURISDICTION_FIELD_MAP: Record<string, string[]> = {
  EU: [
    'model_id',
    'agent.known_limitations',
    'confidence_score',
    'fairness_assessment',
    'impact_assessment_id',
    'data_modification_expected',
    'autonomy_level',
    'context_snapshot_hash',
    'sanitized_context',
  ],
  CN: [
    'agent.aid',
    'agent.tool_registry_hash',
    'agent.algorithm_filing_no',
    'agent.model_registration_id',
    'model_id',
    'confidence_score',
    'fairness_assessment',
    'impact_assessment_id',
    'data_modification_expected',
    'autonomy_level',
    'context_snapshot_hash',
    'sanitized_context',
  ],
  US: [
    'model_id',
    'confidence_score',
    'fairness_assessment',
    'impact_assessment_id',
    'data_modification_expected',
    'autonomy_level',
    'context_snapshot_hash',
    'sanitized_context',
  ],
  SG: ['autonomy_level', 'confidence_score', 'data_modification_expected'],
  // BR · LGPD: Art.20 automated decision review right → autonomy_level; Art.20 §1 standards and procedures disclosable → model_id;
  // Art.18 erasure right + PII separation → sanitized_context. LGPD does not require non-repudiation signature, so no signature.
  BR: [
    'model_id',
    'data_modification_expected',
    'autonomy_level',
    'context_snapshot_hash',
    'sanitized_context',
  ],
  // IN · DPDP: §12(1)(d) erasure right → sanitized_context; §12(1)(a-c) correction/completion/update → data_modification_expected;
  // §12(2) downstream cascade notification needs traceable data flow → context_snapshot_hash. DPDP has no dedicated automated-decision clause, so no autonomy_level/model_id.
  IN: ['data_modification_expected', 'context_snapshot_hash', 'sanitized_context'],
};

let cachedProfile: ComplianceProfile | null = null;

/** Parse a comma-separated list; unset or all-empty → empty array (= not selected) */
function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function getComplianceProfile(): ComplianceProfile {
  if (cachedProfile) return cachedProfile;

  // unset = not selected: no default guessing, no warning
  const jurisdictions = parseList(process.env['RULSYNOR_JURISDICTIONS']);
  const industries = parseList(
    process.env['RULSYNOR_INDUSTRIES'] ?? process.env['RULSYNOR_INDUSTRY'],
  );
  const riskLevel = (process.env['RULSYNOR_RISK_LEVEL'] || '').trim();

  const fieldSet = new Set<string>();
  for (const j of jurisdictions) {
    const fields = JURISDICTION_FIELD_MAP[j.toUpperCase()];
    if (fields) for (const f of fields) fieldSet.add(f);
  }
  // Risk condition layer (RFC-002 §5.2): risk_level=critical → signature mandatory.
  // Jurisdiction-independent: even if the jurisdiction itself does not require a signature (e.g. SG/BR/IN), critical still needs signature endorsement.
  // Not included means the risk condition layer is not in effect, vector layer corresponds to V-COMP-F08 (judged compliance_field_missing).
  //
  // [Honest disclosure] the signing layer (ECDSA P-256) is not yet implemented, so under a critical declaration, the DO produced by this runtime
  // is guaranteed to miss the signature field → any conforming verifier will judge compliance_field_missing.
  // This is the **correct** fail-closed behavior (critical genuinely is not satisfied before the signing layer lands),
  // rather than faking compliance with a placeholder signature; this runtime should not yet be used in critical scenarios.
  if (riskLevel.toLowerCase() === 'critical') fieldSet.add('signature');
  const activatedFields = Array.from(fieldSet).sort();

  // no jurisdiction selected → attach no regulatory references (including jurisdiction='ALL' standards-body frameworks):
  // "universally applicable" does not equal "user has chosen to accept its constraints".
  const refs = jurisdictions.length
    ? REGULATORY_REFERENCES.filter(
        r => jurisdictions.includes(r.jurisdiction) || r.jurisdiction === 'ALL',
      )
    : [];

  // Omit over Null: empty means omitted
  const profileWithoutHash: Omit<ComplianceProfile, 'profile_hash'> = {
    profile_id: 'erdl-compliance-v1.5',
    ...(jurisdictions.length ? { jurisdictions } : {}),
    ...(industries.length ? { industries } : {}),
    ...(riskLevel ? { risk_level: riskLevel } : {}),
    ...(activatedFields.length ? { activated_fields: activatedFields } : {}),
    ...(refs.length ? { regulatory_references: refs } : {}),
  };

  const profileHash = `sha256:${createHash('sha256').update(canonicalize(profileWithoutHash)).digest('hex')}`;
  cachedProfile = { ...profileWithoutHash, profile_hash: profileHash };
  return cachedProfile;
}

/** For test/reconfiguration: clear the cache so the next read re-parses environment variables */
export function resetComplianceProfileCache(): void {
  cachedProfile = null;
}
