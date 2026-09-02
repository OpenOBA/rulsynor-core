// rulsynor-core 确定性层性能基准（自测脚本）
// 测量对象：①规则裁决 Evaluator.evaluate ②审计留证 buildDecisionObject ③全链路（裁决+留证）
// 输出 p50 / p95 / p99 / mean / ops·sec，并打印机器参数（供复现）
import {
  Evaluator,
  GuardStateManager,
  buildDecisionObject,
  loadPresetRules,
  toCompiledRules,
} from '../dist/index.js';
import os from 'node:os';

const N_EVAL = 100000;
const N_DO = 20000;
const N_PIPE = 20000;

const rules = toCompiledRules(loadPresetRules());

// 危险命令场景（命中 SEC-001 DENY，含正则 match 运算符，属最重路径）
const makeCtx = () => ({
  tool: { name: 'exec', args: { command: 'rm -rf /' } },
});

const evaluator = new Evaluator(new GuardStateManager());

// 先跑一次裁决拿到真实 matchedRules，用于驱动 buildDecisionObject
const warm = evaluator.evaluate(rules, makeCtx());

function makeDOInput(res) {
  return {
    input: {
      runId: 'bench',
      step: 1,
      toolName: 'exec',
      toolArgs: { command: 'rm -rf /' },
      context: {},
      agentId: 'bench-agent',
      sessionId: 'bench-session',
      previousAuditHash: null,
    },
    decision: res.decision,
    actionTaken: 'allowed',
    reason: res.primaryReason ?? null,
    matchedRules: res.matchedRules ?? [],
    totalEvaluated: res.totalEvaluated,
    totalMatched: res.totalMatched,
    rules,
    evaluationDurationMs: 0,
  };
}

// ── 计时工具 ──
function bench(fn, n, warmup) {
  for (let i = 0; i < warmup; i++) fn(i);
  const samples = new Array(n);
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    fn(i);
    const t1 = process.hrtime.bigint();
    samples[i] = Number(t1 - t0) / 1e6; // ms
  }
  samples.sort((a, b) => a - b);
  const p = q => samples[Math.min(n - 1, Math.floor((q * n) / 100))];
  const mean = samples.reduce((s, x) => s + x, 0) / n;
  const elapsed = samples.reduce((s, x) => s + x, 0);
  return {
    p50: p(50),
    p95: p(95),
    p99: p(99),
    max: samples[n - 1],
    mean,
    opsSec: n / (elapsed / 1000),
  };
}

function fmt(o) {
  return `p50=${o.p50.toFixed(3)}ms p95=${o.p95.toFixed(3)}ms p99=${o.p99.toFixed(3)}ms max=${o.max.toFixed(3)}ms mean=${o.mean.toFixed(4)}ms ops=${Math.round(o.opsSec).toLocaleString()}/s`;
}

console.log('=== 环境参数（供复现）===');
console.log(`平台: ${os.platform()} ${os.release()} | CPU: ${os.cpus()[0]?.model} | 核数: ${os.cpus().length}`);
console.log(`Node: ${process.version} | 规则数: ${rules.length} 条`);
console.log('');

console.log('① 规则裁决 Evaluator.evaluate（含 structuredClone 上下文克隆）');
console.log('   ' + fmt(bench(i => evaluator.evaluate(rules, makeCtx()), N_EVAL, 5000)));
console.log('');

console.log('② 审计留证 buildDecisionObject（JCS 序列化 + 多轮 SHA-256 + 3×UUID）');
console.log('   ' + fmt(bench(i => buildDecisionObject(makeDOInput(warm)), N_DO, 500)));
console.log('');

console.log('③ 全链路（裁决 + 留证，单次行动确定性治理总成本）');
console.log('   ' + fmt(bench(i => {
  const r = evaluator.evaluate(rules, makeCtx());
  return buildDecisionObject(makeDOInput(r));
}, N_PIPE, 500)));
