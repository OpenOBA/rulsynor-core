#!/usr/bin/env node
/**
 * verify-v1.5.js — ERDL Decision Object v1.5 验证器（七步验证法，原「五步」，Step 0–6 共 7 步，RFC-002 §7）
 *
 * 零依赖验证 decision-object-vectors-v1.5.json（self-built JCS + SHA-256）。
 *
 * 五步验证法（RFC-002 §7）：
 *   Step 0: 版本判别（v1.5 扁平哈希 / v1.3 历史路径）
 *   Step 1: 读 audit.preimage_version（域分隔符常量）
 *   Step 2: Deep clone → 唯一删除点 DELETE audit.hash（零投影）
 *   Step 3: JCS(RFC 8785) → canonical bytes
 *   Step 4: SHA-256 → recomputed hash
 *   Step 5: 对比 stored audit.hash
 *   Step 6: 答案文件交叉比对（canonical_hex，物理隔离；覆盖向量集全部 DO，含 BREACH/tampered/链成员）
 *
 * 语义检测层（RFC-002 §8 链断裂 / §9.1 合规失败）：
 *   单 DO：compliance_field_missing（含 risk_level=critical → signature 强制）/ jurisdiction_mismatch / oversight_missing / sod_violation
 *   多重违规：按 §9.1.1 优先级 P1→P6 报首项；向量 MUST 在 expected.also_present 声明被拑压项（验证器强制校验）
 *   链：hash_mismatch / version_unsupported / chain_genesis_mismatch / previous_hash_dangling
 *        / chain_seq_gap / mode_mixed_chain / time_regression
 *
 * 向量形态：
 *   - decision_object：独立 DO（MATCH 正例 / 语义 BREACH / 金丝雀）
 *   - chain：DO 链（C01 正常链 + C02~C08 攻击链，断言具体 breach 码）
 *   - base_do + tampered_do：篡改对（base 自洽，tampered 失配 → hash_mismatch）
 *
 * 用法：
 *   node verify-v1.5.js [path/to/vectors.json] [--answers <path>]
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-22
 * @license MIT
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  常量（冻结）
// ═══════════════════════════════════════════════════
const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';
const KNOWN_JURISDICTIONS = ['CN', 'EU', 'US', 'SG', 'BR', 'IN'];

// ═══════════════════════════════════════════════════
//  SHA-256
// ═══════════════════════════════════════════════════
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════
//  JCS (RFC 8785) — self-built, zero-dependency
// ═══════════════════════════════════════════════════
function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true; // 高代理无配对
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true; // 孤立低代理
    }
  }
  return false;
}

function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('JCS: NaN/Infinity not allowed');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new Error('JCS: lone surrogate not allowed');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(jcsCanonicalize).join(',') + ']';
  }
  if (typeof value === 'bigint') throw new Error('JCS: BigInt not allowed');
  if (typeof value === 'symbol') throw new Error('JCS: Symbol not allowed');
  if (typeof value === 'function') throw new Error('JCS: Function not allowed');
  if (typeof value === 'object') {
    if (value instanceof Date) throw new Error('JCS: Date not serializable');
    if (value.constructor !== Object && value.constructor !== Array) {
      throw new Error('JCS: non-plain object not serializable');
    }
    const keys = Object.keys(value).sort();
    const members = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) continue;
      members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v));
    }
    return '{' + members.join(',') + '}';
  }
  throw new Error('JCS: unsupported type ' + typeof value);
}

// ═══════════════════════════════════════════════════
//  RFC-002 §1.3#3：number 字段 MUST 为安全整数（禁小数/越界）
// ═══════════════════════════════════════════════════
function assertSafeIntegers(value) {
  if (Array.isArray(value)) { value.forEach(assertSafeIntegers); return; }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) assertSafeIntegers(value[k]);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error('non-integer or unsafe number: ' + value);
    }
  }
}

// ═══════════════════════════════════════════════════
//  点分路径取值
// ═══════════════════════════════════════════════════
function getField(obj, path) {
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

// ═══════════════════════════════════════════════════
//  五步验证法（Step 0–5）
// ═══════════════════════════════════════════════════
function verifyDO(decisionObject) {
  // DoS 保护
  const doJson = JSON.stringify(decisionObject);
  if (doJson.length > 1024 * 1024) {
    return { passed: false, error: 'resource_limit_exceeded: DO exceeds 1 MB' };
  }

  // Step 0: 版本判别（canonical_tree 或 v1.5 特征字段 → v1.5 扁平哈希）
  const evalObj = decisionObject.evaluation;
  const hasCanonicalTree =
    evalObj && Array.isArray(evalObj.matched_rules) &&
    evalObj.matched_rules.some((m) => m.canonical_tree !== undefined);
  const hasV15Field =
    (decisionObject.audit && decisionObject.audit.preimage_version === PREIMAGE_VERSION) ||
    (decisionObject.compliance_profile && Array.isArray(decisionObject.compliance_profile.activated_fields));
  if (!hasCanonicalTree && !hasV15Field) {
    return { passed: false, error: 'v1.3 历史路径（无 v1.5 特征），本验证器仅处理 v1.5' };
  }

  // Step 1: 读 preimage_version
  const preimageVersion = decisionObject.audit && decisionObject.audit.preimage_version;
  if (preimageVersion !== PREIMAGE_VERSION) {
    return { passed: false, error: 'preimage_version 不支持: ' + preimageVersion };
  }

  // 整数约束（RFC-002 §1.3#3）
  try {
    assertSafeIntegers(decisionObject);
  } catch (e) {
    return { passed: false, error: e.message };
  }

  // Step 2: Deep clone → 删除点（R2）：audit.hash 自引用排除 + signature/signing_key_id 防御性删除
  // （哈希模式下后两者不存在，删除为 no-op；签名模式下 MUST 剔除，RFC-002 §1.1 / RUNNER_CONTRACT R2）
  const clone = JSON.parse(JSON.stringify(decisionObject));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;

  // Step 3: JCS
  const canonical = jcsCanonicalize(clone);

  // Step 4: SHA-256
  const computedHash = 'sha256:' + sha256(canonical);

  // Step 5: 对比
  const storedHash = decisionObject.audit.hash;
  return {
    passed: computedHash === storedHash,
    computedHash,
    storedHash,
    canonicalHex: Buffer.from(canonical, 'utf8').toString('hex'),
  };
}

// ═══════════════════════════════════════════════════
//  单 DO 语义 breach 检测（RFC-002 §9.1 第三组）
//
//  【规范优先级 P1→P6】（RFC-002 §9.1.1，与 §8 链层优先级同构）
//  P1 jurisdiction_mismatch      法域码不可识别 → 画像整体不可解释，其余判定失去前提
//  P2 compliance_field_missing   画像声明的必需字段缺失（含 critical → signature 强制）
//  P3 oversight_missing          高风险/关键决策缺人类监督记录
//  P4 sod_violation              职责分离违反（agent.id == policies[].author_id）
//  P5 tree_snapshot_divergence   证据层：决策记录的树快照与规则源不一致
//  P6 content_unresolvable       引用完整性【告警级】（RFC §8：告警非断裂）→ MUST 最后
//
//  为何 P6 必须最后：content_unresolvable 是告警而非违规，若排在前面，
//  一条冷存储已删除的知识引用会掩盖同时存在的真实违规（如 SoD）。
//  为何 P1 最先：未知法域码若被后置，可用编造法域码 + 空激活集绕过字段完备性检查。
// ═══════════════════════════════════════════════════
function detectDOBreach(doObj, meta) {
  return collectDOBreaches(doObj, meta)[0] || null;
}

/**
 * 按 §9.1.1 优先级返回**全部同时成立**的 breach（有序）。
 * detectDOBreach 取其首项；验证器用全量结果强制校验向量的 `expected.also_present`（共存性 + 被拑压性）。
 */
function collectDOBreaches(doObj, meta) {
  const cp = doObj.compliance_profile || {};
  const hits = [];

  // P1. jurisdiction_mismatch：法域码不在权威集合（RFC-002 §5.2 六法域）
  //     语义已显式收窄为「不可识别的法域码」（fail-closed）；
  //     「DO 声明法域 ≠ 部署期望法域」不属无状态验证器范围（见 RFC §9.1.2）。
  const juris = Array.isArray(cp.jurisdictions) ? cp.jurisdictions : [];
  if (juris.some((j) => !KNOWN_JURISDICTIONS.includes(j))) hits.push('jurisdiction_mismatch');

  // P2. compliance_field_missing：激活字段缺失
  const activated = Array.isArray(cp.activated_fields) ? cp.activated_fields : [];
  const fieldMissing = activated.some((f) => getField(doObj, f) === undefined);
  // P2b. 风险条件层（RFC-002 §5.2）：risk_level=critical → signature 强制
  //      画像 MUST 将 signature 纳入 activated_fields；未纳入即风险条件层未生效，
  //      合规后果与「已激活但缺值」同质（缺必需合规字段），故复用同一 breach 码，不新增码。
  const criticalWithoutSignature = cp.risk_level === 'critical' && !activated.includes('signature');
  if (fieldMissing || criticalWithoutSignature) hits.push('compliance_field_missing');

  // P3. oversight_missing：高风险无人类监督
  const risk = cp.risk_level;
  const oversight = doObj.human_oversight;
  if ((risk === 'high' || risk === 'critical') && (!oversight || oversight.required !== true)) {
    hits.push('oversight_missing');
  }

  // P4. sod_violation：agent.id === policies[].author_id
  const agentId = doObj.agent && doObj.agent.id;
  if (agentId && Array.isArray(doObj.policies) && doObj.policies.some((p) => p.author_id === agentId)) {
    hits.push('sod_violation');
  }

  // P5. tree_snapshot_divergence：canonical_tree 快照与规则源（policies[].when）重编译不一致
  const matched = doObj.evaluation && doObj.evaluation.matched_rules;
  const policies = Array.isArray(doObj.policies) ? doObj.policies : [];
  if (Array.isArray(matched)) {
    for (const m of matched) {
      const p = policies.find((pp) => pp.id === m.rule_id);
      if (p && m.canonical_tree !== undefined && p.when !== undefined &&
          jcsCanonicalize(m.canonical_tree) !== jcsCanonicalize(p.when)) {
        hits.push('tree_snapshot_divergence');
        break;
      }
    }
  }

  // P6. content_unresolvable（引用完整性告警，非断裂）：knowledge_reference.entry_id 不在可解析集
  const refs = doObj.evaluation && doObj.evaluation.knowledge_references;
  if (Array.isArray(refs) && meta && Array.isArray(meta.resolvable_entry_ids)) {
    if (refs.some((r) => !meta.resolvable_entry_ids.includes(r.entry_id))) hits.push('content_unresolvable');
  }

  return hits;
}

// ═══════════════════════════════════════════════════
//  链 breach 检测（RFC-002 §8 断裂判定 + §9.2）
// ═══════════════════════════════════════════════════
function detectChainBreach(chain) {
  // ① hash 重算不匹配 / ④ preimage 版本不支持
  for (const dobj of chain) {
    const r = verifyDO(dobj);
    if (!r.passed) {
      if (r.error && r.error.startsWith('preimage_version')) return 'version_unsupported';
      return 'hash_mismatch';
    }
  }
  // 创世块 previous_hash 非 null → chain_genesis_mismatch
  if (chain.length > 0 && chain[0].audit && chain[0].audit.previous_hash !== null) {
    return 'chain_genesis_mismatch';
  }
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1].audit;
    const cur = chain[i].audit;
    // ② previous_hash 与上一条 hash 不一致
    if (cur.previous_hash !== prev.hash) return 'previous_hash_dangling';
    // ③ 链中 DO 缺失（chain_seq 跳变）
    if (cur.chain_seq !== prev.chain_seq + 1) return 'chain_seq_gap';
    // ⑤ mode 混链
    if (cur.mode !== prev.mode) return 'mode_mixed_chain';
    // 时钟回退（time_regression）
    if (chain[i].timestamp < chain[i - 1].timestamp) return 'time_regression';
  }
  return null;
}

// ═══════════════════════════════════════════════════
//  主函数
// ═══════════════════════════════════════════════════
function main() {
  const args = process.argv.slice(2);
  let vectorsPath = null;
  let answersPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--answers' && i + 1 < args.length) {
      answersPath = args[i + 1]; i++;
    } else if (!args[i].startsWith('--')) {
      vectorsPath = args[i];
    }
  }
  vectorsPath = vectorsPath || path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');

  if (!fs.existsSync(vectorsPath)) {
    console.error('ERROR: vectors file not found: ' + vectorsPath);
    process.exit(1);
  }

  let answersData = null;
  if (answersPath && fs.existsSync(answersPath)) {
    answersData = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
  }

  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Vector Verifier');
  console.log('  preimage_version: ' + data.preimage_version);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let pass = 0, fail = 0, canaryOk = 0;
  const breakdown = {};
  const errors = [];

  for (const v of data.vectors) {
    const cat = v.category;
    breakdown[cat] = breakdown[cat] || { total: 0, pass: 0 };
    const exp = v.expected || {};

    if (v.decision_object) {
      breakdown[cat].total++;
      const doObj = v.decision_object;
      const r = verifyDO(doObj);

      if (exp.type === 'MATCH') {
        let ok = r.passed;
        // 字段完整性（RFC-002 §9.1 第一/二组）
        if (ok && Array.isArray(exp.required_fields)) {
          for (const f of exp.required_fields) {
            if (getField(doObj, f) === undefined) {
              ok = false;
              errors.push(v.id + ' required_field 缺失: ' + f);
            }
          }
        }
        // 语义检查（SoD）
        if (ok && Array.isArray(exp.checks) && exp.checks.includes('sod')) {
          const agentId = doObj.agent && doObj.agent.id;
          if (agentId && Array.isArray(doObj.policies) && doObj.policies.some((p) => p.author_id === agentId)) {
            ok = false;
            errors.push(v.id + ' SoD 违反');
          }
        }
        if (ok) { pass++; breakdown[cat].pass++; }
        else { fail++; if (!r.passed && errors.length && !errors.some((e) => e.startsWith(v.id))) errors.push(v.id + ' 自洽失败: ' + (r.error || 'hash mismatch')); }
      } else if (exp.type === 'BREACH') {
        if (v.id === 'V-DO-v15-K01') {
          // 金丝雀：正确实现（只删 audit.hash）MISMATCH
          if (!r.passed) { canaryOk++; pass++; breakdown[cat].pass++; }
          else { fail++; errors.push(v.id + ' 金丝雀 FALSE_PASS'); }
        } else {
          // 语义 breach：hash 自洽 + 语义检测器检出具体 breach 码
          if (!r.passed) {
            fail++;
            errors.push(v.id + ' hash 不自洽（语义向量应自洽）: ' + (r.error || 'hash mismatch'));
          } else {
            const allHits = collectDOBreaches(doObj, exp);
            const breach = allHits[0] || null;
            if (breach !== exp.breach) { fail++; errors.push(v.id + ' breach 不符：期望 ' + exp.breach + '，检出 ' + breach); }
            else {
              // §9.1.1 不变式：向量 MUST 显式声明全部同时成立的 breach（also_present），
              // 且声明项 MUST 真实成立、MUST 排在主 breach 之后（被优先级拑压）。
              // 这道校验使「优先级声明」自验证，避免 also_present 变成无人读的死声明。
              const declared = Array.isArray(exp.also_present) ? exp.also_present : [];
              const actualExtra = allHits.slice(1);
              const missingDecl = actualExtra.filter((c) => !declared.includes(c));
              const falseDecl = declared.filter((c) => !actualExtra.includes(c));
              if (missingDecl.length) {
                fail++;
                errors.push(v.id + ' 同时成立但未在 also_present 声明的 breach: ' + missingDecl.join(','));
              } else if (falseDecl.length) {
                fail++;
                errors.push(v.id + ' also_present 声明但实际不成立（或未被拑压）: ' + falseDecl.join(','));
              } else {
                pass++; breakdown[cat].pass++;
              }
            }
          }
        }
      } else {
        fail++;
        errors.push(v.id + ' 未知 expected.type: ' + exp.type);
      }
    } else if (v.chain) {
      breakdown[cat].total++;
      const breach = detectChainBreach(v.chain);
      if (v.id === 'V-DO-v15-C01') {
        if (breach === null) { pass++; breakdown[cat].pass++; }
        else { fail++; errors.push(v.id + ' 正常链误报 ' + breach); }
      } else {
        if (breach === exp.breach) { pass++; breakdown[cat].pass++; }
        else { fail++; errors.push(v.id + ' breach 不符：期望 ' + exp.breach + '，检出 ' + breach); }
      }
    } else if (v.base_do) {
      breakdown[cat].total++;
      const baseR = verifyDO(v.base_do);
      const tamR = verifyDO(v.tampered_do);
      // 篡改对：base 自洽 + tampered 失配（flat-hash 检出）
      // 注：A02(content_unresolvable)/A07~A10(tree_snapshot_divergence) 的语义层检测
      //     依赖外部系统（知识库解析 / 规则重编译），本哈希层验证器以 flat-hash 失配兜底，
      //     具体 breach 码待语义验证器补入（与签名层 S3 同理）。
      if (baseR.passed && !tamR.passed) { pass++; breakdown[cat].pass++; }
      else { fail++; errors.push(v.id + ' base自洽=' + baseR.passed + ' tampered失配=' + !tamR.passed); }
    }
  }

  // ── 汇总 ──
  console.log('── 五步验证法（Step 0–5）+ 语义检测 ──');
  for (const [cat, s] of Object.entries(breakdown)) {
    const mark = s.pass === s.total ? '✓' : '✗';
    console.log(`  ${mark} ${cat.padEnd(8)} ${s.pass}/${s.total}`);
  }
  console.log('');
  console.log(`  总计: ${pass}/${pass + fail} 通过`);
  console.log(`  金丝雀 K01 正确判别: ${canaryOk}/1`);
  if (errors.length) {
    console.log('');
    console.log('  失败明细:');
    errors.forEach((e) => console.log('    ✗ ' + e));
  }
  console.log('');

  // ── Step 6: 答案文件交叉比对（RUNNER_CONTRACT R4 Check 2 / R5 金丝雀 Check 2）──
  // 覆盖面 = 向量集全部 DO（decision_object / base_do+tampered_do / chain 成员），非仅 MATCH 型：
  // Step 5 验「工件自报 hash」，Step 6 验「字节是否漂移」，二者正交——BREACH 型向量的字节同样必须稳定。
  if (answersData && answersData.answers) {
    let ansMatch = 0, ansMismatch = 0, ansMissing = 0, ansNA = 0;
    const readKeys = new Set();
    let canaryCheck2 = null;

    const crossCheck = (key, dobj) => {
      // 版本门：preimage_version 不支持的 DO（C07 版本降级攻击）按契约在 Step 1 提前终止，
      // 本质上不存在 v1.5 管线的 canonical bytes → Step 6 不适用（N/A），且 MUST 无预言键。
      const pv = dobj && dobj.audit && dobj.audit.preimage_version;
      if (pv !== PREIMAGE_VERSION) {
        ansNA++;
        if (answersData.answers[key] !== undefined) {
          errors.push(key + ' 版本不支持却存在预言键（会逗验证器绕过版本门）');
        }
        return;
      }
      const r = verifyDO(dobj);
      const oracle = answersData.answers[key];
      if (oracle === undefined) {
        ansMissing++;
        errors.push(key + ' 缺答案文件预言键（Step 6 未覆盖）');
        return;
      }
      readKeys.add(key);
      if (r.canonicalHex === oracle) {
        ansMatch++;
        if (key === 'V-DO-v15-K01') canaryCheck2 = 'MATCH';
      } else {
        ansMismatch++;
        if (key === 'V-DO-v15-K01') canaryCheck2 = 'MISMATCH';
        errors.push(key + ' 答案文件 MISMATCH');
      }
    };

    for (const v of data.vectors) {
      if (v.decision_object) crossCheck(v.id, v.decision_object);
      if (v.base_do) {
        crossCheck(v.id + '-base', v.base_do);
        crossCheck(v.id + '-tampered', v.tampered_do);
      }
      if (v.chain) v.chain.forEach((dobj, i) => crossCheck(`${v.id}[${i}]`, dobj));
    }

    // 死键守卫：答案文件中存在从未被读取的键 → 预言与向量集脱节（覆盖假象）
    const deadKeys = Object.keys(answersData.answers).filter((k) => !readKeys.has(k));
    if (deadKeys.length) {
      errors.push('答案文件死键（永不被读取，覆盖假象）: ' + deadKeys.join(', '));
    }

    console.log('── Step 6: 答案文件交叉比对 ──');
    console.log(`  canonical_hex 比对: ${ansMatch} MATCH / ${ansMismatch} MISMATCH / ${ansMissing} 缺预言`);
    console.log(`  覆盖面: ${ansMatch + ansMismatch}/${ansMatch + ansMismatch + ansMissing} 适用 DO（另 ${ansNA} 条 N/A：版本不支持，按契约提前终止）`);
    console.log(`  答案文件死键: ${deadKeys.length}`);
    console.log(`  金丝雀 K01 Check 2（字节层应 MATCH）: ${canaryCheck2 || 'N/A'}`);
    console.log('');
    if (ansMismatch || ansMissing || deadKeys.length) fail += ansMismatch + ansMissing + deadKeys.length;
  }

  if (fail === 0 && errors.length === 0) {
    console.log('  ✅ ALL VERIFICATIONS PASSED');
    console.log('  V-DO-v15 哈希层 ' + data.vectors.length + ' 条向量跨实现可验证。');
    process.exit(0);
  } else {
    console.log('  ❌ VERIFICATION FAILED (' + fail + ' 失败)');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// 导出核心函数（供 vitest 测试）
module.exports = { verifyDO, jcsCanonicalize, sha256, detectDOBreach, collectDOBreaches, detectChainBreach, getField };
