/**
 * Compliance Profile — standalone (zero framework dependency).
 *
 * 设计原则（全球中立平级，RFC-002 §5.2）：**框架不替用户猜合规辖境**。
 * 三层激活维度（法域 / 行业 / 风险）全部「不预设」——未配置即「未选择」，
 * 不设默认法域、不设默认行业、不设默认风险等级，也不发告警：
 * 选择哪个法域履职、是否落在某行业条件层、按什么风险等级承担义务，
 * 由部署方显式声明（Human Sovereignty），框架只负责按声明激活字段。
 *
 * 未选择时，对应键按「Omit over Null」（RFC-002 §1.3#6）**物理省略**，
 * 不写空数组/占位值——省略与置空在 JCS 下产生不同字节。
 *
 * 环境变量：
 *   RULSYNOR_JURISDICTIONS  逗号分隔法域码（CN/EU/US/SG/BR/IN），未配置 = 未选择
 *   RULSYNOR_INDUSTRIES     逗号分隔行业码（兼容旧的单值 RULSYNOR_INDUSTRY），未配置 = 未选择
 *   RULSYNOR_RISK_LEVEL     风险等级（low/limited/high/critical），未配置 = 未选择
 */
import { createHash } from 'crypto';
import { canonicalize } from 'json-canonicalize';

export interface ComplianceProfile {
  profile_id: string;
  profile_hash: string;
  /** 未选择时省略（不写空数组） */
  jurisdictions?: string[];
  /** 未选择时省略（行业条件层默认不激活） */
  industries?: string[];
  /** 未选择时省略 */
  risk_level?: string;
  /** 无激活法域时省略 */
  activated_fields?: string[];
  /** 无激活法域时省略 */
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

// 注：完整 14 框架目录（RFC-002 §5.2）尚未在运行时内置，当前 6 条；
// 三层激活（行业条件层 / 风险条件层）未实装、validateActivatedFields 未接入，
// 属已登记的 P1 工程缺口（rfc-002-收口审计计划 §12.3），随后续重构补齐。
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

// 法域 → 激活字段映射（与向量集 V-COMP 组 1 同源：RFC-002 §9.1）
//
// 【signature 为何不在各法域集中】2026-08-25 深度 review 修正：
// 历史实现在 CN/EU/US 集中声明了 signature，但签名层尚未实现（V-SIGN 拟定）——
// “声明激活但填不出”会造成两种坏结果：① 若真实缺字段，每条 DO 均判
// compliance_field_missing；② 若用占位值补上，则反而造成合规假阳（fail-open）。
// 故与向量集取齐：哈希层不声明 signature，签名层落地后再补入。
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
  // BR · LGPD：Art.20 自动化决策复核权 → autonomy_level；Art.20 §1 标准与程序可告知 → model_id；
  // Art.18 删除权 + PII 分离 → sanitized_context。LGPD 不要求不可否认签名，不含 signature。
  BR: [
    'model_id',
    'data_modification_expected',
    'autonomy_level',
    'context_snapshot_hash',
    'sanitized_context',
  ],
  // IN · DPDP：§12(1)(d) 擦除权 → sanitized_context；§12(1)(a-c) 更正/补全/更新 → data_modification_expected；
  // §12(2) 下游级联通知需数据流可溯 → context_snapshot_hash。DPDP 无自动化决策专条，不激活 autonomy_level/model_id。
  IN: ['data_modification_expected', 'context_snapshot_hash', 'sanitized_context'],
};

let cachedProfile: ComplianceProfile | null = null;

/** 解析逗号分隔列表；未配置或全空 → 空数组（= 未选择） */
function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function getComplianceProfile(): ComplianceProfile {
  if (cachedProfile) return cachedProfile;

  // 未配置 = 未选择：不猜默认值，不告警
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
  // 风险条件层（RFC-002 §5.2）：risk_level=critical → signature 强制。
  // 与法域无关：即使法域本身不要求签名（如 SG/BR/IN），critical 仍须签名背书。
  // 未纳入即风险条件层未生效，向量层对应 V-COMP-F08（判 compliance_field_missing）。
  //
  // 【诚实披露】签名层（ECDSA P-256）尚未实现，因此在 critical 声明下，本运行时产出的 DO
  // 必定缺 signature 字段 → 任何 conforming 验证器均会判 compliance_field_missing。
  // 这是 fail-closed 的**正确**行为（critical 在签名层落地前确实不满足），
  // 而非用占位签名假装合规；本运行时尚不应用于 critical 场景。
  if (riskLevel.toLowerCase() === 'critical') fieldSet.add('signature');
  const activatedFields = Array.from(fieldSet).sort();

  // 未选择法域 → 不挂任何法规引用（含 jurisdiction='ALL' 的标准组织框架）：
  // 「全域适用」不等于「用户已选择接受其约束」。
  const refs = jurisdictions.length
    ? REGULATORY_REFERENCES.filter(
        r => jurisdictions.includes(r.jurisdiction) || r.jurisdiction === 'ALL',
      )
    : [];

  // Omit over Null：空即省略
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

/** 测试/重配置用：清除缓存，使下次读取重新解析环境变量 */
export function resetComplianceProfileCache(): void {
  cachedProfile = null;
}
