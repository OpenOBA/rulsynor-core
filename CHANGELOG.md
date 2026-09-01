# Changelog — @openoba/rulsynor-core

## 0.1.0-alpha (unreleased)

### 2026-08-28 — 确定性内核单一事实源 `erdl-schema`

**新增公共 API（对外可用，semver: minor 级新增）**

从 `src/index.ts` 导出确定性内核的唯一权威枚举，供第三方集成与 LLM schema 注入使用：

- 运算符：`CONDITION_OPERATORS`(28) · `CONDITION_MODIFIERS`(2) · `ALL_OPERATORS`(30) · 九族分组常量
  （`OP_COMPARE`/`OP_LIST`/`OP_STRING`/`OP_BOUNDARY_NEG`/`OP_EXISTENCE`/`OP_LENGTH`/`OP_RANGE`/`OP_COUNT`）
- 值形态：`OP_VALUE_NONE`/`OP_VALUE_SCALAR`/`OP_VALUE_ARRAY`/`OP_VALUE_TUPLE` + `operatorValueShape()`
- 编译归宿分类：`OP_COMPILE_DIRECT`(13) · `OP_COMPILE_VIA_NOT`(6) · `OP_COMPILE_VIA_LENGTH_COUNT`(9)
- 别名与判定：`OPERATOR_ALIASES`（`matches`→`match`、`neq`→`ne`）· `isConditionOperator()` · `normalizeOperatorName()`
- 决策：`DO_DECISIONS`(13，DO `result.decision` 唯一取值域) · `ALL_DECISIONS`(21) ·
  `WORKFLOW_SUBSTATES`/`INTERNAL_REASONING`/`INTERNAL_STATES`/`RULSYNOR_EXTENSIONS` ·
  `GUARD_ALLOWED_DECISIONS` · `BLOCKING_DECISIONS` · `isDODecision()` · `isDecision()`
- 分类与命名：`RULE_CATEGORIES`(11) · `RULE_NAME_PREFIXES`(14，注册制) · `OCCUPATION_CATEGORIES`(1)
- 节点：`SEMANTIC_NODES`(10 组 34 节点) · `SEMANTIC_NODE_NAMES` · `EXPR_NODE_TYPES`(20)
- 自证：`SCHEMA_COUNTS`（数量全部由 `.length` 派生）· `SPEC_BASELINE`（SPEC 锚点）
- 类型：`ConditionOperator`/`ConditionModifier`/`AnyOperator`/`OperatorValueShape`/`DODecision`/`RuleCategory`/`OccupationCategory`
- `templateEngine.getModifierLabels()` · `templateEngine.getTemplateOperatorDomains()`

**行为变更（下游需注意）**

1. **规则名前缀白名单由「形同虚设」改为真执行**。历史实现只在正则失配时才查前缀表，
   任意 2–4 个大写字母都能通过（`XYZ-999-foo` 合法）；现无条件校验前缀，未登记前缀一律
   `NON_STANDARD_NAME_FULL`(error)，而 error 级门禁会**拒绝加载该规则**。
   → 若你的规则使用了未登记前缀，升级后会被拒载。前缀集合为注册制，新增须先登记于
   `RULE_NAME_PREFIXES`（本轮已补登记 `SBP`→compliance，覆盖既有 106 条水土保持规则）。
2. **校验器放行域由 13 扩为 28 个条件运算符**（`VALID_ALL_OPS`）。此前 `length_*`/`count_*`/
   `between`/`not_between`/`not_starts_with`/`not_ends_with` 等 15 个内核已支持的运算符被校验器
   误拒，现放行。**方向为放宽，不会使原本合法的规则失效。**
3. **规则分类由 10 类扩为 11 类**（新增 `observability`）。分类枚举不属 FREEZE-2 冻结项，属可增。
4. **UI/下拉相关**：`getOperatorLabels()` 只返回 28 个条件运算符（此前含 `within`/`rate` 共 30 键，
   会让调用方把修饰符当 `operator` 取值）。修饰符改由 `getModifierLabels()` 提供。
   → 若你依赖 `getOperatorLabels()` 拿全部 30 项，请改为合并两表。

**内部收敛（无对外行为变化）**

- `ConditionOperator` / `SimpleOperator` 由本地联合类型改为从 `erdl-schema` 派生（集合不变）
- `rule-validator` 的分类/决策/运算符/拦截性决策/Guard 允许决策全部改为派生
- `rule-to-expr`、`db-rule-store`、`file-rule-store`、`v-engine-matrix` 的本地枚举副本清零
- 编码修复：`rule-definition.ts` 等注释区 33 处有损损坏字符复原（em-dash 与中文字被吞）

**新增门禁**

- `erdl-schema.spec.ts`：24 条一致性/行为断言（含 28 运算符逐个真过编译器、
  模板运算符域 × 校验器真实放行域、值形态闭合、UI 下拉与放行域严格相等）
- 上游工作空间守门器 46 项（含跨仓镜像逐字节同一、反重复枚举扫描 NO-DUP-ENUM）


> 版本由 1.0.0 降为 0.1.0-alpha：引擎尚未对齐 Spec v2.0 的 Decision Object v1.5（DO 仍 v1.3 口径），属早期 alpha，非稳定发布。

### 引擎重构
- **M1 表达式树内核 expr-tree 移植**：归一为单一求值核心（Spec E7），旧多求值器架构移除。
- **M2 核心引擎移植 + 剥离依赖**：删除旧引擎，去框架依赖（仅 json-canonicalize + js-yaml）。
- **确定性根基 fixed-point**：有理数定点求值替代浮点（E2 定点小数，scale=14 half-even），修复 number→Rational 崩溃面（R2）。
- **时间节点统一 UTC 语义**：消除时区脆弱性。

### 审计与安全
- **上线前审计 4 个 🔴 Blocker 修复**：R1 dist 陈旧 / R2 number→Rational 崩溃 / R3a runtime 决策直通 / R3b 审计链断裂 / R4 tsconfig 悬空 import。
- **Guard fail-close**、**runtime 决策穷尽分发**（ESCALATE/DEFER/DELEGATE/WORKFLOW/QUARANTINE/ROLLBACK 一律不执行工具）、**审计链锚定**（previousAuditHash 落链）。
- **QWEN 第三方审计整改**：1 P0 + 7 P1 + 7 P2 全修复。
- **SafeRegExp 加固**：相邻量词原子检测 + 输入长度上限 10k（Spec E4）。

### 向量
- **V-ENGINE 201 + V-GLOSS/V-PROJ 22 = 223 条引擎向量落地**（S2），含双实现生成制（§48.2 参考实现 reference-verify-v-engine.mjs）。
- 向量产物竞争消除 + 新鲜度门禁（测试不再写提交产物）。

### 合规
- **风险条件层**：risk_level=critical 强制激活 signature。
- **BR/IN 法域**：LGPD / DPDP 法规引用。
- 去掉默认法域/行业/风险等级：未配置即「未选择」，交用户显式声明。
- 消除签名占位值造成的合规假阳性（fail-open）。

### 工程
- eslint 升级 flat config（eslint@9 + typescript-eslint@8）。
- 测试 458 → 505（+29：numeric-edge 9 + runtime 9 + safe-regex 11）。
- 覆盖率：语句 67.99% → 76.19%、分支 58.61% → 67.49%。

## v1.0.0 (2026-08-07)

### First public release

**Core Engine**
- ERDL rule evaluator with 20 operators (eq, neq, gt, gte, lt, lte, in, not_in, contains, not_contains, match/matches, starts_with, ends_with, exists, not_exists, length_gt/gte/lt/lte/eq)
- 25-field Decision Object builder with JCS (RFC 8785) + SHA-256 cryptographic audit hash
- RuleCompiler: ERDL YAML -> four parallel products (ComplianceSchema, GuidanceArtifact, GuardDirective, AuditTemplate)
- GuardStateManager with within/rate temporal tracking + hot-reload freeze migration
- Clock abstraction (SystemClock + VirtualClock for testing)
- EvaluatorAdapter for legacy rulsynor integration
- Function registry (ERDL fn-registry with sandbox execution + timeout protection)
- SafeRegExp: ReDoS-protected regex construction (nested quantifier detection + length cap)

**Guard & Compliance**
- ComplianceService: 4 regulations (EU AI Act, GB/Z 185, NIST AI RMF, COSO GenAI) across 4 jurisdictions
- GB/Z 185-compliant Agent Identity Code (AID) generation
- extractNavigationGuide: DENY/CORRECT decisions -> structured LLM guidance with corrections + alternatives

**Preflight**
- CORRECT loop state machine (5 states, 3-round retry before escalation)
- REQUEST_HUMAN signal parser (Chinese + English patterns, anchored for injection safety)
- Deterministic A/B experiment assignment
- DO Payload builder for RAG traceability

**Developer Experience**
- Playground CLI: `npx @openoba/rulsynor-core --tool=exec --cmd="rm -rf /"` shows Guard interception
- Minimal Chat Runtime: ReAct loop + Guard + Tool executor in one file
- 29 preset rules (20 security + 8 compliance + 1 integrity)
- integrity.erdl.yaml: professional ethics detection (promise vs action, no cover-up, transparency)

**Documentation**
- Bilingual README (EN + CN) with executable code examples
- Spec documents bundled: ERDL Spec v1.1 + RFC 001 Decision Object v1.3
- Full legal suite: LICENSE (MIT), SECURITY, CODE_OF_CONDUCT, GOVERNANCE, PRIVACY-POLICY, TRADEMARK

**Packaging**
- MIT License
- Zero framework dependencies (only json-canonicalize + js-yaml)
- 100 tests (SafeExpr, Evaluator, DecisionObject, Compliance, Guidance, Runtime, Preflight)
- npm package: 10 sub-path exports (engine, guard, compliance, rules, guidance, runtime, preflight, playground, provenance)
