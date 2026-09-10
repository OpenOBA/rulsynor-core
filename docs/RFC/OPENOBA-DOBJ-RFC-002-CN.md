<!-- 权威源：erdl-vectors/docs/OPENOBA-DOBJ-RFC-002-CN.md · 本文件为同步副本（2026-09-07），修改请在权威源进行 -->
# RFC 002 — ERDL Decision Object v1.5 · 扁平哈希链与表达式树字段规范

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.) · CC0-1.0

> **RFC 编号**：ERDL-DOBJ-RFC-002
>
> **文档名称**：ERDL Decision Object v1.5 — 扁平哈希链与表达式树字段规范
>
> **版本语义**：本文档描述的 Decision Object 数据模型版本为 **v1.5**（preimage_version 常量 `"erdl-do-v1.5-hash-flat"`，FREEZE-1 冻结）；「SPEC v2.1」为上位规范文档版本。二者为**正交版本线**——SPEC 文档版本（v2.1）与 DO 数据模型版本（v1.5）独立演进，不可混同。
> **作者**：唐启鑫
> **维护方**：OpenOBA（代为管理与维护）
> **上位规范**：ERDL SPEC v2.1
> **前序文档**：ERDL-RFC-001（v1.3，哈希管线基座）
>
> **继承自 RFC-001（v1.3，已归档）**：本文档为 v1.5 增量，以下内容仍以 RFC-001 为权威、本文档不重复——设计哲学（通用事实证据容器）、生态兼容性（MCP/A2A/OpenTelemetry/OCSF/IETF AAT）、隐私与数据最小化（GDPR/LGPD/DPDP）、法规版本化与升级路径、长期维护与字段治理（只增不删 Append-Only）、威胁模型。
>
> **修订记录**：经多次修订，确立「扁平哈希 + 表达式树字段」方案，并补齐法域向量与有状态算子（within/rate）统一裁决。2026-08-31：链规模治理指针（§8），全线计数口径统一（审计层 78 / Core 301）。2026-09-02：新增 §1.4 生产侧不变量、§1.5 决策推导语义、§1.6 Producer Contract；新增 decision_divergence（跨层语义重推）与 V-PRODUCER（producer-side 一致性）两个验证对象；附录 A 新增 P-05 残余风险；P6 可解析集语义澄清。
>
> **关键字解释**：本文档中的 "MUST"、"MUST NOT"、"SHOULD"、"MAY" 等关键字遵循 RFC 2119 和 RFC 8174 的语义解释。

---

## 目录

1. 哈希架构：全 DO 扁平 JCS + 唯一删除点
2. 表达式树字段：canonical_tree 进 DO
3. gloss 与可重渲染文本：不进 DO，走渲染校验
4. 外部内容锚定：知识/附件/意图哈希指针
5. 合规画像与法域激活：14 框架三层激活
6. 双层合规证明体系（向量集定位）
7. 五步验证法（Step 0–6 共 7 步）
8. 链完整性（断裂检测 + 金丝雀）
9. 向量体系（v1.5 审计层）
10. 三层证据体系（哈希/签名/TSA）
11. 版本演进（v1.3 → v1.5）
附录 A：威胁模型与剩余风险声明

---

## 1. 哈希架构：全 DO 扁平 JCS + 唯一删除点

### 1.1 哈希公式（与 v1.3 同构，扩展字段集）

```
audit.hash = "sha256:" + HEX( SHA-256( JCS( DO 全量字段 − audit.hash − signature − signing_key_id ) ) )
```

- **唯一删除点**：哈希模式下仅删除 `audit.hash` 自身（自引用排除；`signature`/`signing_key_id` 在哈希模式下不存在，防御性删除为 no-op）；签名模式下删除 `audit.hash`/`signature`/`signing_key_id` 三字段。**删除语义唯一化：删除（delete key），禁止置空（blank）**——两者产生不同 JCS 字节；
- **字段内哈希的自引用排除**（与 `audit.hash` 同理）：`policies[].hash` 与 `compliance_profile.profile_hash` 计算时，被计算字段自身（hash 键）MUST 在 JCS 之前临时移除，防自引用循环（RFC-002 §1）；其**值**（已算好的哈希）作为普通字段参与全 DO 扁平哈希；
- **`policies[].hash` 原像不含 gloss**：`policies[].hash` 是规则**内容**的哈希，原像为规则结构字段（id/name/when/then/priority/ring/author_id，RFC-002 §1），**不含 gloss**（gloss 是渲染产物非规则内容，SPEC §8.3 G4）；gloss 篡改不影响 `policies[].hash`，由渲染校验（`gloss == render(树)`，SPEC §8.3 G2）检出，而非哈希失配。
- **preimage_version 常量（v1.5 哈希模式）**：`"erdl-do-v1.5-hash-flat"`——**域分隔符**（防跨版本/跨模式哈希碰撞，EIP-712 domain separator 思想），进原像受哈希保护；**选路由 audit.mode 字段承载（§10.2），preimage_version 不承担选路**。
- 其余全部字段（CORE + JURISDICTION + extensions + canonical_tree）**无条件参与 JCS**，无白名单、无投影、无验证器侧字段取舍逻辑；**生成端按 `activated_fields` 裁剪（RFC-002 §1）是本条的前置步骤**——未激活 JURISDICTION 字段在生成端已物理移除，验证器侧仍零取舍、零投影。

### 1.2 与 v1.3 的关系

管线完全同构（五步验证法不变），差异仅在字段集扩展：canonical_tree、知识引用指针、附件指针、compliance_profile.profile_hash、human_oversight 对象化、第一层合规字段、JURISDICTION 字段 10→15（RFC-002 §5.3）。**验证器无需学习任何新的投影逻辑**——这正是独立第三方可以低成本验证的原因。

### 1.3 JCS 实现约束（严格 RFC 8785，零自定义）

1. 键序：UTF-16 码元序（RFC 8785 §3.2.1）；DO 字段名全部 ASCII，无排序歧义；
2. 数字：IEEE 754 双精度序列化（ECMA-262 §7.1.12.1，V8/Ryu 为参考实现）；
3. **整数约束**：DO 的 number 字段（evaluation_duration_ms、policies[].version、ring、total_evaluated/total_matched、confidence_score 等）MUST 为不带小数点的原生整数，值域在 JS 安全整数范围 ±(2^53-1) 内（RFC-002 §1.3）；`confidence_score` 为 0–100 整数刻度（非 [0,1] 比例）；业务小数（金额/比例）MUST 以定点字符串进 DO，禁原生 number；
4. 字符串：**原样保留**（as is），JCS 不做任何规范化；lone surrogate（如 U+DEAD）MUST 使实现报错终止。**十进制字符串的最小规范表示**（生成端 MUST 完成，JCS 阶段原样保留）：定点小数/金额字符串 MUST 禁尾零（"0.950"→"0.95"）、整数部分不带小数点（"1.0"→"1"）、禁科学计数法/前导零/前后空格；定点舍入（SPEC §7.2 scale=14 + half-even）在序列化前完成；
5. **NFC 边界**：Unicode 规范化（NFC）在**引擎数据入口**做一次（所有进 DO 的字符串写入时 NFC，含树字面量、B 类文本 reason/instruction/correction、知识 fileName），JCS 流程本身零规范化步骤（严格 RFC 8785 as-is）；
6. **Omit over Null**：可选字段值为 null/undefined/空数组时，生成端**物理删除键（delete key）**，禁止置空（blank：空串/空对象/占位值）——delete 与 blank 产生不同 JCS 字节；空对象 {} 与空字符串 ""（非 null）保留。**例外**：① 链锚定字段 `audit.previous_hash`/`audit.previous_signature` 首条为 null 时 MUST 保留进 JCS（§10.2#3，创世块跨实现对称性）；② `extensions` 空数组 MUST 保留（RFC-001 §3.3 C3 结论回写，避免与 v1.3 回归向量失配）；
7. **数组序**：JCS 键序排序仅作用于对象键，MUST NOT 重排数组元素——数组序是语义事实（expr_tree 按 matched_rules 序、knowledge_references/attachments 按检索/上传序、policies 按加载序、rules_matched 按命中序）；
8. NaN/Infinity 禁止。

### 1.4 生产侧不变量：DO 与执行同源（构造侧，规范性）

> **DO MUST 派生自产生 enforcement 效果的同一求值对象，不得从它另行重新组装。**

决策执行路径与记录发射路径必须同源：`result.decision`、`evaluation.matched_rules`、`audit.hash` 必须由那次**实际门控执行**（enforcement）的求值结果直接产生，而非由与执行并行的另一条路径（如缓存命中路径、异步旁路）另行组装。

此不变量**无法从成品工件验证**——验证器只能看到 DO，看不到产生它的执行过程；因此它属于**构造侧规范约束**，而非验证侧向量对象（见附录 A 的 P-05「记录-执行保真度」）。违反它的典型后果：执行正确拒绝、记录却写为 allow——DO 内部 hash 完美、自洽，却是假的（结构性缓解的现成先例见 OWASP AST09「Bilateral Receipt Pattern」：admission + execution 双收据、attempt_id 链接、policy_version 决策时绑定）。

### 1.5 决策推导语义（构造侧，规范性）

`result.decision` 的推导规则（为 `decision_divergence` 检查提供规范基础）：

1. **规则求值**：按 SPEC §7 语义（ring 0→3、priority 升序=优先级高、first-match + override）求值全部 `policies[].when`，得到规则决策；
2. **human_oversight 升级**：若 `compliance_profile.risk_level ∈ {high, critical}` 且 `human_oversight.required === true`，则 `result.decision MUST = REQUEST_HUMAN`（高危决策须人工裁决，覆盖规则决策）；
3. **fallback**：无规则命中时，`metadata.decision`（若存在）> 默认 `ALLOW`。

> 此语义是 `decision_divergence` 检查（VERIFIER-GUIDE §4.4）的规范依据：验证器重推上述三步，断言 `result.decision === 重推结果`。不一致即 `decision_divergence`（内部不自洽：如 allow 却引用 deny 规则）。注意这是「bound 非 closure」——它只覆盖「决策-规则一致性」，不覆盖「记录-执行保真度」（附录 A P-05）。

### 1.6 生产侧一致性契约（Producer Contract，构造侧，规范性）

`decision_divergence`（VERIFIER-GUIDE §4.4）从**成品 DO** 重推决策，只能覆盖「记录内部自洽性」。要触达「记录-执行保真度」（附录 A P-05），必须做 **producer-side 一致性验证**——这是唯一能从工件之外观察「生产者实际行为」与「生产者发射的 DO」是否一致的手段：

> **Producer Contract**：一个 conforming producer MUST 暴露 `enforce(scenario) → { enforcement, do }`，其中 `enforcement` 是实际门控决策（allow/block/...），`do` 是发射的 DO；且 MUST 满足 `do.result.decision === enforcement.decision`（DO 必须反映实际执行，而非另行组装）。

验证方法：喂场景 → 运行 producer → 同时捕获 `enforcement` 与 `do` → 断言二者一致。这是与 V-DO（字节）、V-ENGINE（表达式语义）都不同的第三类验证对象（V-PRODUCER），且是唯一能触达 P-05 的地方——「任何读取成品 DO 的 runner 都够不到它，无论多好」。

参考实现：`scripts/verify-producer.mjs`（单路径 producer 全一致；内置一个「双路径」缺陷 producer 演示 harness 能捕获 enforcement/DO 分叉）。

## 2. 表达式树字段：canonical_tree 进 DO

### 2.1 定义

`evaluation.matched_rules[].canonical_tree`：每条命中规则的 when 条件编译后的**规范化表达式树（JSON 嵌套对象形态，非 S-expression 字符串）**（SPEC v2.1 §8.2 规范化树）。**它是 DO 的普通字段**，随全 DO 一起进扁平哈希，无特殊处理。树结构直接作为 JSON 嵌套对象进 JCS（对象键序由 JCS 排序、数组序语义固定），逐字节确定。

### 2.2 规范化规则（引擎构造时一次性冻结）

| 规则 | 内容 |
|------|------|
| 节点集 | SPEC §5.3 冻结 34 节点基线（非 RFC-002 §9），只裁剪不扩张，未来增补走版本升级 |
| 树形态 | **JSON 嵌套对象**（`{"eq":[{...},"exec"]}`），非 S-expression 字符串；JCS 递归规范化 |
| 节点序 | 树内部数组按语义序（如算术/逻辑参数序），JCS 不重排数组元素；matched_rules 数组按命中顺序（§1.3#7） |
| 字段名承重 | 元数据（source location、注释、gloss）剥离，语义由键名与值承载 |
| 数值字面量 | 规则值以**定点小数字符串**进树（scale=14 + half-even，SPEC §7.2；引擎 fromDecimalString 解析），禁原生 number，规避 IEEE 754 跨语言精度分叉；序列化为**最小规范表示**（§1.3#4，禁尾零/禁整数带小数点） |
| 字符串字面量 | 引擎入口统一 NFC 一次，此后 as-is |
| 命中 0 条 | 字段不存在（Omit），验证端零特判 |
| 非纯条件规则（fn 委派，编译返回 null） | 该规则无 canonical_tree 键（Omit）；决策事实仍由 matched_rules 其余字段锚定 |
| **有状态算子（within/rate）** | **状态不进 canonical_tree，而以 `temporal_state` 字段进 DO**（见 §2.4）；窗口计数是影响决策的输入，MUST 进审计链、可离线重算验证，与 SPEC §5.2 一致 |

> **边界覆盖分工**：本表所列规范化边界（命中 0 条 Omit / 非纯条件无树键 / 定点小数树字面量 / NFC 字符串）的**构造语义**由 V-ENGINE 表达式向量（RFC-002 §9）覆盖；V-DO-v15 哈希层向量将 canonical_tree 作为不透明字段验证其「参与扁平哈希 + 快照可比对」，不重复覆盖树内部规范化。

### 2.3 独立重算验证

验证器 SHOULD 凭 `rule_set_version.id` 拉取规则集 → 按 matched_rules 重编译 + 规范化 → 与 DO 内快照逐字节比对；不一致判 `tree_snapshot_divergence`。此机制与哈希架构正交——快照篡改已被扁平哈希检出，重编译是语义层二次印证。

> **测试向量近似**：哈希层测试向量（无外部规则库）以 DO 内 `policies[].when` 作为规则源进行快照比对（等价于「重编译 + 规范化」的简化近似）；生产环境以 `rule_set_version.id` 拉取外部规则集重编译。两者对 tree_snapshot_divergence 的判定语义一致。

### 2.4 有状态算子（within/rate）的 temporal_state 字段

`within` 与 `rate` 是 30 运算符中仅有的两个有状态算子，其求值依赖跨决策的滑动窗口计数。本规范确立统一原则：**凡影响决策结果的输入，都必须进 DO 审计链**。窗口计数正是影响决策的输入，因此：

- **状态不进表达式树**：表达式树保持纯函数（E1），对「当前窗口计数」这一事实做比较求值；
- **状态在树外维护**：滑动窗口计数器由 GuardStateManager 持久维护（可注入 Clock，对齐 Drools Fusion pseudo clock 思想）；
- **状态快照进 DO**：本次决策所用的窗口计数值，以 `evaluation.temporal_state` 字段进入 DO，随全 DO 进扁平哈希——使「为何此刻触发限流」可离线重算验证；
- **字段结构（FREEZE-1 结构层冻结）**：`evaluation.temporal_state` 为对象数组，每条对应一个生效中的有状态算子：`{ rule_id, operator: "within"|"rate", field, window_ms, count, limit? }`——记录「哪条规则、哪个算子、哪个字段、窗口内当前计数、上限（rate 有）」，供审计离线重算。

**temporal_state 的独立重算验证（与 §2.3 canonical_tree 正交）**：canonical_tree 凭「规则 + 上下文」重编译重算；temporal_state 凭「跨决策的历史事件序列」重放重算——二者验证路径不同。temporal_state 的离线重算 MUST 由 **V-TEMPORAL 独立状态验证向量**承载（§9 向量表，不占用 V-SCENE 编号，见命名澄清）：按决策序列重放 GuardStateManager 的窗口计数演进，比对每步 DO 内的 temporal_state 快照是否与重放结果一致；不一致判 `temporal_state_divergence`。此码为**单 DO 语义 breach**（与 tree_snapshot_divergence 同为 §9.1.1 优先级 P5 证据层，非 §8 链断裂、非告警级）。

> **字段激活归类**：`temporal_state` 属「条件激活」字段（§5.3）——仅当本次决策命中了含 within/rate 的规则时才产生（Omit over Null：无有状态算子命中时物理删除键）；其存在性由 V-TEMPORAL 向量覆盖，不纳入 V-COMP 字段存在性检查（V-COMP 验的是法域/框架要求的合规字段，temporal_state 属业务判定输入，非合规字段）。
>
> **preimage_version 影响判定**：`temporal_state` 为 v1.5 字段集的**增量条件激活字段**（可选、随事实产生），不改变哈希算法、不改变 CORE 14 字段结构、不改变唯一删除点（`audit.hash`）语义。因此 `preimage_version` 常量 **保持 `"erdl-do-v1.5-hash-flat"` 不变**，不触发版本号递增——字段集增量直接并入 v1.5，无需 bump 到 v1.6。此判定与「SPEC 文档版本（v2.1）与 DO 数据模型版本（v1.5）为正交版本线」一致：字段集在 DO 模型内增量演进，不牵动 SPEC 文档版本。

## 3. gloss 与可重渲染文本：不进 DO，走渲染校验

| 字段 | 处置 | 机制 |
|------|------|------|
| gloss | **不进 DO**（渲染产物，非落链事实） | 展示/审计时实时 `render(canonical_tree)`，可重算可自证 |
| eval_trace | **不进 DO**（树派生证据） | rootHash 由树决定，可重算 |
| grade | **不进 DO**（可推导） | `derive(tree, has_fn_delegation)`，需树外参数补齐，可重算 |
| reason/instruction/correction | 规则作者文本，进 DO（B 类文本） | 由 `action.*` 透传，随规则版本冻结，扁平哈希天然覆盖 |

**可读性/派生性字段的本质**：它们是**投影而非内核**，不落链当证据。DO 只存结果性事实（含 canonical_tree 内核），gloss 等投影由树实时重渲染。

**可读文本不在 DO 里，措辞修订零影响哈希**——无需为 gloss 换哈希架构，也无需在哈希里为 gloss 单设删除点。

**双语渲染**：gloss 渲染双语（zh/en），由 `lang` 参数切换（单渲染器、非双版本）；G1 确定性不变式双语覆盖，V-GLOSS 向量验证 `gloss_zh` 与 `gloss_en`。

## 4. 外部内容锚定：知识/附件/意图哈希指针

外部内容以哈希指针锚定（与哈希架构无耦合）：

- `evaluation.knowledge_references[]`：{ entry_id, entry_version, content_hash, fragment_hash }——检索命中集，内容在库，链上指针；
- `context.attachments[]`：{ storage_key, content_hash, file_name, mime_type, file_size }——文件级 SHA-256，>100MB 转对象存储指针；
- `context.intent`：{ source, category, summary_hash }——意图原文指针化；
- `context.memory_keys[]`：按检索命中顺序。

全部作为普通字段随扁平哈希。`content_unresolvable`（冷存储删除/灭失）为引用完整性告警，非链断裂。

## 5. 合规画像与法域激活：14 框架三层激活

### 5.1 合规画像锚定

`compliance_profile.profile_hash`（画像本体 JCS+SHA-256）随扁平哈希——堵“偷换法域声明”攻击（V-COMP-F02）。画像变更不溯及既往（grandfathering，SPEC v2.1）。

### 5.2 三层激活维度（14 框架全覆盖）

| 层 | 维度 | 框架 |
|----|------|------|
| 法域强制 | jurisdictions | EU（AI Act）、CN（GB/Z 185）、US（NIST/Colorado/HIPAA）、SG（MGF）、BR（LGPD）、IN（DPDP） |
| 行业条件 | industries | HIPAA（医疗）、PCI DSS（支付卡）等（HIPAA 既是法域要求也是行业标准，按激活维度分别触发） |
| 风险条件 | risk_level | critical → signature 强制（画像 MUST 将 `signature` 纳入 `activated_fields`，与法域无关：即使法域本身不要求签名（SG/BR/IN），critical 仍须签名背书；未纳入即风险条件层未生效，判 `compliance_field_missing`——向量 V-COMP-F08；已纳入但字段缺值同判此码——向量 V-COMP-F09） |
| 全球/标准组织 | regulatory_references 显式挂载 | COSO GenAI、ISO/IEC 42001、OWASP Agentic、IEEE P3395、信通院 2.0 |

多法域同步激活 = activated_fields 并集（RFC-001 §5.4，V-COMP-005 背书）。**14 框架全球中立平级**，任何法域（含中国三级立法场景）均为一等实例，不存在国别特供结构。

### 5.3 字段激活语义三分

| 类型 | 语义 | 字段 |
|------|------|------|
| 常驻事实 | 每条 DO 必具 | CORE 14 字段全量（spec/decision_id/compliance_profile/execution_trace_id/timestamp/evaluation_duration_ms/agent/context/rule_set_version/policies/evaluation/result/human_oversight/audit，见 RFC-002 §5.3） |
| 法域激活 | activated_fields 声明后 MUST 填充，缺失判 compliance_field_missing | JURISDICTION 15 字段（model_id / agent.known_limitations / fairness_assessment / impact_assessment_id / autonomy_level / data_modification_expected / context_snapshot_hash / sanitized_context / confidence_score / signature / signing_key_id / agent.aid / agent.tool_registry_hash / agent.algorithm_filing_no / agent.model_registration_id，见 RFC-002 §5.3） |
| 条件激活 | 随事实产生（人类介入/业务对象存在/有状态算子命中） | human_oversight（`required` 常驻 + `status`/`human_actor_id`/`timestamp`/`override_reason` 条件）/ knowledge_references / attachments / intent / tool（`context.tool.name`）/ outcome / evaluation.temporal_state（§2.4，随 within/rate 命中产生，存在性由 V-TEMPORAL 覆盖，不纳入 V-COMP 字段存在性检查） |

> **条件激活字段的存在性覆盖**：human_oversight 缺失 → F04（oversight_missing）；knowledge_references 不可解析 → A02（content_unresolvable）；attachments/intent/outcome 等条件字段的篡改由哈希天然覆盖（扁平方案零取舍）；temporal_state 由 V-TEMPORAL 覆盖。

**第一层合规字段进哈希（扁平方案下零取舍成本）**：agent.known_limitations / tool_registry_hash / algorithm_filing_no / model_registration_id 是"完整性级合规主张"（OpenOBA 参考实现自身合规），随全 DO 哈希天然获得篡改保护——V-COMP-F06/F07 验证此保护成立。这是扁平方案相对白名单方案的自然优势：**无需逐个声明取舍，全字段默认受保护**。

## 6. 双层合规证明体系（向量集定位）

OpenOBA 参考实现是职业化 AI 员工，构建于确定性引擎之上——向量集承载两层合规证明：

| 层 | 证明对象 | 承载向量 |
|----|---------|---------|
| **第一层：自身合规** | OpenOBA 参考实现对齐 14 框架，经得起监管对产品的审计 | V-COMP 组 1（辖区激活完整性，7 条覆盖 6 法域 + 多法域并集）+ 组 2（14 框架映射）+ F01/F03/F04/F05 + **F06/F07（第一层字段篡改检测）** |
| **第二层：任务合规** | 经 OpenOBA 参考实现执行的每项任务/业务/案件合规可审计 | D13 + A10 + K1 + G14（结论层） |
| **司法级审计链** | 链完整、归属与时间可证、独立可验证 | C8 + T3 + SIGN5 + 证据包双源验证 |

两层水位一致性原则：凡被 V-COMP 存在性检查的字段，其合规语义为完整性级主张时 MUST 获得哈希保护。扁平方案下此原则自动满足。

## 7. 五步验证法（Step 0–6 共 7 步）

> 「五步」为历史沿用名：v1.3 验证法为 Step 1–5 五步；v1.5 新增 Step 0（版本选路）与 Step 6（答案双检），共 7 步。

```
Step 0: 版本结构判别（双版本共存选路）：DO 含 evaluation.matched_rules[].canonical_tree 或 v1.5 特征字段（audit.preimage_version = `"erdl-do-v1.5-hash-flat"` 或 compliance_profile.activated_fields 为数组）→ v1.5 扁平哈希（继续）；不含且为全 DO 结构 → v1.3 历史路径（仅供历史档案验证）
Step 1: 读取 audit.preimage_version（域分隔符常量，v1.5 哈希模式 = "erdl-do-v1.5-hash-flat"，进原像受哈希保护）
Step 2: Deep clone → 唯一删除点：DELETE audit.hash（哈希模式；签名模式另删 signature/signing_key_id）——其余全部字段（含 canonical_tree）原样参与，零投影、零字段取舍
Step 3: JCS(全量字段) → canonical bytes（严格 RFC 8785，零自定义步骤）
Step 4: SHA-256(canonical bytes) → recomputed hash
Step 5: Compare recomputed hash with stored audit.hash
Step 6（向量验证强制）: recomputed hash 同时与答案文件的期望值（canonical_hex，全量 JCS preimage hex，独立答案文件）交叉比对
        —— step 5 验证"artifact 对自身摘要的声明"，step 6 验证"向量自身期望"
        两者独立，防 stale self-referential digest；canonical_hex 物理隔离（RFC-002 §2），合规运行不可读
```

> **资源上限**：单条 DO 序列化超过 1 MB 时，验证器 MUST 拒绝（`resource_limit_exceeded`），防 DoS。

## 8. 链完整性（断裂检测 + 金丝雀）

断裂判定（哈希模式，任一即断）：① audit.hash 重算不匹配；② previous_hash 与上一条 hash 不一致；③ 链中 DO 缺失；④ 相邻 DO preimage 版本混链；⑤ 相邻 DO audit.mode 不同（mode_mixed_chain）。签名模式对应判据：signature 验签失败 + previous_signature 链回溯断裂（见 §10.3 V-SIGN-002/003）。

> **检测优先级（补充）**：验证器先做 hash 自洽（①），再判版本支持（④），仅当全链 hash 自洽后才做结构语义检测，并按「genesis 失配（§9.2 C06）→ previous_hash 悬空 → chain_seq 跳变 → mode 混链 → 时间回退（§9.2 C05）」顺序报告第一条命中。

引用完整性告警（非断裂）：content_unresolvable（冷存储删除/灭失）。链规模治理（分片 + Merkle + Checkpoint + 增量验证）见 RFC-002 §8——本节只定义线性链的断裂判定。

金丝雀：v1.5 链位置金丝雀延续 AV-013 模式——正确实现 MISMATCH，regressed 实现（跳过独立重算/错取原像）MATCH 被捕。金丝雀向量的 `expected.breach` 标记为专有码 `canary_mismatch`（非语义 breach，仅标识「正确实现 MUST hash MISMATCH」）。

## 9. 向量体系（v1.5 审计层）

> **验证状态（二元分类）**：本规范向量按「是否经独立第三方 Runner 逐字节验证」分为两类——
> - **已验证（Verified）**：现行 v1.5 已生成的 78 条哈希层向量，由两个独立第三方 Runner 逐字节验证——norviq-go（Go，2026-09-01）、concordia-python（Python，Erik Newton，2026-09-02），各 107/107 canonical bytes；历史 v1.3 的 13 条 AV 向量（Erik Newton / Concordia，2026-07-30，Python 自建 JCS 逐字节通过）。
> - **未验证（Unverified）**：尚未生成的向量层（V-SIGN 签名链、V-TEMPORAL 时间锚定，见 §10.3）。
>
> 记录原则遵循「**Measurements, not endorsements**」——只记录测量事实（谁、哪天、通过多少条），不做背书。
>
> **自动记录机制**：参考 runner 的验证结果由 CI 自动落盘为 `conformance/CONFORMANCE.md`（记录谁、哪天、通过多少条 + Check 1/2 + K01 判别 + R1–R6 对照结论），由 `scripts/generate-conformance.cjs` 生成（`npm run conformance`），CI 有新鲜度门禁（stale 即红）——实现「测量事实自动记录，无需手工背书」。

| 类别 | 编号段 | 数量 | 内容 |
|------|------|:---:|------|
| 决策类型覆盖 | V-DO-v15-D01..D13 | 13 | 13 种决策类型（ALLOW/DENY/CORRECT/NOTIFY/REQUEST_HUMAN/ESCALATE/DELEGATE/DEFER/EMERGENCY_HALT/ROLLBACK/QUARANTINE/WORKFLOW/GUIDE）× 扁平哈希（含 canonical_tree 字段） |
| 链攻击检测 | V-DO-v15-C01..C08 | 8 | 正常链基线 + 7 攻击（单条篡改/删记录/指针悬空/时钟回退/整链重建/版本降级/混链，详见 §9.2） |
| 锚定攻击检测 | V-DO-v15-A01..A10 | 10 | 知识篡改/引用不可解析/分片不符/附件篡改/意图篡改/记忆键篡改/树快照伪造/树篡改 2 条（节点交换序/字面量精度）/B 类文本篡改（详见 §9.3） |
| 签名链（规划，未生成） | V-SIGN-001..005 | 5 | 合法验签/篡改验签失败/链回溯/伪造签名/签名金丝雀，§10.3；随签名层实现后补入 |
| 时间锚定（规划，未生成） | V-DO-v15-T01..T03 | 3 | TSA 令牌/clock_drift/关键决策无锚；随签名层实现后补入 |
| 金丝雀 | V-DO-v15-K01 | 1 | 链位置金丝雀（哈希模式，延续 AV-013；签名金丝雀由 V-SIGN-005 承载，不重复计数） |
| 结论层 | V-DO-v15-G01..G14 | 14 | 结构攻击恒定 6 + 领域示例 8（政务 4 + 企业 4，可增） |
| 法域合规 | V-COMP-001..021 + F01..F11 | 32 | 字段符合性 21（辖区 7 + 框架 14）+ 失败检测 11（含 F06/F07 第一层篡改、F08/F09 风险条件层、F10/F11 优先级铉定，详见 §9.1） |
| **有状态算子状态验证（规划，未生成）** | **V-TEMPORAL-001..004** | **4** | within/rate 跨决策窗口计数状态行为（多决策序列，验证 temporal_state 快照与重放一致，对应 §2.4）：T01 rate 正常序列（未超限→超限）、T02 within 正常序列、T03 temporal_state 快照篡改（判 `temporal_state_divergence`）、T04 状态重放金丝雀（跳过重放的 regressed 验证器被捕）。向量随 temporal_state 进 DO 落地后生成冻结 |
| **合计** | | **审计层 78** | 哈希层 78 条（D/C/A/K/G/V-COMP 已冻结）。签名 5 + TSA 3 + V-TEMPORAL 4 为规划项（未生成，不计数） |

> **2026-09-02 新增验证对象（非 Core 318）**：`decision_divergence`（跨层语义重推，V-DIVERGENCE 3 条，按 §1.5 从 DO 存储的 context+rules 重推决策，见 VERIFIER-GUIDE §4.4）+ `V-PRODUCER`（producer-side 一致性，按 §1.6 Producer Contract 运行 producer、捕获 enforcement vs 发射 DO，唯一能触达 P-05 的地方）。

> **命名澄清（避免与 PAE-spec §45 V-SCENE 语义混同）**：PAE-spec §45 的 V-SCENE 专指**生命周期七阶段**的业务场景验证（身份/岗位/培训/运营/审计/信任/退役），编号 `V-SCENE-NNN`。within/rate 的有状态算子窗口计数验证是**不同的验证对象**（算子状态正确性，非业务场景闭环），故本规范以**独立序列 V-TEMPORAL** 承载，不占用 V-SCENE 编号——对应 RFC-002 §9 第 2462 行「纳入 V-SCENE（多决策序列）**或独立状态验证向量**」中的「独立状态验证向量」分支。
>
> **temporal_state 进 DO 对既有向量的影响**：`temporal_state` 为条件激活字段，仅当 within/rate 规则命中时才产生。既有 78 条向量均不含 within/rate 条件（经全量核查），故 temporal_state 进 DO **不改变任何既有向量的 preimage**，无需重新生成既有 78 条。V-TEMPORAL 4 条为新增覆盖，验证的是既有向量未覆盖的「跨决策窗口计数」行为。

**生成自检强制**（§7 step-6 双检的工程教训）：向量冻结前参考 runner 全量自检，除金丝雀外全部 MATCH；step-6 双检强制。签名向量随签名实现开发时同步生成冻结。

### 9.1 V-COMP 法域合规向量完整清单（32 条）

> **编号说明**：辖区组原为 001..005 五条（CN/EU/US/SG/多法域并集），补 BR/IN 时**追加 020/021 而不重排既有编号**（V-COMP 编号属 `[FREEZE-3]` 命名级冻结：不复用、不重排、不改含义）。故辖区组编号为 001..005 + 020..021，非连续段，属冻结治理的正常结果。

**第一组：辖区激活字段完整性（7 条）**

| 编号 | 法域 | 检查字段 |
|------|------|------|
| V-COMP-001 | CN · GB/Z 185 | agent.aid / agent.tool_registry_hash / agent.algorithm_filing_no / agent.model_registration_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature（签名层，未冻结） |
| V-COMP-002 | EU · AI Act | model_id / agent.known_limitations / confidence_score / fairness_assessment / impact_assessment_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature（签名层，未冻结） |
| V-COMP-003 | US 综合 | model_id / confidence_score / fairness_assessment / impact_assessment_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context / signature（签名层，未冻结） |
| V-COMP-004 | SG · MGF | autonomy_level / confidence_score / data_modification_expected |
| V-COMP-005 | CN+EU 多法域并集 | 双法域字段取并集、无遗漏无冲突 |
| V-COMP-020 | BR · LGPD | model_id / data_modification_expected / autonomy_level / context_snapshot_hash / sanitized_context（Art.20 复核权 → autonomy_level；Art.20 §1 标准与程序可告知 → model_id；Art.18 删除权 + PII 分离 → sanitized_context。LGPD 不明文要求人工介入，故不激活 human_oversight 强制） |
| V-COMP-021 | IN · DPDP | data_modification_expected / context_snapshot_hash / sanitized_context（§12(1)(d) 擦除权 → sanitized_context；§12(1)(a-c) 更正/补全/更新 → data_modification_expected；§12(2) 下游级联通知需数据流可溯 → context_snapshot_hash。DPDP 未设自动化决策专条，故不激活 autonomy_level / model_id） |

> 注：上表 `signature` 为签名层字段（三层证据体系第二层，§10.3 V-SIGN 未冻结）；哈希层向量（V-DO-v15 78 条）暂不含 signature **值**，随签名层实现后补入 V-COMP-001..003 的字段存在性检查。BR/IN 两条不含 signature —— LGPD/DPDP 均未要求不可否认签名，签名强制来自 HIPAA/PCI DSS 与 `risk_level=critical`（§5.2）。
>
> **critical 的可验证边界（诚实口径）**：哈希层只能验「存在性」（F08/F09 两条负例）——因为一条**合规的** critical DO 按定义就是签名模式，其正例必须含真实可验签名，属签名层职责（V-SIGN-001 承载，§10.3）。本向量集**不**放带占位签名的伪正例，以免误导签名层 runner。

**第二组：14 框架字段映射（14 条，编号连续；本组为「框架→字段映射」检查，独立于 DO 实际法域）**

| 编号 | 框架 | 检查字段 |
|------|------|------|
| V-COMP-006 | EU AI Act | evaluation_duration_ms + human_oversight + agent.known_limitations（Art.12/14/13） |
| V-COMP-007 | NIST AI RMF | model_id + confidence_score + fairness_assessment |
| V-COMP-008 | COSO GenAI | rule_set_version + agent.id ≠ policies[].author_id（SoD） |
| V-COMP-009 | ISO/IEC 42001 | impact_assessment_id |
| V-COMP-010 | GB/Z 185 | agent.aid + agent.tool_registry_hash + agent.algorithm_filing_no + 留存 ≥36 月声明 |
| V-COMP-011 | OWASP Agentic | 决策可解释（decision/reason） |
| V-COMP-012 | HIPAA | signature 声明 + data_modification_expected + PII 冷热分离 |
| V-COMP-013 | PCI DSS | signature 声明 + data_modification_expected |
| V-COMP-014 | Colorado SB 205 | decision + reason + fairness_assessment |
| V-COMP-015 | Singapore MGF | autonomy_level |
| V-COMP-016 | 信通院 2.0 | data_modification_expected + 决策可解释 |
| V-COMP-017 | LGPD | 被遗忘权场景（PII 分离，sanitized_context 存在性检查；content_unresolvable 由 A02 单独承载） |
| V-COMP-018 | DPDP | 同 LGPD 模式 |
| V-COMP-019 | IEEE P3395 | 跨系统关联 execution_trace_id（标准制定中） |

**第三组：合规失败检测（11 条）**

| 编号 | 场景 | 期望检测 |
|------|------|------|
| V-COMP-F01 | 激活字段缺失 | compliance_field_missing |
| V-COMP-F02 | 合规画像被偷换 | hash_mismatch（profile_hash 白名单锚定） |
| V-COMP-F03 | 法域不匹配 | jurisdiction_mismatch |
| V-COMP-F04 | 高风险决策无人类监督记录 | oversight_missing |
| V-COMP-F05 | SoD 违反 | sod_violation（agent.id == policies[].author_id） |
| V-COMP-F06 | 第一层合规声明内容被篡改 | hash_mismatch（known_limitations/tool_registry_hash 篡改后哈希失配） |
| V-COMP-F07 | 备案与身份字段被篡改 | hash_mismatch（algorithm_filing_no/model_registration_id 篡改后失配） |
| V-COMP-F08 | `risk_level=critical` 但画像未将 `signature` 纳入 `activated_fields`（风险条件层未生效） | compliance_field_missing |
| V-COMP-F09 | `risk_level=critical` 已纳入 `signature` 但字段缺值 | compliance_field_missing |
| V-COMP-F10 | 多重违规：法域码不可识别 + 激活字段缺失 | jurisdiction_mismatch（P1 优先，§9.1.1） |
| V-COMP-F11 | 多重违规：树快照分歧 + 引用不可解析（告警级） | tree_snapshot_divergence（P5 优先于 P6，§9.1.1） |

> **F08/F09 向量构造约束**：两条 fixture 均取 `human_oversight.required = true`，使 `oversight_missing`（适用于 high/critical）**不**同时成立 —— 单一 breach 向量 MUST 只含单一 breach；多重违规的优先级由 F10/F11 专题铉定（§9.1.1）。

### 9.1.1 单 DO breach 检测优先级（规范项，与 §8 链层优先级同构）

当多个单 DO breach 同时成立时，conforming runner **MUST** 按下表顶序报告**第一条命中**（与链层「报告第一条命中」语义一致）。未规范顶序时，不同实现对同一 DO 可报出不同 breach 码，破坏跳实现一致性：

| 优先级 | breach 码 | 层次与理由 |
|:---:|------|------|
| **P1** | `jurisdiction_mismatch` | 法域码不可识别 ⇒ 画像整体不可解释，其余判定失去前提；若后置，可用**编造法域码 + 残缺激活集**掩盖字段完备性失败 |
| **P2** | `compliance_field_missing` | 画像声明的必需字段缺失（含 §5.2 风险条件层 critical → signature 强制） |
| **P3** | `oversight_missing` | 高风险/关键决策缺人类监督记录（治理约束） |
| **P4** | `sod_violation` | 职责分离违反（`agent.id == policies[].author_id`） |
| **P5** | `tree_snapshot_divergence` / `temporal_state_divergence`（后者随 V-TEMPORAL 落地后生效） | 证据层：决策记录的树快照与规则源不一致 / 有状态算子窗口计数快照与重放结果不一致（§2.4，同级） |
| **P6** | `content_unresolvable` | **告警级**（§8：引用完整性告警，非断裂）→ MUST 排最后；若前置，一条冷存储已删除的知识引用会掩盖同时存在的真实违规 |

**优先级铉定向量**（只写文本不给向量等于未验证）：

| 向量 | 同时成立的 breach | 期望报告 | 鉴别力 |
|------|------|------|------|
| **V-COMP-F10** | `jurisdiction_mismatch`（P1）+ `compliance_field_missing`（P2） | P1 | 任意将 P2 前置的实现会报 `compliance_field_missing` → 被捕 |
| **V-COMP-F11** | `tree_snapshot_divergence`（P5）+ `content_unresolvable`（P6） | P5 | 任意将告警级 P6 前置的实现会报 `content_unresolvable` → 被捕 |

两条向量的 `expected.also_present` 字段显式列出被拑压的低优先级 breach。

> **also_present 是规范约束，非注释（MUST）**：对任意语义 BREACH 向量，conforming runner MUST 校验——
> ① `expected.breach` 等于按优先级排序后的**首项**；
> ② `expected.also_present` 列出的每一项 MUST 真实成立且排在首项之后（确实被拑压）；
> ③ 反向也成立：**凡同时成立但未在 `also_present` 声明的 breach 均为向量集缺陷**（向量必须自描述其全部违规，否则会隐式依赖优先级而不自知）。
>
> 参考实现已将三条均实现为硬失败（反向验证：删除 F10 的 also_present 声明后，验证器立即报 78→77 并指名未声明项）。
> 此约束的动因：also_present 初版仅写作「供 runner 自查」而参考实现从不读取——
> 与当日刚修掉的「答案文件死键」同属一类缺陷（声明了却无人验证）。

### 9.1.2 `jurisdiction_mismatch` 语义边界（显式收窄）

本规范将 `jurisdiction_mismatch` **收窄为单一含义**：

> `compliance_profile.jurisdictions` 中存在**权威法域集合之外的码**（§5.2 六法域：CN/EU/US/SG/BR/IN）。未知码即判违规（**fail-closed**）—— 防止用编造法域码绕过字段激活。新增法域走版本升级，实现 MUST NOT 自行扩展该集合。

**明确不属于本码的场景与其归属**（避免语义漂移）：

| 场景 | 为何不在本码 | 已由谁覆盖 |
|------|------|------|
| 法域声明被**篡改**（偷换画像） | 属完整性问题，由密码学而非语义检查捕获 | `profile_hash` 锤定 → **V-COMP-F02**（hash_mismatch） |
| DO 声明法域 **≠ 部署期望法域**（配置不匹配） | 无状态验证器不持有「部署期望」输入，判不了 | 部署期配置校验（运行时）；若要向量化，需向量携带 `expected_jurisdictions` 元数据 → 属 **V-JURIS** 层（PAE-spec §45 分类：V-COMP 验字段**存在**，V-JURIS 验字段**语义正确**） |
| 法域合法但**未激活其必需字段** | 不是法域码问题 | → `compliance_field_missing`（P2） |

### 9.2 C 系列链攻击向量完整清单（8 条）

| 编号 | 场景 | 期望检测（BREACH 码） |
|------|------|------|
| V-DO-v15-C01 | 正常链（无攻击） | MATCH |
| V-DO-v15-C02 | 单条篡改（decision 字段） | hash_mismatch |
| V-DO-v15-C03 | 删中间记录（chain_seq 跳变） | chain_seq_gap |
| V-DO-v15-C04 | 指针悬空（previous_hash 悬空） | previous_hash_dangling |
| V-DO-v15-C05 | 时钟回退（timestamp 倒退） | time_regression |
| V-DO-v15-C06 | 整链删除后重建 | chain_genesis_mismatch |
| V-DO-v15-C07 | 版本降级（preimage_version 篡改为不支持值） | version_unsupported |
| V-DO-v15-C08 | 模式混链（相邻 DO mode 不同） | mode_mixed_chain |

### 9.3 A 系列锚定攻击向量完整清单（10 条）

| 编号 | 场景 | 期望检测（BREACH 码） |
|------|------|------|
| V-DO-v15-A01 | 知识正文篡改（content_hash 与库中内容哈希不符） | hash_mismatch |
| V-DO-v15-A02 | 引用不可解析（entry_id 不存在） | content_unresolvable（告警非断裂） |
| V-DO-v15-A03 | 分片哈希不符（重算的 fragment_hash 与链上 fragment_hash 不符） | hash_mismatch |
| V-DO-v15-A04 | 附件篡改 | hash_mismatch |
| V-DO-v15-A05 | 意图指针篡改 | hash_mismatch |
| V-DO-v15-A06 | 记忆键篡改 | hash_mismatch |
| V-DO-v15-A07 | 树快照伪造（canonical_tree 整体替换） | tree_snapshot_divergence |
| V-DO-v15-A08 | B 类文本篡改（reason/instruction/correction） | hash_mismatch |
| V-DO-v15-A09 | 树篡改（节点交换序） | tree_snapshot_divergence |
| V-DO-v15-A10 | 树篡改（字面量精度攻击） | tree_snapshot_divergence |

### 9.4 G 系列结论层向量完整清单（14 条）

**outcome 结论层字段集（`[FREEZE-1]` 结构层）**：`result.outcome` 为统一结论层对象，政务（审批/审核/评选/评定）与企业（招聘/采购/绩效/合同）统一抽象；字段：`scenario`（场景标识，点分命名，如 gov.approval）/ `verdict`（结论标识）/ `grade?`（档位）/ `rank?`（排位）/ `comment?`（结论说明）/ `basis[]?`（依据哈希指针，可含结论词汇表锚定 ref_type=verdict_registry；当前向量示例为纯字符串指针）/ `extra?`（任意结构化扩展区）。纯 Guard 决策（无业务结论）省略整组；结构层冻结、值层开放任意扩展；随全 DO 进扁平哈希（无白名单投影）。

**结构攻击恒定 6（与领域无关，不随行业增长）**：

| 编号 | 场景 | 期望检测 |
|------|------|------|
| V-DO-v15-G01 | verdict 篡改 | hash_mismatch |
| V-DO-v15-G02 | grade·rank 篡改 | hash_mismatch |
| V-DO-v15-G03 | basis 删除 | hash_mismatch |
| V-DO-v15-G04 | extra 篡改 | hash_mismatch |
| V-DO-v15-G05 | registry 引用篡改 | hash_mismatch |
| V-DO-v15-G06 | outcome 整体删除 | hash_mismatch |

**领域示例 8（政务 4 + 企业 4，随行业增长可增）**：

| 编号 | 场景 | scenario |
|------|------|------|
| V-DO-v15-G07 | 政务·行政审批 | gov.approval |
| V-DO-v15-G08 | 政务·多级审核 | gov.review |
| V-DO-v15-G09 | 政务·评选 | gov.selection |
| V-DO-v15-G10 | 政务·评定 | gov.appraisal |
| V-DO-v15-G11 | 企业·招聘审批 | corp.hiring |
| V-DO-v15-G12 | 企业·采购评标 | corp.procurement |
| V-DO-v15-G13 | 企业·绩效评定 | corp.performance |
| V-DO-v15-G14 | 企业·合同审批 | corp.contract |

### 9.5 T 系列时间锚定向量完整清单（3 条，字段冻结，实现随签名层）

| 编号 | 场景 | 期望检测（BREACH 码） |
|------|------|------|
| V-DO-v15-T01 | TSA 令牌验核（timestamp_proof 完整有效） | MATCH |
| V-DO-v15-T02 | 时钟漂移（timestamp 与 TSA 锚定时间偏差超阈值） | clock_drift_detected |
| V-DO-v15-T03 | 关键决策无时间锚（关键节点缺 timestamp_proof） | timestamp_anchor_missing |

**T02 检测逻辑（`clock_drift_detected`）**：验证器比对 `DO.timestamp` 与 `timestamp_proof.token` 内 TSA 加盖时间，偏差 > 阈值（默认 60s，可配置）判 `clock_drift_detected`。`timestamp_proof` 字段集以 RFC-002 §9.5 为权威（`tsa_id`/`token`/`anchored_field`/`requested_at`）。

**T03 检测逻辑（`timestamp_anchor_missing`）**：验证器检查决策类型 ∈ {DELEGATE, ESCALATE, REQUEST_HUMAN}（单 Agent 语义下需外部承接的关键决策）时 `timestamp_proof` 是否存在，缺失判 `timestamp_anchor_missing`。多 Agent 协作关键节点（DELEGATE/HANDOFF/APPROVE）见 RFC-002 §10。

**T01 TSA 令牌时效性与离线验核**：TSA 令牌有时效性（TSA 证书过期后令牌失效）。向量集离线运行（不依赖网络），TSA 令牌 MUST 为预生成的真实响应，并嵌入完整 TSA 证书链（tsa_id → 证书 → 根 CA），验证器离线验核证书链。README 声明 TSA 令牌有效期与失效后的降级路径（证书过期后 T01 标记为「历史验证基准」）。优先选择长期有效的 TSA 证书（如 DigiCert 免费 TSA，证书有效期 5–10 年）。

> T 系列 3 条 breach 码与检测逻辑随本节冻结 `[FREEZE-3]`，与 RFC-002 §9.5 字段冻结同步；向量生成随签名层（V-SIGN，§10.3）落地后执行。

## 10. 三层证据体系（哈希/签名/TSA）

第一层哈希链 → 第二层 ECDSA P-256 签名链（未冻结）→ 第三层 RFC 3161 TSA（字段冻结，实现随签名后）。

### 10.1 签名原像完整定义

**签名目的**：证明「谁（Agent 身份）在什么内容上签名」，且签名链可回溯、不可抵赖。

**签名模式 DO 的 audit 对象**（哈希字段物理省略）：

```jsonc
"audit": {
  "mode": "signature",              // 人读标注 + 选路（篡改 mode → 验签失败）
  "preimage_version": "erdl-do-v1.5-hash-flat",  // 域分隔符（进原像，防跨版本/跨模式碰撞）
  "previous_signature": "...",       // 上一条 DO 的 signature（签名链锚定；首条 null）
  "timestamp_proof": { ... },        // TSA 时间锚（可选）
  "retention": { ... },              // 证据保留期（retention_until / retention_basis）
  "chain_id": "...",                 // 子链标识（= session_id，RFC-002 §8 分片治理）
  "chain_seq": 0                     // 子链内序号（0 起单调递增）
}
// 哈希字段 audit.hash / previous_hash / commitment 物理省略（签名模式弃用）
// 顶层 signature / signing_key_id 存在（JURISDICTION 字段）
```

**签名原像（signature 覆盖的字节）**：

```
signature(n) = ECDSA_P256_Sign( private_key,
                                 JCS( DO(n) − signature − signing_key_id ) )
```

**逐字段钉死（进 / 不进签名原像）**：

| 字段 | 进签名原像？ | 理由 |
|------|:---:|------|
| 全部 DO 字段（含 canonical_tree、human_oversight object、outcome、agent、policies、evaluation、context、compliance_profile、extensions） | ✅ 进 | 签名覆盖完整决策内容（含扩展区，呼应扁平哈希的 extension 完整性） |
| `audit.mode` | ✅ 进 | 在 audit 对象里，签名覆盖；防 mode 篡改降级 |
| `audit.previous_signature` | ✅ 进 | 签名链锚定（signature(n) 覆盖 signature(n-1)） |
| `audit.timestamp_proof` | ✅ 进 | 时间锚定，防时钟回拨 |
| `signature` | ❌ 不进 | 自引用（签名时不存在） |
| `signing_key_id` | ❌ 不进 | 密钥元数据，密钥轮换不影响签名值 |

**与哈希原像的对称性（生产级设计验证）**：

| 模式 | 自引用删除 | 链锚定保留 | audit 内容 |
|------|-----------|-----------|-----------|
| 哈希 | delete `audit.hash` | 保留 previous_hash + commitment | { hash, previous_hash, commitment, mode, preimage_version, retention, chain_id, chain_seq, timestamp_proof（可选，TSA 启用后） } |
| 签名 | delete `signature` | 保留 previous_signature | { mode, preimage_version, previous_signature, timestamp_proof, retention, chain_id, chain_seq } |

两模式对称：各删一个自引用字段，各保留链锚定字段，audit 对象整体进原像。

**commitment 结构（哈希模式专属，`[FREEZE-1]` 冻结三字段）**：`{ agent_id, tool_name, decision }`——决策归属快照（谁、对什么工具、做了什么决策），冻结三字段结构化对象，随全 DO 进扁平哈希。

### 10.2 签名层关键约束（逐项冻结）

| # | 约束 | 冻结值 |
|---|------|--------|
| 1 | 算法 | ECDSA P-256（FIPS 186-5）+ SHA-256 |
| 2 | 签名格式 | Base64url |
| 3 | 首条 previous_signature | null（保留 null 进 JCS，不 Omit——与哈希模式 previous_hash=null 对称） |
| 4 | 签名模式哈希字段 | audit.hash / previous_hash / commitment **物理省略**（Omit，非空值） |
| 5 | signing_key_id 定位 | 验签公钥版本标识，密钥轮换后旧公钥保留验签历史 DO |
| 6 | 密钥管理 | 私钥 MUST 由 KMS/HSM 管理，禁明文存储 |
| 7 | 模式互斥 | 一条链全程一种模式，混链判 mode_mixed_chain（§8） |
| 8 | 选路 | audit.mode 字段（进原像，篡改破坏原像完整性） |

### 10.3 签名向量（V-SIGN）

| 编号 | 场景 | 期望检测 |
|------|------|---------|
| V-SIGN-001 | 合法验签 | 用 signing_key_id 公钥验签成功，签名覆盖原像完整；**并承载 `risk_level=critical` 合规正例**（critical + 签名模式 + signature 已激活已填且验签通过 → 无 breach） |
| V-SIGN-002 | 篡改验签失败 | 篡改 DO 任一字段 → 验签失败（signature 不匹配） |
| V-SIGN-003 | 签名链回溯 | 沿 previous_signature 回溯至链首，无断链 |
| V-SIGN-004 | 伪造签名 | 用错误私钥签名 → 验签失败（归属证伪） |
| V-SIGN-005 | 签名金丝雀 | 跳过验签的 regressed 验证器被捕获（防验证器回归） |

**签名原像的坑（定稿前必须排掉，审计确认）**：

| # | 坑 | 处置 |
|---|-----|------|
| PIT-1 | signature 自引用删除（不删则无法签名） | 钉死：delete signature |
| PIT-2 | signing_key_id 进原像会致密钥轮换改变签名值 | 钉死：delete signing_key_id |
| PIT-3 | previous_signature 漏进原像 → 链断裂不可检测 | 钉死：保留 previous_signature 进原像 |
| PIT-4 | 首条 previous_signature=null 被 Omit → 创世块跨实现分叉 | 钉死：null 保留进 JCS |
| PIT-5 | 签名模式残留哈希字段（hash/previous_hash/commitment）→ 字节漂移 | 钉死：物理省略 |
| PIT-6 | mode 不进原像 → 篡改 mode 降级攻击 | 钉死：mode 进原像（在 audit 内） |

证据包（Evidence Bundle）：DO 链（含签名）+ 规则集快照 + 知识快照 + 合规画像快照 + TSA 凭证 + 验证报告（哈希重算 + 签名验签 + 规则重编译三核对）。

**V-SIGN 测试密钥声明**：V-SIGN 向量使用**公开的测试密钥对**（私钥公开，仅用于向量验证，严禁用于生产签名）。向量文件嵌入测试公钥（signing_key_id 对应），README 声明测试密钥用途。真实生产签名使用 KMS/HSM 私钥管理，私钥永不下发。

**司法级宣称门槛**：签名 + TSA 落地并经第三方独立验证后，方可对外宣称司法级证据；此前对外声明为完整性级 + 归属级（签名层上线后）。

## 11. 版本演进（v1.3 → v1.5）

- **v1.5 相对 v1.3 的增量**：在已验证哈希管线（JCS 扁平 + 唯一删除点）基础上扩展字段集（canonical_tree、知识引用指针、附件指针、human_oversight 对象化、结论层 outcome），补齐签名层（ECDSA P-256，未冻结）与审计层向量集（78 条 + 8 条随签名层补入）；
- **preimage_version 常量**：v1.5 哈希模式 = `"erdl-do-v1.5-hash-flat"`（域分隔符，§1.1）；v1.3 历史向量保留其自有版本标识；
- **版本判别**（验证器 Step 0）：DO 含 canonical_tree 或 v1.5 字段 → v1.5 扁平哈希；否则 → v1.3 历史路径（仅供历史档案验证）；
- **历史兼容**：v1.3 嵌套算法验证冻结的 AV-001..013 回归套件继续作为历史档案验证基准；生产链不混合版本。

---

## 附录 A：威胁模型与剩余风险声明

| # | 风险 | 处置 |
|---|------|------|
| P-01 | 锚字节不锚权威（provenance 缺口） | 声明为协议边界；权威性由部署侧承担；源文件签名钩子留司法级深化版评估 |
| P-02 | 冷存储灭失 | 证据包周期性预打包 SHOULD；冷存储契约覆盖灭失检测 |
| P-03 | 对抗性删除与合规删除不可区分 | retention 治理（冷存储契约 retention_until + 删除日志）为制度性区分机制 |
| P-04 | 版本不可变性为外部假设 | 部署侧约束：被引用版本保留至留存期满 |
| P-05 | record-emission fidelity（记录-执行保真度）：DO 可能不描述实际被执行的决策——producer 的决策路径与记录发射路径分叉（如缓存命中路径写入不同 verdict），记录可 hash 完美、内部自洽，却是假的 | 结构性缓解：生产侧不变量（§1.4，DO MUST 与执行同源）+ producer-side 一致性验证（V-PRODUCER）；先例：OWASP AST09「Bilateral Receipt Pattern」 |

---

## 鸣谢

本规范的本次升级更新，得益于以下人员的帮助：

- **Christopher Hopley（chopmob-cloud / AlgoVoi）**：独立技术审阅者。RFC-001 审查中发现自引用哈希排除规则缺位、字符串小数跨引擎不一致、分层完整性缺口，推动扁平哈希架构确立；v1.3 审计中以洁净室 RFC 8785 JCS 检查器报告 4 个技术发现（C1–C4）+ 3 个安全问题（S1–S3），推动安全加固。
- **Erik Newton（Concordia）**：首个独立 Runner 实现者，「中立性不是宣称的，是测出来的」原则提出者；以独立 Python 规范化器逐字节验证审计向量（12 逐字节一致 + AV-013 金丝雀正确失败），发现 E1–E3 关键问题，推动 audit 结构修复、AV-013 金丝雀、答案文件分离架构。
- **Santosh Kumar Puppala（norviq-dev）**：提出 record-emission fidelity 缺口（附录 A P-05）及 PEP/缓存命中路径的真实事故案例；提出 P6 可解析集语义歧义；将 decision_divergence 界定为「bound 非 closure」——三者驱动 §1.4/§1.5/§1.6、P-05 残余风险与 P6 澄清。
- **OpenOBA 参考实现团队**：ERDL 规则引擎参考实现，测试向量生成与验证的基准。

独立验证的意义在于「不信任被测方」：用与被测实现不同的技术栈独立重算，消除「必须信任厂商」的风险。他们的贡献，我们如实记录并感谢。
