#!/usr/bin/env node
/**
 * generate-v1.5.cjs — ERDL Decision Object v1.5 Vector Generator
 *
 * 生成 V-DO-v15 哈希层 78 条向量（D13 + C8 + A10 + K1 + G14 + V-COMP32）。
 * 对齐 RFC-002 §1（扁平哈希 + 唯一删除点）+ SPEC §45.1（审计层矩阵）。
 *
 * 哈希公式（哈希模式）：
 *   audit.hash = "sha256:" + HEX(SHA-256(JCS(DO 全量字段 − audit.hash)))
 *   preimage_version = "erdl-do-v1.5-hash-flat" 进原像
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-22
 * @license MIT
 */
'use strict';

const crypto = require('crypto');
const { canonicalize } = require('json-canonicalize');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  工具
// ═══════════════════════════════════════════════════
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const jcs = (o) => canonicalize(o);

// ═══════════════════════════════════════════════════
//  常量（冻结）
// ═══════════════════════════════════════════════════
const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';
const SPEC = 'decision-object-v1.5';
const TIMESTAMP = '2026-08-22T00:00:00.000Z';
const AGENT_ID = 'did:erdl:sha256:test-runner-v1.5';
const AGENT_AID = '91110108MA12345678A00000001E';
const VIRTUAL_SHA256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

// 确定性 UUIDv7（冻结时间戳 2026-08-22 → 前缀 019b5c5a）
const UUID_BASE = '019b5c5a-0000-7000-8000-';
let uuidIndex = 0;
function deterministicUuid() {
  return UUID_BASE + (++uuidIndex).toString(16).padStart(12, '0');
}

// ═══════════════════════════════════════════════════
//  buildDO — 构建 v1.5 结构 Decision Object（哈希模式）
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
//  答案文件（canonical_hex 物理隔离，合规运行不可读）
// ═══════════════════════════════════════════════════
const answers = {}; // vectorId -> canonical_hex

/**
 * @param {object} o
 * @param {string} o.decisionType   决策类型（13 种之一）
 * @param {object} o.context        评估上下文
 * @param {Array}  o.rules          规则定义 [{id,name,when(canonical S-expr),then,priority,ring}]
 * @param {string} o.chainId        链 ID（session_id）
 * @param {number} o.chainSeq       链内序号（0 起）
 * @param {string|null} o.previousHash 上一条 hash（创世为 null）
 * @param {object} [o.outcome]      结论层（G 系列）
 * @param {Array}  [o.extensions]   extensions（默认 []）
 * @param {Array}  [o.activatedFields] 激活字段（默认全量 CN 激活集）
 * @param {object} [o.override]     构建后覆盖（篡改向量用）
 * @param {object} [o.extra]        额外字段（锚定字段等，哈希前 deep merge）
 * @param {string} [o.authorId]      policies[].author_id（默认 author-openoba，SoD 向量用）
 * @param {Array}  [o.omitFields]    从激活字段中物理省略（compliance_field_missing 向量用）
 * @param {string} [o.answerId]     答案文件键（收集 canonical_hex）
 */
function buildDO(o) {
  const decisionType = o.decisionType;
  const chainId = o.chainId;
  const chainSeq = o.chainSeq;

  // ── policies ──
  const policies = (o.rules || []).map((r, i) => {
    const policy = {
      id: r.id || `policy-${String(i + 1).padStart(3, '0')}`,
      name: r.name || `Policy ${i + 1}`,
      when: r.when || {},
      then: r.then || decisionType,
      priority: r.priority ?? 100,
      ring: r.ring ?? 3,
      author_id: o.authorId || 'author-openoba',
      hash: '',
    };
    // 计算 policy.hash（自引用排除）
    const { hash, ...rest } = policy;
    policy.hash = 'sha256:' + sha256(jcs(rest));
    return policy;
  });

  // ── rule_set_version.id（policies 去 hash 后 JCS）──
  const rsJcs = jcs(policies.map((p) => {
    const { hash, ...rest } = p;
    return rest;
  }));
  const ruleSetId = 'sha256:' + sha256(rsJcs);

  // ── evaluation.matched_rules（含 canonical_tree）──
  const matchedRules = (o.rules || []).map((r) => ({
    rule_id: r.id,
    canonical_tree: r.when || {},
  }));

  // ── compliance_profile ──
  const activatedFields = o.activatedFields || [
    'agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no',
    'agent.model_registration_id', 'model_id', 'confidence_score',
    'fairness_assessment', 'impact_assessment_id', 'data_modification_expected',
    'autonomy_level', 'context_snapshot_hash', 'sanitized_context',
  ];
  const complianceProfile = {
    profile_id: 'erdl-compliance-v1.5',
    profile_hash: '',
    jurisdictions: o.jurisdictions || ['CN'],
    risk_level: o.riskLevel || 'low',
    activated_fields: activatedFields,
    regulatory_references: o.frameworks || [
      { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
    ],
  };
  // Omit over Null：industries 空数组物理删除（RFC-002 §1.3#6）
  if (o.industries && o.industries.length > 0) complianceProfile.industries = o.industries;
  const { profile_hash: _ph, ...cpRest } = complianceProfile;
  complianceProfile.profile_hash = 'sha256:' + sha256(jcs(cpRest));

  // ── JUR 字段值（全量池，按 activated_fields 裁剪）──
  const JUR_VALUES = {
    model_id: 'test-model-v1.5',
    confidence_score: 95,
    fairness_assessment: 'not_applicable',
    impact_assessment_id: '018c4a3e-0009-7000-8000-000000000009',
    data_modification_expected: false,
    autonomy_level: 'L2',
    context_snapshot_hash: VIRTUAL_SHA256,
    sanitized_context: 'sanitized-context-placeholder',
    'agent.aid': AGENT_AID,
    'agent.known_limitations': ['test runner; no real operations'],
    'agent.tool_registry_hash': VIRTUAL_SHA256,
    'agent.algorithm_filing_no': 'NET-2026-000000',
    'agent.model_registration_id': 'MR-2026-000000',
  };

  // ── agent（基础 + 激活的 agent 子字段）+ 顶层 JUR 字段 ──
  const agent = { id: AGENT_ID, role: 'guardian', version: 'v1.5.0' };
  const topJur = {};
  const omitFields = o.omitFields || [];
  for (const f of activatedFields) {
    if (omitFields.includes(f)) continue;  // compliance_field_missing 向量：激活字段物理缺失
    const v = JUR_VALUES[f];
    if (v === undefined) continue;
    if (f.startsWith('agent.')) {
      agent[f.slice(6)] = v;
    } else {
      topJur[f] = v;
    }
  }

  // ── result ──
  const appliedRuleId = policies.length ? policies[0].id : null;
  const result = {
    applied_rule: appliedRuleId,
    reason: `Decision: ${decisionType}`,
    decision: decisionType,
    rules_matched: policies.map((p) => p.id),
  };
  if (o.outcome !== undefined) result.outcome = o.outcome;

  // ── human_oversight（对象化）──
  const humanOversight = { required: decisionType === 'REQUEST_HUMAN' };

  // ── audit（哈希模式）──
  const audit = {
    mode: 'hash',
    hash: '',
    previous_hash: o.previousHash ?? null,
    commitment: {
      agent_id: AGENT_ID,
      tool_name: (o.context && o.context.tool && o.context.tool.name) || 'default',
      decision: decisionType,
    },
    preimage_version: PREIMAGE_VERSION,
    retention: { retention_until: '2029-08-22T00:00:00.000Z', retention_basis: 'GB-Z-185-2026-36-month' },
    chain_id: chainId,
    chain_seq: chainSeq,
  };

  // ── 组装全 DO ──
  let doObj = {
    spec: SPEC,
    decision_id: deterministicUuid(),
    compliance_profile: complianceProfile,
    execution_trace_id: deterministicUuid(),
    timestamp: TIMESTAMP,
    evaluation_duration_ms: 5,
    ...topJur,
    agent,
    context: o.context || {},
    rule_set_version: { id: ruleSetId, timestamp: TIMESTAMP },
    policies,
    evaluation: {
      matched_rules: matchedRules,
      total_evaluated: policies.length,
      total_matched: policies.length,
    },
    result,
    human_oversight: humanOversight,
    audit,
    extensions: o.extensions !== undefined ? o.extensions : [],
  };

  // ── 应用额外字段（锚定字段，哈希前 deep merge）──
  if (o.extra) {
    doObj = deepMerge(doObj, o.extra);
  }

  // ── 应用覆盖（篡改向量用，在哈希计算之前）──
  if (o.override) {
    doObj = applyOverride(doObj, o.override);
  }

  // ── 扁平哈希：删除点 = audit.hash（自引用）+ signature/signing_key_id（防御性，哈希模式下 no-op）──
  // 与验证器 Step 2 / RUNNER_CONTRACT R2 严格同构，避免未来签名模式向量出现生成端与验证端原像分歧
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;
  const canonical = jcs(clone);
  const canonicalHex = Buffer.from(canonical, 'utf8').toString('hex');
  doObj.audit.hash = 'sha256:' + sha256(canonical);
  // canonical_hex 不进 decision_object（物理隔离，进独立答案文件）
  if (o.answerId) answers[o.answerId] = canonicalHex;

  return doObj;
}

/**
 * 答案预言登记（RUNNER_CONTRACT R4 Check 2）——对任意 DO 计算 canonical_hex 并入答案文件。
 *
 * 与 buildDO 内部计算严格同构：deep clone → 删 audit.hash → JCS → UTF-8 hex。
 * 用于 buildDO 之后才定型的 DO（篡改链成员、tampered_do、语义类篡改 DO、金丝雀），
 * 使答案预言覆盖「向量集全部 DO」而非仅 MATCH 型——零死键、零未覆盖。
 */
function registerAnswer(key, doObj) {
  if (!key || !doObj) return;
  // 版本不支持的 DO（如 C07 版本降级攻击的那一条）不登记预言：
  // conforming runner MUST 在 Step 1 提前终止（version_unsupported），永不会产出 v1.5 管线的 canonical bytes。
  // 登记预言反而会逗验证器跳过版本门 → 属于契约违反。
  if (!doObj.audit || doObj.audit.preimage_version !== PREIMAGE_VERSION) return;
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;
  answers[key] = Buffer.from(jcs(clone), 'utf8').toString('hex');
}

/** 深度覆盖：path 用点分（如 'result.decision'），支持数组索引（如 'policies.0.hash'） */
function applyOverride(obj, override) {
  const clone = JSON.parse(JSON.stringify(obj));
  for (const [p, v] of Object.entries(override)) {
    setPath(clone, p, v);
  }
  return clone;
}
function setPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** 递归 deep merge（extra 字段合并进 doObj，用于锚定字段） */
function deepMerge(target, source) {
  const out = JSON.parse(JSON.stringify(target));
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** 重算 audit.hash（篡改后重算使 hash 自洽，用于语义类攻击向量） */
function recomputeHash(doObj) {
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  doObj.audit.hash = 'sha256:' + sha256(jcs(clone));
}

/** 从 fromIndex 起重算 hash（fromIndex 的 previous_hash 保持不变），其后重链 previous_hash */
function rechainFrom(chain, fromIndex) {
  recomputeHash(chain[fromIndex]);
  for (let i = fromIndex + 1; i < chain.length; i++) {
    chain[i].audit.previous_hash = chain[i - 1].audit.hash;
    recomputeHash(chain[i]);
  }
}

/** 点分路径取值 */
function getField(obj, path) {
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

// ═══════════════════════════════════════════════════
//  向量定义工具
// ═══════════════════════════════════════════════════
function V(def) {
  return def;
}
function Rule(r) {
  return r;
}

// 简写：canonical_tree 的常见节点
const field = (p) => ({ field: p });
const eq = (l, r) => ({ eq: [l, r] });
const and = (...args) => ({ and: args });

// ═══════════════════════════════════════════════════
//  D 系列 — 13 决策类型覆盖
// ═══════════════════════════════════════════════════
const D_TYPES = [
  'ALLOW', 'DENY', 'CORRECT', 'NOTIFY', 'REQUEST_HUMAN', 'ESCALATE',
  'DELEGATE', 'DEFER', 'EMERGENCY_HALT', 'ROLLBACK', 'QUARANTINE',
  'WORKFLOW', 'GUIDE',
];

const D_SERIES = D_TYPES.map((dt, i) => {
  const when = dt === 'DENY'
    ? eq(field('context.tool.name'), 'exec')
    : dt === 'ALLOW'
      ? eq(field('context.operation'), 'read')
      : dt === 'REQUEST_HUMAN'
        ? eq(field('context.data_type'), 'PII')
        : eq(field('context.flag'), dt.toLowerCase());
  return V({
    id: `V-DO-v15-D${String(i + 1).padStart(2, '0')}`,
    category: 'D',
    decision_type: dt,
    scenario: `decision-type-${dt.toLowerCase()}`,
    description: `决策类型覆盖：${dt}（扁平哈希 + canonical_tree 字段）`,
    rules: [Rule({ id: `rule-d-${dt.toLowerCase()}`, name: `D ${dt}`, when, then: dt, priority: 100, ring: dt === 'EMERGENCY_HALT' ? 0 : 3 })],
    context: dt === 'DENY' ? { tool: { name: 'exec' } }
      : dt === 'ALLOW' ? { operation: 'read' }
      : dt === 'REQUEST_HUMAN' ? { data_type: 'PII' }
      : { flag: dt.toLowerCase() },
    chainId: 'chain-d-series',
    chainSeq: i,
    previousHash: i === 0 ? null : null, // 每条独立创世（D 系列非链式），由生成器回填
  });
});

// ═══════════════════════════════════════════════════
//  C 系列 — 8 链攻击检测
// ═══════════════════════════════════════════════════

// C01 正常链：3 条 DO 组成合法链（previous_hash 串行锚定）。answerPrefix 为空则不记录答案（供攻击链复用）
function buildNormalChain(answerPrefix) {
  const chainId = 'chain-c01-normal';
  const seq = [];
  let prev = null;
  for (let i = 0; i < 3; i++) {
    const doObj = buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read', step: i },
      rules: [Rule({ id: `rule-c01-${i}`, name: `C01 step ${i}`, when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId, chainSeq: i, previousHash: prev,
      answerId: answerPrefix ? `${answerPrefix}[${i}]` : null,
    });
    prev = doObj.audit.hash;
    seq.push(doObj);
  }
  return seq;
}

// C02~C08：对正常链做各种攻击，产出一条「被篡改的链」。
// 语义类攻击（C03~C08）篡改后**重算 hash 保持自洽**，让验证器靠各自的语义检测器（而非 hash 失配）检出具体 breach 码。
function buildTamperedChain(attackType) {
  const seq = buildNormalChain(null);
  const clone = JSON.parse(JSON.stringify(seq));

  switch (attackType) {
    case 'c02': // 单条篡改（decision 字段，不重算）→ hash_mismatch
      clone[1].result.decision = 'DENY';
      return { vectors: clone, breach: 'hash_mismatch' };
    case 'c03': // 删中间记录（chain_seq 跳变，重链 previous_hash 使唯一异常为 seq 跳变）
      clone.splice(1, 1);
      clone[1].audit.previous_hash = clone[0].audit.hash;
      recomputeHash(clone[1]);
      return { vectors: clone, breach: 'chain_seq_gap' };
    case 'c04': // 指针悬空（previous_hash 悬空，重算 hash 保持自洽）
      clone[1].audit.previous_hash = 'sha256:' + 'f'.repeat(64);
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'previous_hash_dangling' };
    case 'c05': // 时钟回退（timestamp 倒退，重算 hash 保持自洽）
      clone[2].timestamp = '2026-08-21T00:00:00.000Z';
      rechainFrom(clone, 2);
      return { vectors: clone, breach: 'time_regression' };
    case 'c06': // 整链删除后重建（genesis previous_hash 非 null，重算 hash）
      clone[0].audit.previous_hash = 'sha256:' + 'e'.repeat(64);
      rechainFrom(clone, 0);
      return { vectors: clone, breach: 'chain_genesis_mismatch' };
    case 'c07': // 版本降级（preimage_version 篡改为不支持值，重算 hash）
      clone[1].audit.preimage_version = 'erdl-do-v1.3-hash-flat';
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'version_unsupported' };
    case 'c08': // 模式混链（相邻 DO mode 不同，重算 hash）
      clone[1].audit.mode = 'signature';
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'mode_mixed_chain' };
    default:
      throw new Error('unknown attack type: ' + attackType);
  }
}

// ═══════════════════════════════════════════════════
//  主函数
// ═══════════════════════════════════════════════════
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Vector Generator');
  console.log('═══════════════════════════════════════════════');

  // D 系列（独立创世）
  const dVectors = D_SERIES.map((def) => {
    const doObj = buildDO({
      decisionType: def.decision_type,
      context: def.context,
      rules: def.rules,
      chainId: 'chain-d-' + def.decision_type.toLowerCase(),
      chainSeq: 0,
      previousHash: null,
      answerId: def.id,
    });
    return {
      id: def.id,
      category: 'D',
      decision_type: def.decision_type,
      scenario: def.scenario,
      description: def.description,
      context: def.context,
      rules: def.rules.map((r) => r),
      decision_object: doObj,
      expected: { type: 'MATCH', note: 'audit.hash 自洽（独立创世）' },
    };
  });

  // C 系列
  const cVectors = [];
  {
    const normal = buildNormalChain('V-DO-v15-C01');
    cVectors.push({
      id: 'V-DO-v15-C01', category: 'C', decision_type: 'ALLOW',
      scenario: 'normal-chain', description: '正常链（3 条 DO 串行锚定，无攻击）',
      chain: normal, expected: { type: 'MATCH', note: '全链 audit.hash 自洽 + previous_hash 连续' },
    });
  }
  for (const at of ['c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08']) {
    const { vectors, breach } = buildTamperedChain(at);
    cVectors.push({
      id: `V-DO-v15-${at.toUpperCase()}`,
      category: 'C',
      decision_type: 'ALLOW',
      scenario: 'chain-attack',
      description: `链攻击：${at}`,
      chain: vectors,
      expected: { type: 'BREACH', breach },
    });
  }

  // ═══════════════════════════════════════════════════
  //  A 系列 — 10 锚定攻击（base 自洽 + tampered 篡改）
  // ═══════════════════════════════════════════════════
  function buildAnchoredBase(answerId, entryId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: {
        operation: 'read',
        amount: '0.95',
        attachments: [{ storage_key: 's3://oba/report.pdf', content_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', file_name: 'report.pdf', mime_type: 'application/pdf', file_size: 1024 }],
        intent: { source: 'user', category: 'query', summary_hash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        memory_keys: ['mem-1', 'mem-2'],
      },
      rules: [Rule({ id: 'rule-a-base', name: 'A base', when: eq(field('context.amount'), '0.95'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-a-series', chainSeq: 0, previousHash: null,
      extra: {
        evaluation: {
          knowledge_references: [{ entry_id: entryId || 'kb-001', entry_version: 'v1', content_hash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', fragment_hash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' }],
        },
      },
      answerId,
    });
  }

  const A_DEFS = [
    { id: 'V-DO-v15-A01', breach: 'hash_mismatch', tamper: { 'evaluation.knowledge_references.0.content_hash': 'sha256:9999999999999999999999999999999999999999999999999999999999999999' }, desc: '知识正文篡改' },
    { id: 'V-DO-v15-A02', breach: 'content_unresolvable', semantic: true, resolvable_entry_ids: ['kb-001'], tamper: { 'evaluation.knowledge_references.0.entry_id': 'kb-nonexistent' }, desc: '引用不可解析（告警非断裂）' },
    { id: 'V-DO-v15-A03', breach: 'hash_mismatch', tamper: { 'evaluation.knowledge_references.0.fragment_hash': 'sha256:8888888888888888888888888888888888888888888888888888888888888888' }, desc: '分片哈希不符' },
    { id: 'V-DO-v15-A04', breach: 'hash_mismatch', tamper: { 'context.attachments.0.content_hash': 'sha256:7777777777777777777777777777777777777777777777777777777777777777' }, desc: '附件篡改' },
    { id: 'V-DO-v15-A05', breach: 'hash_mismatch', tamper: { 'context.intent.summary_hash': 'sha256:6666666666666666666666666666666666666666666666666666666666666666' }, desc: '意图指针篡改' },
    { id: 'V-DO-v15-A06', breach: 'hash_mismatch', tamper: { 'context.memory_keys.0': 'mem-evil' }, desc: '记忆键篡改' },
    { id: 'V-DO-v15-A07', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: [{ field: 'context.amount' }, '1.00'] } }, desc: '树快照伪造' },
    { id: 'V-DO-v15-A08', breach: 'hash_mismatch', tamper: { 'result.reason': 'evil reason injected' }, desc: 'B 类文本篡改' },
    { id: 'V-DO-v15-A09', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: ['0.95', { field: 'context.amount' }] } }, desc: '树篡改（节点交换序）' },
    { id: 'V-DO-v15-A10', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: [{ field: 'context.amount' }, '0.950'] } }, desc: '树篡改（字面量精度）' },
  ];

  const aVectors = A_DEFS.map((def) => {
    if (def.semantic) {
      // 语义类：篡改 + 重算 hash（自洽），语义检测器检出具体 breach 码
      const doObj = buildAnchoredBase(null);
      for (const [p, v] of Object.entries(def.tamper)) setPath(doObj, p, v);
      recomputeHash(doObj);
      return {
        id: def.id, category: 'A', decision_type: 'ALLOW',
        scenario: 'anchor-attack', description: `锚定攻击：${def.desc}`,
        decision_object: doObj,
        expected: { type: 'BREACH', breach: def.breach, resolvable_entry_ids: def.resolvable_entry_ids },
      };
    }
    // hash 类：base 自洽 + tampered 篡改（不重算）→ hash_mismatch
    const base = buildAnchoredBase(def.id + '-base');
    const tampered = JSON.parse(JSON.stringify(base));
    for (const [p, v] of Object.entries(def.tamper)) setPath(tampered, p, v);
    return {
      id: def.id, category: 'A', decision_type: 'ALLOW',
      scenario: 'anchor-attack', description: `锚定攻击：${def.desc}`,
      base_do: base, tampered_do: tampered,
      expected: { type: 'BREACH', breach: def.breach },
    };
  });

  // ═══════════════════════════════════════════════════
  //  K 系列 — 1 金丝雀（链位置金丝雀，延续 AV-013）
  // ═══════════════════════════════════════════════════
  function buildCanary() {
    const doObj = buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-k01', name: 'K01', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-k01', chainSeq: 0, previousHash: null,
    });
    // 存储「缺陷实现」（删整个 audit）会算出的哈希——正确实现只删 audit.hash，重算 MISMATCH
    const regressed = JSON.parse(JSON.stringify(doObj));
    delete regressed.audit;
    doObj.audit.hash = 'sha256:' + sha256(jcs(regressed));
    return doObj;
  }
  const kVector = {
    id: 'V-DO-v15-K01', category: 'K', decision_type: 'ALLOW',
    scenario: 'chain-position-canary', description: '链位置金丝雀（缺陷实现删整个 audit，正确实现只删 audit.hash → MISMATCH）',
    decision_object: buildCanary(),
    expected: { type: 'BREACH', breach: 'canary_mismatch', note: '正确实现重算 MISMATCH，缺陷实现 MATCH' },
  };

  // ═══════════════════════════════════════════════════
  //  G 系列 — 14 结论层（结构攻击 6 + 领域示例 8）
  // ═══════════════════════════════════════════════════
  function buildOutcomeDO(scenario, outcome, answerId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-g', name: 'G', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-g', chainSeq: 0, previousHash: null,
      outcome: { scenario, ...outcome },
      answerId,
    });
  }

  const G_STRUCT = [
    { id: 'V-DO-v15-G01', tamper: { 'result.outcome.verdict': 'rejected' }, desc: 'verdict 篡改' },
    { id: 'V-DO-v15-G02', tamper: { 'result.outcome.grade': 'F' }, desc: 'grade·rank 篡改' },
    { id: 'V-DO-v15-G03', tamper: { 'result.outcome.basis': [] }, desc: 'basis 删除' },
    { id: 'V-DO-v15-G04', tamper: { 'result.outcome.extra': { note: 'evil' } }, desc: 'extra 篡改' },
    { id: 'V-DO-v15-G05', tamper: { 'result.outcome.basis.0': 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }, desc: 'registry 引用篡改' },
    { id: 'V-DO-v15-G06', tamper: null, deleteOutcome: true, desc: 'outcome 整体删除' },
  ];

  const gStructVectors = G_STRUCT.map((def) => {
    const base = buildOutcomeDO('gov.approval', { verdict: 'approved', grade: 'A', rank: 1, basis: ['sha256:verdict-registry-001'], extra: { note: 'test' } }, def.id + '-base');
    const tampered = JSON.parse(JSON.stringify(base));
    if (def.deleteOutcome) {
      delete tampered.result.outcome;
    } else {
      for (const [p, v] of Object.entries(def.tamper)) setPath(tampered, p, v);
    }
    return {
      id: def.id, category: 'G', decision_type: 'ALLOW',
      scenario: 'outcome-structure-attack', description: `结论层结构攻击：${def.desc}`,
      base_do: base, tampered_do: tampered,
      expected: { type: 'BREACH', breach: 'hash_mismatch' },
    };
  });

  const G_SCENARIOS = [
    { id: 'V-DO-v15-G07', scenario: 'gov.approval', verdict: 'approved', desc: '政务·行政审批' },
    { id: 'V-DO-v15-G08', scenario: 'gov.review', verdict: 'passed', desc: '政务·多级审核' },
    { id: 'V-DO-v15-G09', scenario: 'gov.selection', verdict: 'selected', rank: 1, desc: '政务·评选' },
    { id: 'V-DO-v15-G10', scenario: 'gov.appraisal', verdict: 'rated', grade: 'A', desc: '政务·评定' },
    { id: 'V-DO-v15-G11', scenario: 'corp.hiring', verdict: 'hired', desc: '企业·招聘审批' },
    { id: 'V-DO-v15-G12', scenario: 'corp.procurement', verdict: 'awarded', rank: 2, desc: '企业·采购评标' },
    { id: 'V-DO-v15-G13', scenario: 'corp.performance', verdict: 'rated', grade: 'B+', desc: '企业·绩效评定' },
    { id: 'V-DO-v15-G14', scenario: 'corp.contract', verdict: 'approved', desc: '企业·合同审批' },
  ];
  const gScenarioVectors = G_SCENARIOS.map((def) => {
    const outcome = { verdict: def.verdict };
    if (def.rank !== undefined) outcome.rank = def.rank;
    if (def.grade !== undefined) outcome.grade = def.grade;
    const doObj = buildOutcomeDO(def.scenario, outcome, def.id);
    return {
      id: def.id, category: 'G', decision_type: 'ALLOW',
      scenario: 'outcome-domain-example', description: `结论层领域示例：${def.desc}`,
      decision_object: doObj,
      expected: { type: 'MATCH', note: 'outcome 结论层随扁平哈希自洽' },
    };
  });

  // ═══════════════════════════════════════════════════
  //  V-COMP 系列 — 26 法域合规（辖区激活 5 + 框架映射 14 + 失败检测 7）
  // ═══════════════════════════════════════════════════
  // 权威法域集合（RFC-002 §5.2）
  const KNOWN_JURISDICTIONS = ['CN', 'EU', 'US', 'SG', 'BR', 'IN'];

  const CN_FIELDS = ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no', 'agent.model_registration_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const EU_FIELDS = ['model_id', 'agent.known_limitations', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const US_FIELDS = ['model_id', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const SG_FIELDS = ['autonomy_level', 'confidence_score', 'data_modification_expected'];
  // BR · LGPD（Lei 13.709/2018）：Art.20 自动化决策复核权 → autonomy_level（是否「仅基于自动化处理」）；
  // Art.20 §1 标准与程序可告知 → model_id；Art.18 删除权 + PII 分离 → sanitized_context；
  // 处理可溯源 → context_snapshot_hash；是否变更个人数据 → data_modification_expected。
  // LGPD 不明文要求人工介入（原草案要求，2019 修正删除），故不激活 human_oversight 强制。
  const BR_FIELDS = ['model_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  // IN · DPDP（2023 Act No.22）：§12(1)(d) 擦除权（目的完成/撤回同意）→ sanitized_context；
  // §12(1)(a-c) 更正/补全/更新 → data_modification_expected；§12(2) 下游级联通知需数据流可溯 → context_snapshot_hash。
  // DPDP 未设自动化决策专条，故不激活 autonomy_level / model_id。
  const IN_FIELDS = ['data_modification_expected', 'context_snapshot_hash', 'sanitized_context'];

  function buildVcompDO(def, answerId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-vcomp', name: 'VCOMP', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-vcomp', chainSeq: 0, previousHash: null,
      jurisdictions: def.juris,
      activatedFields: def.activated,
      riskLevel: def.riskLevel,
      answerId,
    });
  }

  // 辖区激活字段完整性（RFC-002 §9.1 第一组）
  // signature 随 S3 签名层落地后补入，哈希层向量暂不含（§10.3 拟定冻结）
  const VCOMP_JURIS = [
    { id: 'V-COMP-001', juris: ['CN'], activated: CN_FIELDS, required: CN_FIELDS, desc: 'CN · GB/Z 185' },
    { id: 'V-COMP-002', juris: ['EU'], activated: EU_FIELDS, required: EU_FIELDS, desc: 'EU · AI Act' },
    { id: 'V-COMP-003', juris: ['US'], activated: US_FIELDS, required: US_FIELDS, desc: 'US 综合' },
    { id: 'V-COMP-004', juris: ['SG'], activated: SG_FIELDS, required: SG_FIELDS, desc: 'SG · MGF' },
    { id: 'V-COMP-005', juris: ['CN', 'EU'], activated: [...new Set([...CN_FIELDS, ...EU_FIELDS])], required: [...new Set([...CN_FIELDS, ...EU_FIELDS])], desc: 'CN+EU 多法域并集' },
    { id: 'V-COMP-020', juris: ['BR'], activated: BR_FIELDS, required: BR_FIELDS, desc: 'BR · LGPD' },
    { id: 'V-COMP-021', juris: ['IN'], activated: IN_FIELDS, required: IN_FIELDS, desc: 'IN · DPDP' },
  ];
  const vcompJurisVectors = VCOMP_JURIS.map((def) => {
    const doObj = buildVcompDO(def, def.id);
    return {
      id: def.id, category: 'V-COMP', decision_type: 'ALLOW',
      scenario: 'jurisdiction-activation', description: `辖区激活字段完整性：${def.desc}`,
      decision_object: doObj, expected: { type: 'MATCH', required_fields: def.required },
    };
  });

  // 框架字段映射（RFC-002 §9.1 第二组）
  // activated = 需激活的 JUR 字段；required = 完整检查字段路径（含 CORE/result 常驻字段）；checks = 语义检查
  const VCOMP_FRAMEWORKS = [
    { id: 'V-COMP-006', activated: ['agent.known_limitations'], required: ['evaluation_duration_ms', 'human_oversight', 'agent.known_limitations'], desc: 'EU AI Act Art.12/14/13' },
    { id: 'V-COMP-007', activated: ['model_id', 'confidence_score', 'fairness_assessment'], required: ['model_id', 'confidence_score', 'fairness_assessment'], desc: 'NIST AI RMF' },
    { id: 'V-COMP-008', activated: [], required: ['rule_set_version'], checks: ['sod'], desc: 'COSO GenAI（SoD）' },
    { id: 'V-COMP-009', activated: ['impact_assessment_id'], required: ['impact_assessment_id'], desc: 'ISO/IEC 42001' },
    { id: 'V-COMP-010', activated: ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no'], required: ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no', 'audit.retention'], desc: 'GB/Z 185（留存≥36月）' },
    { id: 'V-COMP-011', activated: [], required: ['result.decision', 'result.reason'], desc: 'OWASP Agentic（可解释）' },
    { id: 'V-COMP-012', activated: ['data_modification_expected', 'sanitized_context'], required: ['data_modification_expected', 'sanitized_context'], desc: 'HIPAA（signature 随 S3）' },
    { id: 'V-COMP-013', activated: ['data_modification_expected'], required: ['data_modification_expected'], desc: 'PCI DSS（signature 随 S3）' },
    { id: 'V-COMP-014', activated: ['fairness_assessment'], required: ['result.decision', 'result.reason', 'fairness_assessment'], desc: 'Colorado SB 205' },
    { id: 'V-COMP-015', activated: ['autonomy_level'], required: ['autonomy_level'], desc: 'Singapore MGF' },
    { id: 'V-COMP-016', activated: ['data_modification_expected'], required: ['data_modification_expected', 'result.decision', 'result.reason'], desc: '中国信通院 2.0（可解释）' },
    { id: 'V-COMP-017', activated: ['sanitized_context'], required: ['sanitized_context'], desc: 'LGPD（被遗忘权/PII 分离）' },
    { id: 'V-COMP-018', activated: ['sanitized_context'], required: ['sanitized_context'], desc: 'DPDP（同 LGPD）' },
    { id: 'V-COMP-019', activated: [], required: ['execution_trace_id'], desc: 'IEEE P3395（跨系统关联）' },
  ];
  const vcompFrameworkVectors = VCOMP_FRAMEWORKS.map((def) => {
    const doObj = buildVcompDO(def, def.id);
    return {
      id: def.id, category: 'V-COMP', decision_type: 'ALLOW',
      scenario: 'framework-field-mapping', description: `框架字段映射：${def.desc}`,
      decision_object: doObj, expected: { type: 'MATCH', required_fields: def.required, checks: def.checks || [] },
    };
  });

  // F01~F07 失败检测（RFC-002 §9.1 第三组）
  // 语义类（F01/F03/F04/F05）：hash 自洽 + 语义检测器检出具体 breach
  // hash 类（F02/F06/F07）：base 自洽 + tampered 篡改（不重算）→ hash_mismatch
  function buildFBase(answerId, opts) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-f', name: 'F', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-vcomp-f', chainSeq: 0, previousHash: null,
      activatedFields: CN_FIELDS,
      ...opts,
      answerId,
    });
  }
  const fVectors = [];
  {
    // F01 激活字段缺失（agent.aid 在 activated_fields 但物理缺失，hash 自洽）
    const doObj = buildFBase(null, { omitFields: ['agent.aid'] });
    fVectors.push({ id: 'V-COMP-F01', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：激活字段缺失', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F02 合规画像被偷换（篡改 profile_hash，不重算 → hash_mismatch）
    const base = buildFBase('V-COMP-F02-base');
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.compliance_profile.profile_hash = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';
    fVectors.push({ id: 'V-COMP-F02', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：合规画像被偷换', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F03 法域不匹配（jurisdictions=['XX']，hash 自洽 → jurisdiction_mismatch）
    const doObj = buildFBase(null, { jurisdictions: ['XX'] });
    fVectors.push({ id: 'V-COMP-F03', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：法域不匹配', decision_object: doObj, expected: { type: 'BREACH', breach: 'jurisdiction_mismatch' } });
  }
  {
    // F04 高风险无人类监督（riskLevel=high 但 human_oversight.required=false，hash 自洽 → oversight_missing）
    const doObj = buildFBase(null, { riskLevel: 'high' });
    fVectors.push({ id: 'V-COMP-F04', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：高风险决策无人类监督', decision_object: doObj, expected: { type: 'BREACH', breach: 'oversight_missing' } });
  }
  {
    // F05 SoD 违反（policies[].author_id = agent.id，hash 自洽 → sod_violation）
    const doObj = buildFBase(null, { authorId: AGENT_ID });
    fVectors.push({ id: 'V-COMP-F05', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：SoD 违反', decision_object: doObj, expected: { type: 'BREACH', breach: 'sod_violation' } });
  }
  {
    // F06 第一层合规声明篡改（agent.known_limitations，不重算 → hash_mismatch）
    const base = buildFBase('V-COMP-F06-base', { activatedFields: EU_FIELDS, jurisdictions: ['EU'] });
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.agent.known_limitations = ['evil claim injected'];
    fVectors.push({ id: 'V-COMP-F06', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：第一层合规声明篡改', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F07 备案与身份字段篡改（agent.algorithm_filing_no，不重算 → hash_mismatch）
    const base = buildFBase('V-COMP-F07-base');
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.agent.algorithm_filing_no = 'EVIL-2026-999999';
    fVectors.push({ id: 'V-COMP-F07', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '合规失败：备案与身份字段篡改', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F08 风险条件层未生效：risk_level=critical 但画像未将 signature 纳入 activated_fields
    // （RFC-002 §5.2 critical → signature 强制）。decisionType=REQUEST_HUMAN 使 human_oversight.required=true，
    // 排除 oversight_missing 干扰 —— 向量 MUST 只含单一 breach，不依赖未规范的检测优先级。
    const doObj = buildFBase(null, { riskLevel: 'critical', decisionType: 'REQUEST_HUMAN' });
    fVectors.push({ id: 'V-COMP-F08', category: 'V-COMP', decision_type: 'REQUEST_HUMAN', scenario: 'compliance-failure', description: '合规失败：critical 风险未激活 signature（风险条件层未生效）', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F09 critical 已激活 signature 但字段缺失（值级缺失；JUR_VALUES 无 signature 值 → 物理缺失）。
    // 此条是哈希层能验的那一半：存在性。认可的 critical 正例（签名模式 + 验签）属签名层，随 V-SIGN 落地。
    const doObj = buildFBase(null, { riskLevel: 'critical', decisionType: 'REQUEST_HUMAN', activatedFields: [...CN_FIELDS, 'signature'] });
    fVectors.push({ id: 'V-COMP-F09', category: 'V-COMP', decision_type: 'REQUEST_HUMAN', scenario: 'compliance-failure', description: '合规失败：critical 已激活 signature 但字段缺失', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F10 多重违规 —— 铉住优先级上端：P1 jurisdiction_mismatch 先于 P2 compliance_field_missing。
    // 同时成立：法域码 XX 不可识别（P1）+ 激活字段 agent.aid 物理缺失（P2）。
    // 意义：防「编造法域码 + 空/残缺激活集」掩盖字段完备性失败（RFC §9.1.1）。
    const doObj = buildFBase(null, { jurisdictions: ['XX'], omitFields: ['agent.aid'] });
    fVectors.push({ id: 'V-COMP-F10', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '多重违规优先级：法域码不可识别 + 激活字段缺失 → 报 P1', decision_object: doObj, expected: { type: 'BREACH', breach: 'jurisdiction_mismatch', also_present: ['compliance_field_missing'] } });
  }
  {
    // F11 多重违规 —— 铉住优先级下端：P5 tree_snapshot_divergence 先于 P6 content_unresolvable。
    // 同时成立：树快照与规则源不一致（P5 证据层真实违规）+ 知识引用不可解析（P6 告警级）。
    // 意义：告警级（冷存储删除/留存到期）MUST NOT 掩盖证据层违规（RFC §9.1.1）。
    // 旧顶序会报 content_unresolvable，规范顶序报 tree_snapshot_divergence —— 本向量具鉴别力。
    const doObj = buildFBase(null, {
      extra: {
        evaluation: {
          knowledge_references: [{ entry_id: 'kb-deleted-by-retention', entry_version: 'v1', content_hash: VIRTUAL_SHA256, fragment_hash: VIRTUAL_SHA256 }],
        },
      },
    });
    // 伪造树快照（与 policies[0].when 的 eq(context.operation,'read') 分歧），重算 hash 保持自洽
    setPath(doObj, 'evaluation.matched_rules.0.canonical_tree', { eq: [{ field: 'context.operation' }, 'write'] });
    recomputeHash(doObj);
    fVectors.push({ id: 'V-COMP-F11', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: '多重违规优先级：树快照分歧（证据层）+ 引用不可解析（告警级）→ 报 P5，告警不得掩盖违规', decision_object: doObj, expected: { type: 'BREACH', breach: 'tree_snapshot_divergence', resolvable_entry_ids: ['kb-001'], also_present: ['content_unresolvable'] } });
  }

  const output = {
    $schema: 'https://openoba.com/erdl/decision-object-v1.5/schema.json',
    spec: SPEC,
    preimage_version: PREIMAGE_VERSION,
    version: 'v1.5.0',
    created: '2026-08-22',
    maintainer: 'OpenOBA (https://openoba.com)',
    description: 'V-DO-v15 哈希层向量（D + C + A + K + G + V-COMP 系列）。扁平哈希：JCS(DO − audit.hash) → SHA-256。',
    vectors: [...dVectors, ...cVectors, ...aVectors, kVector, ...gStructVectors, ...gScenarioVectors, ...vcompJurisVectors, ...vcompFrameworkVectors, ...fVectors],
  };

  // ── 答案预言全覆盖（RUNNER_CONTRACT R4 Check 2 + R5 金丝雀 Check 2）──
  // 每个 DO 一个键：decision_object → <id>；篡改对 → <id>-base / <id>-tampered；链 → <id>[i]。
  // buildDO 已登记的键在此被同值重登记（幂等），新增的是攻击链成员 / tampered / 语义类篡改 DO / 金丝雀。
  for (const v of output.vectors) {
    if (v.decision_object) registerAnswer(v.id, v.decision_object);
    if (v.base_do) {
      registerAnswer(v.id + '-base', v.base_do);
      registerAnswer(v.id + '-tampered', v.tampered_do);
    }
    if (v.chain) v.chain.forEach((d, i) => registerAnswer(`${v.id}[${i}]`, d));
  }

  const outputPath = path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  // 答案文件（canonical_hex 物理隔离）
  const answersPath = path.join(__dirname, '..', 'decision-object-answers-v1.5.json');
  fs.writeFileSync(answersPath, JSON.stringify({ answers }, null, 2), 'utf8');

  console.log(`  ✓ 写入 ${outputPath}`);
  console.log(`  ✓ 写入答案文件 ${answersPath}（${Object.keys(answers).length} 条 canonical_hex）`);
  console.log(`  D 系列: ${dVectors.length} 条`);
  console.log(`  C 系列: ${cVectors.length} 条`);
  console.log(`  A 系列: ${aVectors.length} 条`);
  console.log(`  K 系列: 1 条`);
  console.log(`  G 系列: ${gStructVectors.length + gScenarioVectors.length} 条（结构攻击 ${gStructVectors.length} + 领域示例 ${gScenarioVectors.length}）`);
  console.log(`  V-COMP 系列: ${vcompJurisVectors.length + vcompFrameworkVectors.length + fVectors.length} 条（辖区 ${vcompJurisVectors.length} + 框架 ${vcompFrameworkVectors.length} + 失败检测 ${fVectors.length}）`);  const total = dVectors.length + cVectors.length + aVectors.length + 1 + gStructVectors.length + gScenarioVectors.length + vcompJurisVectors.length + vcompFrameworkVectors.length + fVectors.length;
  console.log(`  合计: ${total} 条`);
}

main();
