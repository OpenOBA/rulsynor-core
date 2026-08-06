/**
 * Compliance Profile — standalone (zero framework dependency).
 *
 * Reads RULSYNOR_JURISDICTIONS from environment and produces
 * the compliance_profile object for Decision Objects.
 */
import { createHash } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export interface ComplianceProfile {
  profile_id: string;
  profile_hash: string;
  jurisdictions: string[];
  industries: string[];
  risk_level: string;
  activated_fields: string[];
  regulatory_references: RegulatoryReference[];
}

export interface RegulatoryReference {
  framework: string;
  version: string;
  jurisdiction: string;
  effective_date?: string;
  amended_by?: string;
  requires_fields?: string[];
}

const REGULATORY_REFERENCES: RegulatoryReference[] = [
  { framework: 'EU-AI-Act', version: 'Regulation-2024-1689', amended_by: 'Digital-Omnibus-2026', jurisdiction: 'EU', effective_date: '2027-12-02' },
  { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
  { framework: 'NIST-AI-RMF', version: '1.0', jurisdiction: 'US' },
  { framework: 'COSO-GenAI', version: '2026', jurisdiction: 'ALL' },
];

const JURISDICTION_FIELD_MAP: Record<string, string[]> = {
  EU: ['model_id', 'agent.known_limitations', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context', 'signature'],
  CN: ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no', 'agent.model_registration_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context', 'signature'],
  US: ['model_id', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context', 'signature'],
  SG: ['autonomy_level', 'confidence_score', 'data_modification_expected'],
};

let cachedProfile: ComplianceProfile | null = null;

export function getComplianceProfile(): ComplianceProfile {
  if (cachedProfile) return cachedProfile;

  const raw = process.env['RULSYNOR_JURISDICTIONS'];
  const jurisdictions = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : ['CN'];
  const industry = process.env['RULSYNOR_INDUSTRY'] || 'financial-services';
  const riskLevel = process.env['RULSYNOR_RISK_LEVEL'] || 'high';

  const fieldSet = new Set<string>();
  for (const j of jurisdictions) {
    const fields = JURISDICTION_FIELD_MAP[j.toUpperCase()];
    if (fields) for (const f of fields) fieldSet.add(f);
  }

  const refs = REGULATORY_REFERENCES.filter(r => jurisdictions.includes(r.jurisdiction) || r.jurisdiction === 'ALL');

  const profileWithoutHash: Omit<ComplianceProfile, 'profile_hash'> = {
    profile_id: 'erdl-compliance-v1.3',
    jurisdictions,
    industries: [industry],
    risk_level: riskLevel,
    activated_fields: Array.from(fieldSet).sort(),
    regulatory_references: refs,
  };

  const profileHash = `sha256:${createHash('sha256').update(canonicalize(profileWithoutHash)).digest('hex')}`;
  cachedProfile = { ...profileWithoutHash, profile_hash: profileHash };
  return cachedProfile;
}
