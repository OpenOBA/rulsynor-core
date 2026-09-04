# ERDL 规范 v2.1
（Entity-Rule Definition Language · 实体规则定义语言）

> **权威源声明（2026-09-04 · 同步 v2.1）**：本文件为 ERDL 语言规范的**副本**，权威源为 erdl 仓库 `erdl-spec.md`；规范性事实以权威源为准。

> **状态**：v2.1 · 定稿
> **日期**：2026-09-03
> **版本语义**：本文档（ERDL 语言规范）版本为 **v2.1**；规则文件顶层 `protocol: "erdl/v2"`（协议标识，固定值）与 `version: "2.1.0"`（规则格式版本）为独立版本标识，与本文档版本互不混同。
> **作者**：唐启鑫
> **商标**：ERDL™ 是深圳市秒镜科技有限公司的商标。
> **定位**：ERDL（Entity-Rule Definition Language，实体规则定义语言）是一种以 YAML/JSON 承载的**声明式规则定义格式**，用于精确表达实体结构与行为规则。本规范**独立且中立**——仅定义格式本身，不依赖任何特定实现或上层框架；其确定性求值与规范化形式支持跨实现逐字节验证。在 ERDL 中，**规则决定一切**：规则既是语义的载体，也是执行的边界、审计的证据与治理的事实。
> **规范语言**：本文档中 **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** 按 [RFC 2119] 解释。

---

## 1. Introduction

### 1.1 ERDL 是什么

ERDL（Entity-Rule Definition Language，实体规则定义语言）是一种以 YAML/JSON 承载的**声明式规则定义格式**，用于精确表达实体结构与行为规则。它包含两类**声明**：**Entity（实体）**定义数据结构；**Rule（规则）**定义 `when → then` 决策。Entity 界定对象的结构，Rule 规定条件的后果；二者共同构成可执行、可审查、可验证的规则表达。

### 1.2 设计哲学

**ERDL 是多方语义层**：它不仅是规则格式，更是人、LLM、系统与审计四方共享的语义约定层。

| 参与方 | ERDL 的角色 |
|--------|------------|
| 人（业务/领域专家） | 自然语言规则的精确翻译结果，可读、可审 |
| LLM（通用大模型） | 结构化输入，消除歧义，支持确定性求值 |
| 系统（规则引擎） | 标准化规则描述，并以 `fn` 委派控制调用边界 |
| 审计（监管/合规） | 比代码与自然语言更清晰的可追溯规则记录 |

在这一语义层中，规则决定一切：人表达意图，LLM 翻译语义，系统执行决策，审计复核证据。ERDL 的确定性语义层为 LLM 提供明确方向：使用者以自然语言描述规则，经 ERDL 精确翻译后，由 LLM 基于结构化语义确定性执行——对话界面即为统一入口。

### 1.3 ERDL 在 AI 治理层面的价值

AI 治理的核心难题，不是模型能否给出答案，而是概率性输出如何满足监管、审计与追责所要求的确定性边界。ERDL 以 YAML/JSON 承载声明式规则，将实体结构、行为约束和处置动作固化为可验证的确定性规则层，使 AI 的「应当如何行动」从训练假设转变为可检查对象。

**从信任到验证**：传统治理依赖对齐评估或事后解释，难以证明某次具体决策遵循了哪些约束。ERDL 将约束表达为 `when → then` 规则，每次求值绑定 canonical_tree 快照与结果哈希，可独立重算、逐字节跨实现复核。治理方不再只是相信模型「被正确训练」，而是可以验证某次行为是否命中规则、命中哪条规则、为何得到该结果。

**可追责的证据链**：ERDL 求值结果可哈希、可重算，可将规则版本、输入快照、决策输出与哈希锚定形成审计记录。审计不是复述日志，而是可重现的证明过程——为何放行、为何拦截、由谁批准，均可回溯查验，避免事后解释成为唯一依据。

**机制化的人机权责边界**：ERDL 可通过 REQUEST_HUMAN、ESCALATE 等决策类型，将高风险操作、敏感实体变更、不可逆动作等强制交由人工裁决。人的最终决策权不再依赖流程口号，而是被编码为可执行、可测试、可审计的规则路径。

**合规即代码与跨组织互认**：法规、平台政策和内部红线可转写为 ERDL 规则，并通过测试向量持续验证。不同组织、不同实现或第三方审计机构可基于同一规则与规范化树独立复算，形成「信任但验证」的治理范式，使合规从声明文档变为可运行、可检查、可互认的治理事实。

### 1.4 设计目标

1. **确定性**：同一规则、同一输入，任何兼容实现 MUST 产生逐字节一致的求值结果与哈希；
2. **可读性**：任何规则可回读为自然语言（gloss），人可秒懂、可审；
3. **可审计性**：规则的求值过程可独立重算、可追溯；
4. **跨实现可验证**：语义收敛到唯一内核，通过测试向量逐字节比对证明实现合规。

### 1.5 核心承诺

> **语义载体是内核，不是语法。**
> **语义 = 树 = 哈希。** 三者在规范化形式下合一。

任何以「运算符语法」为语义载体的方案，都会因新需求而被迫线性扩张运算符，成本永不收敛。因此本规范把语义收敛到唯一的内核（表达式树），而把多种书写形态作为内核的确定性投影——它们不是各自独立的语言，而是同一语义的不同视图。**规则决定一切**：规则的有效性不取决于书写入口或实现形态，而取决于唯一、可重算、可哈希、可逐字节验证的规范化语义。

---

## 2. 文档结构

### 2.1 顶层格式

一个 ERDL 文档（`*.erdl.yaml`）由四个顶层字段构成，字段顺序 MUST 固定：

```yaml
protocol: "erdl/v2"       # 协议标识，固定值
version: "2.1.0"          # 规则格式版本
metadata: { ... }         # 文档级元数据（见 §2.2）
rules: [ ... ]            # 规则列表（见 §4）
```

| 顶层字段 | 类型 | 必填 | 说明 |
|---------|------|:---:|------|
| `protocol` | string | MUST | 协议标识，固定值 `"erdl/v2"` |
| `version` | string | MUST | 规则格式版本（语义化版本） |
| `metadata` | object | MUST | 文档级元数据 |
| `rules` | array | MUST | 规则列表，元素见 §4 |

### 2.2 metadata

```yaml
metadata:
  name: "my-first-rule-set"
  description: "允许读文件操作"
  category: coding
  decision: ALLOW            # 所有规则不匹配时的 fallback 决策
  tags: [example]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 规则集名称 |
| `description` | string | 规则集描述 |
| `category` | string | 规则集分类（coding/security/compliance…） |
| `decision` | string | fallback 决策（所有规则不匹配时的默认裁决，见 §6） |
| `tags` | array | 标签 |

### 2.3 格式约定

- 字符串值 MUST 双引号，枚举关键字 / 数字 / 布尔值裸词书写；
- 缩进 MUST 2 空格；
- 文件 MUST 以 `protocol: "erdl/v2"` 开头；
- 版本兼容：同一 `protocol` 大版本内，新增约束对存量规则 SHOULD Non-breaking（加载时 Warning 而非 Error）；跨大版本（如 erdl/v1 → erdl/v2）为 breaking change，不适用向后兼容承诺。例外：`when:"true"` + 拦截性 `then` 在任何版本均拒绝加载（Error）。

### 2.4 解析与求值概览

一个 ERDL 文档从文件到决策结果，走固定的五步管线。理解这条管线，即可理解 ERDL 如何被「解析」与「求值」：

| 步骤 | 动作 | 输入 → 输出 | 依据 |
|------|------|-----------|------|
| ① 加载 | 读入规则文档 | `*.erdl.yaml` → 结构化对象 | §2.1–§2.3 |
| ② 校验 | 加载时类型检查 | 结构化对象 → 合法文档（拒绝非法） | E5 |
| ③ 编译 | 三种书写形态归一化 | 合法文档 → 表达式树（canonical_tree） | E7、§8.2 |
| ④ 求值 | 树对输入事实逐节点判定 | 表达式树 + fact → 决策 | §7 |
| ⑤ 输出 | 生成求值证据 | 决策 → 可哈希、可重算的求值结果 | E6、§8 |

- **① 加载**：读入 `*.erdl.yaml`，按 §2.3 格式约定解析（YAML 与 JSON 等价，无损互转）。
- **② 校验**：加载时类型检查——字段顺序、必填、枚举值、`when`/`expr` 互斥等；违规拒绝加载。
- **③ 编译**：Simple / Expression / 决策表 MUST 编译到同一表达式树（E7），生成规范化树（§8.2）。
- **④ 求值**：表达式树对输入事实逐节点判定（§7）。树是纯函数（E1）；`within`/`rate` 的状态由 `temporal_state` 受控注入。
- **⑤ 输出**：产出决策结果，绑定 canonical_tree 快照与结果哈希（E6），可独立重算、逐字节验证。

> 输入事实（fact）与求值结果（output）的完整契约见 §7.0。

---

## 3. Entity 定义

Entity 是规则作用的主体（经 context 传递）。ERDL 预置以下 Entity 类型：

| Entity 类型 | 说明 |
|------|------|
| `agent` | 单个 Agent 实例 |
| `tool` | Agent 调用的工具 |
| `task` | Agent 执行的任务 |
| `workflow` | 多 Agent 编排流程 |
| `human` | 人类审批者 |
| `guardian` | 监管者（supervisor） |

规则中的字段引用（如 `tool.name`、`context.amount`）以 Entity 为语义命名空间。字段路径承重：字段名一旦发布即冻结 `[FREEZE-1]`，别名 MUST 先行归一化为规范名。

---

## 4. Rule 定义

Rule 是 ERDL 的核心单元：`Rule = Metadata + When（条件）+ Then（动作）+ Audit（审计）`。When 编译为表达式树（§5），Then 为决策类型（§6），Audit 记录规则求值的审计信息。

### 4.1 字段定义

`rules[]` 子字段顺序 MUST 固定为：`name` → `description` → `category` → `priority` → `override` → `ring` → `enabled` → `when` → `then` → `message` → `instruction` → `correction` → `unless` → `explanation` → `alternative` → `legal_basis` → `source_text`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `name` | string | MUST | 规则唯一标识，格式 `[CAT]-[NNN]-描述` |
| `description` | string | MUST | 人读描述 |
| `category` | string | MAY | 规则级分类；缺省继承 `metadata.category`（见 §2.2），允许同一文档内混合分类 |
| `priority` | integer | MUST | 数字越小越优先（见 §7.1） |
| `override` | string | SHOULD | 覆盖级别：critical > high > normal > low（默认 normal） |
| `ring` | integer | SHOULD | 执行环：0 内核 / 1 恢复 / 2 审批 / 3 建议 |
| `enabled` | boolean | MAY | 规则启用标志（默认 true）；false 时求值跳过该规则 |
| `when` | object | MUST | 触发条件（见 §5） |
| `then` | string | MUST | 决策类型（见 §6） |
| `message` | string | SHOULD | 决策消息（拦截性 then MUST 非空） |
| `instruction` | string | MAY | 建议指令（ALLOW + instruction 场景） |
| `correction` | string | MAY | 纠正文本（CORRECT 决策；求值输出的 `primary_correction` 来源，见 §7.0.3） |
| `unless` | object/null | MAY | 豁免条件块（可选） |
| `explanation` | string / object | MAY | 双语解释（规则为何存在、防止何种危害） |
| `alternative` | string / object | MAY | 被拦截时建议的替代动作 |
| `legal_basis` | string | MAY | 法规依据（条款引用） |
| `source_text` | string | MAY | 所依据法规的原文摘录 |

### 4.2 完整示例

```yaml
protocol: "erdl/v2"
version: "2.1.0"
metadata:
  name: "my-first-rule-set"
  description: "允许读文件操作"
  category: coding
  decision: ALLOW
  tags: [example]
rules:
  - name: "COD-001-allow-read"
    description: "放行 read_file 工具的所有调用"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "read_file"
    then: ALLOW
    message: "read_file 调用已放行"
    unless: null
```

---

## 5. when 条件表达式

`when` 是规则的内嵌条件表达式。ERDL 提供三种**书写形态**（Simple / Expression / 决策表），任一形态编译归一化到同一语义内核（表达式树），再经渲染还原为任一形态；另有一个**可读投影** gloss（§5.5）从树确定性生成自然语言。

### 5.1 书写形态（投影面）

| 投影面 | 承载 | 适用 tier | 说明 |
|--------|------|:---:|------|
| **A · Simple** | 30 运算符 | 0–2（MUST） | 安全底线，最常用的书写形态 |
| **B · Expression** | 完整 34 节点树 | ≥3 | 业务全景：逻辑组合/量词/算术/时间/聚合 |
| **C · 决策表** | 矩阵 | — | 业务/财务人员首选，编译到同一内核 |

**tier 是规则层级（0–5）**，由低到高表示规则的约束强度与适用范围——本规范中 tier 0–2 为安全底线（MUST 用 Simple），tier ≥3 为业务全景（可用 Expression）。`when` 与 `expr` 不得共存（E5）。

### 5.2 投影面 A：Simple（30 运算符）

Simple 是保留的既有语义单元集合，**30 运算符 = 28 条件 + 2 修饰符**，一字不改。它对应系统安全规则（tier 0–2）。

**集合定义**：

| 族 | 数量 | 运算符 |
|----|------|--------|
| 比较 | 6 | eq · ne · gt · gte · lt · lte |
| 列表 | 2 | in · not_in |
| 字符串 | 5 | contains · not_contains · match · starts_with · ends_with |
| 边界否定 | 2 | not_starts_with · not_ends_with |
| 存在性 | 2 | exists · not_exists |
| 长度 | 5 | length_gt · length_gte · length_lt · length_lte · length_eq |
| 范围 | 2 | between · not_between |
| 计数 | 4 | count_gt · count_gte · count_lt · count_lte |
| 修饰符 | 2 | within（时间窗口）· rate（速率限制） |

**语义约定**（全运算符生效）：

- **严格类型匹配**：无隐式类型转换，`"100" gt 50` 恒为 false；
- **同类型有序比较**：数值用数值序，字符串用字典序（Unicode 码点序，`"2" gt "10"` 为 true）；跨类型返回 false；
- **match 大小写敏感**：默认大小写敏感，不提供内联不敏感选项；
- **between 仅数值**：闭区间 `[min,max]` 仅支持数值，非数值返回 false；
- **空值传播**：字段缺失时，除 exists/not_exists 外统一返回 false（安全失败）；
- **存在性唯一感知**：仅 exists/not_exists 区分「缺失」与「值不符」；
- **列表上限**：in/not_in 操作数 ≤256 项；
- **确定性保证**：由封闭求值内核执行，无代码注入路径；
- **宽容别名**：实现 MAY 接受 `matches` → `match`、`neq` → `ne` 两个历史别名并归一。别名不是新增运算符（仍为 30 运算符全集）；规范化形态 MUST 用规范名，别名不进树、不进哈希。不实现别名仍属合规。

**权威编译映射**：30 运算符全部有确定编译归宿，无悬空——**13 直接节点**（eq/ne/gt/gte/lt/lte·in·contains/starts_with/ends_with/match·exists·between）、**6 not 派生**（not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between）、**9 length/count 组合**（length_* 5 + count_* 4）、**2 时间修饰符**（within/rate）。

| # | Simple 运算符 | 编译归宿 | 表达式树表达 |
|:---:|------|:---:|------|
| 1-6 | `eq` `ne` `gt` `gte` `lt` `lte` | 直接节点 | 比较节点 |
| 7 | `in` | 直接节点 | 集合节点 in |
| 8 | `not_in` | not + exists 守卫 | `exists(field) AND not(in(...))` |
| 9-12 | `contains` `starts_with` `ends_with` `match` | 直接节点 | 字符串节点 |
| 13 | `not_contains` | not + exists 守卫 | `exists(field) AND not(contains(...))` |
| 14-15 | `not_starts_with` `not_ends_with` | not + exists 守卫 | `exists(field) AND not(...)` |
| 16 | `exists` | 直接节点 | 存在节点（值非 `null` 且非 `undefined`；空字符串 `""`、`0`、`false` 均视为「存在」——「存在」≠「非空字符串」） |
| 17 | `not_exists` | not 组合 | `not(exists(...))` |
| 18-22 | `length_gt/gte/lt/lte/eq` | 组合 + exists 守卫 | `exists(field) AND length(field) 比较 n` |
| 23 | `between` | 直接节点 | 范围节点（仅数值） |
| 24 | `not_between` | not + exists 守卫 | `exists(field) AND not(between(...))` |
| 25-28 | `count_gt/gte/lt/lte` | 组合 + exists 守卫 | `exists(field) AND aggregate(count(...)) 比较 n` |
| 29 | `within` | 时间修饰 | 时间窗口（as_of 由引擎注入） |
| 30 | `rate` | 时间修饰 + 聚合 | 速率限制（temporal_state） |

**exists 守卫（E11 空值传播的编译层保障）**：`not_*`（除 `not_exists`）与 `length_*`/`count_*` 组合派生 MUST 编译为 `exists(field) AND <派生表达式>`，而非裸 `not(正向算子)` 或裸 `length/count(...) 比较`。原因：正向算子对缺失字段返回 false、`length(缺失)` 返回 0，若直接 `not` 翻转或数值比较，空值传播被破坏（fail-open）。`not_exists` 是唯一例外——语义即「感知字段缺失」，保持裸 `not(exists(...))`。

**有状态算子（within/rate）**：`within` 与 `rate` 是仅有的两个有状态算子，其求值依赖跨决策的滑动窗口内计数。这一状态不存储在表达式树节点中，而由独立的 Guard 状态管理器维护，以 `temporal_state` 字段进入审计记录——表达式树本身仍是纯函数（E1 成立），状态源可审计、可重算。

**有状态算子真值语义（MUST）**：计数达阈值 → 条件成立（触发）；未达阈值 → 记录本次事件并返回 false（放行）。

| 算子 | 阈值 | 首次/未超限 | 达阈值后 |
|---|---|---|---|
| `rate: "N/窗口"` | N | 前 N 次：record + false | 第 N+1 次起：true |
| `within: "窗口"` | 1 | 首次：record + false | 窗口内第 2 次起：true（去重） |

配套约束（均 MUST）：① 计数后置（仅当正向条件成立才计数）；② 计数隔离键（`within` 以 `field+operator+value` 为键，`rate` 以 `field+operator+value+rate` 为键）；③ record 时机在「未超限」分支写入。

### 5.3 投影面 B：Expression（34 节点树）

Expression 开放完整内核表达力，面向复杂业务规则（tier ≥3）。语义内核是一棵**类型化表达式树**，由 **34 个节点**构成（归为 **10 组**），节点集冻结于 `[FREEZE-2]`：

| 组 | 节点 | 语义能力 |
|----|------|---------|
| 取值 | field · var · 字面量 | 引用字段、上下文变量、常量（`var` 仅 `$`/`$.path`，禁读时钟与随机） |
| 逻辑 | and · or · not | 组合关系 |
| 比较 | eq · ne · gt · gte · lt · lte | 操作数可为字段、变量、字面量或算术子树 |
| 集合 | in | 标量属于集合 |
| 字符串 | contains · match · starts_with · ends_with | 模式匹配；match 走安全正则 |
| 存在/量纲 | exists · length · between | 存在性、长度（Unicode 码点）、闭区间 |
| 量词 | all · any · none | 数组逐元素判定；空数组一律 false |
| 算术 | add · sub · mul · div · round | 定点小数确定性运算 |
| 时间 | days_between · epoch_ms · date_add · date_part · month_last_day | 日期差、时间戳、日期推演、分量提取、月末取日 |
| 聚合 | aggregate（count/sum/avg/min/max） | 数组聚合 |

> 节点总数：取值 3 + 逻辑 3 + 比较 6 + 集合 1 + 字符串 4 + 存在/量纲 3 + 量词 3 + 算术 5 + 时间 5 + 聚合 1 = **34**。「比较」6 运算符、「字符串」4 运算符、「算术」5 运算符、「量词」3 种类、「聚合」5 函数在实现中分别以参数化节点类型承载，故「34 个语义节点」在代码中映射为更少的类型字面量——二者是语义节点与类型投影的关系，非数量矛盾。

**表达式书写示例**：

```yaml
when:
  expr:
    lt:
      - div:
          - sub: [{ field: "tool.args.price" }, { field: "context.cost" }]
          - field: "tool.args.price"
      - 0.15
```

### 5.4 投影面 C：决策表（矩阵形态）

决策表面向业务与财务人员，以行列结构表达多条件组合，编译到同一内核：

```yaml
kind: decision_table
columns:
  - field: "context.amount"
    label: "申请金额"
rows:
  - when: [["gte", 10000]]
    then: "REQUEST_HUMAN"
    priority: 100
  - when: [["gte", 5000]]
    then: "ESCALATE"
    priority: 90
  - when: []                       # 默认行（无条件命中，兜底）
    then: "ALLOW"
    priority: 1
```

编译规则（E7）：① 每行 `when` 条件组按字段列序编译为逻辑与（`and`），条件单元编译为比较节点；② 行序即优先级（自上而下首个命中，与 `priority` 一致，二者 MUST 不冲突）；③ 默认行 `when: []` 编译为字面量 `true`；④ `then` 值 MUST 属于 §6 决策类型枚举；⑤ 编译后产生与手写 Simple/Expression 相同的表达式树。

### 5.5 投影面 D：gloss（自然语言可读投影）

gloss 是从树**确定性生成**的自然语言表述：

```yaml
gloss: "当（售价 减 成本）除以 售价 小于 15% 时，需人工审批"   # 引擎生成，lint 强制一致
```

**五条不变量（全部 MUST）**：

| # | 不变量 |
|---|--------|
| G1 | gloss = render(树)：由冻结渲染模板确定性生成 |
| G2 | 每条规则 MUST 携带 gloss，lint 校验 `gloss == render(树)`，禁手写 |
| G3 | gloss 禁原始字段路径，MUST 用 Entity 的 display_name（中英双语） |
| G4 | gloss 为渲染产物（不进哈希），展示时实时 `render(树)` 呈现 |
| G5 | Simple 规则同样生成 gloss（编译为树后渲染）——阅读层不分层 |

**gloss 渲染模板**（逐节点，中英双语；`{A}`/`{B}`/`{C}` 为子表达式递归渲染结果）：

| 节点 | 中文模板 | English template |
|------|---------|------------------|
| `field` | `{field}` | `{field}` |
| `var` | `{变量}` | `{variable}` |
| `literal` | `{value}` | `{value}` |
| `and` | `{A} 且 {B}` | `{A} and {B}` |
| `or` | `{A} 或 {B}` | `{A} or {B}` |
| `not` | `非（{A}）` | `not ({A})` |
| `eq` | `{A} 等于 {B}` | `{A} equals {B}` |
| `ne` | `{A} 不等于 {B}` | `{A} does not equal {B}` |
| `gt` | `{A} 大于 {B}` | `{A} is greater than {B}` |
| `gte` | `{A} 大于等于 {B}` | `{A} is greater than or equal to {B}` |
| `lt` | `{A} 小于 {B}` | `{A} is less than {B}` |
| `lte` | `{A} 小于等于 {B}` | `{A} is less than or equal to {B}` |
| `in` | `{A} 属于 {B}` | `{A} is in {B}` |
| `contains` | `{A} 包含 {B}` | `{A} contains {B}` |
| `match` | `{A} 匹配正则 {B}` | `{A} matches regex {B}` |
| `starts_with` | `{A} 以 {B} 开头` | `{A} starts with {B}` |
| `ends_with` | `{A} 以 {B} 结尾` | `{A} ends with {B}` |
| `exists` | `{A} 已发生` | `{A} exists` |
| `length` | `{A} 的长度` | `the length of {A}` |
| `between` | `{A} 介于 {B} 与 {C} 之间` | `{A} is between {B} and {C}` |
| `all` | `{A} 中每一项均满足：{B}` | `every item in {A} satisfies: {B}` |
| `any` | `{A} 中存在一项满足：{B}` | `some item in {A} satisfies: {B}` |
| `none` | `{A} 中无一项满足：{B}` | `no item in {A} satisfies: {B}` |
| `add` | `{A} 加 {B}` | `{A} plus {B}` |
| `sub` | `{A} 减 {B}` | `{A} minus {B}` |
| `mul` | `{A} 乘 {B}` | `{A} times {B}` |
| `div` | `{A} 除以 {B}` | `{A} divided by {B}` |
| `round` | `{A} 四舍五入` | `{A} rounded` |
| `days_between` | `{A} 与 {B} 之间的天数` | `days between {A} and {B}` |
| `epoch_ms` | `{A} 的时间戳` | `the epoch milliseconds of {A}` |
| `date_add` | `{A} 加 {B} 时长` | `{A} plus {B} duration` |
| `date_part` | `{A} 的 {part}` | `the {part} of {A}` |
| `month_last_day` | `{A} 所在月的最后一日` | `the last day of the month of {A}` |
| `aggregate(count)` | `{A} 的元素个数` | `the count of {A}` |
| `aggregate(sum)` | `{A} 之和` | `the sum of {A}` |
| `aggregate(avg)` | `{A} 的平均值` | `the average of {A}` |
| `aggregate(min)` | `{A} 的最小值` | `the minimum of {A}` |
| `aggregate(max)` | `{A} 的最大值` | `the maximum of {A}` |

> **`exists` 布尔字段特例**：当字段名匹配 `is_*`/`has_*`（布尔字段约定）时，`exists` 渲染为 `{A} 为"是"`（中文）/ `{A} is true`（英文），而非 `{A} 已发生`/`{A} exists`——布尔字段存在即真，避免「是否已告知 已发生」这类别扭表达。

---

## 6. then 决策类型

`then` 的值 MUST 属于以下 13 种决策类型：

| # | 决策类型 | 语义 |
|---|---------|------|
| 1 | ALLOW | 放行 |
| 2 | DENY | 拦截 |
| 3 | CORRECT | 纠正偏差 |
| 4 | NOTIFY | 通知 |
| 5 | REQUEST_HUMAN | 请求人工裁决 |
| 6 | ESCALATE | 升级 |
| 7 | DELEGATE | 委派 |
| 8 | DEFER | 延期 |
| 9 | EMERGENCY_HALT | 紧急停止 |
| 10 | ROLLBACK | 回滚 |
| 11 | QUARANTINE | 隔离 |
| 12 | WORKFLOW | 工作流（状态机；子态 WORKFLOW_WAITING / WORKFLOW_PROGRESS） |
| 13 | GUIDE | 引导 |

---

## 7. 求值语义

### 7.0 求值概览

求值 = 表达式树（规则编译产物）对**输入事实**（fact）逐节点判定的纯函数过程（E1）。本节定义求值的输入契约、算法步骤与输出契约，供实现者与使用者对齐。

#### 7.0.1 输入契约（事实对象）

求值输入是一个**事实对象**（fact），承载规则作用主体的当前状态，以 Entity（§3）为命名空间：

```yaml
fact:
  tool:                 # Entity: tool
    name: "issue_refund"
    args: { amount: 8000, order_id: "O1024" }
  context:              # 自由上下文字段（规则以 context.* 引用）
    country: "CN"
    role: "operator"
  # 其他 Entity：agent / task / workflow / human / guardian（按需提供）
```

- 字段引用（`tool.name`、`context.amount`、`tool.args.amount`）按事实对象的键路径解析（§3）；
- `as_of`（求值时刻，UTC）与 `temporal_state`（within/rate 滑动窗口状态）由引擎注入，属受控外部输入（E1）；
- 缺失字段按 E11 空值传播处理（§7.3(a)）。

#### 7.0.2 求值算法

```
输入：规则集 rules[] + 事实对象 fact
输出：决策结果（见 7.0.3）

1. 排序：按 priority 从小到大（值越小越优先）
2. 分组：按 ring 从 0 到 3 顺序执行（0 内核 → 1 恢复 → 2 审批 → 3 建议）
3. 每个 ring 内，按序求值每条规则：
   a. unless 豁免先于 when 判定——命中豁免则记录后跳过该规则
   b. 编译后的 when 表达式树对 fact 逐节点求值（true / false / 错误）
   c. 首命中：每个 ring 内 first-match-wins（命中即短路该 ring）
   d. override：仅 DENY → ALLOW 方向覆盖，不得覆盖到更不安全状态（§7.1）
4. 兜底：无规则命中 → metadata.decision（fallback 决策，§2.2）
5. 汇总：产出 decision + matched_rules + 证据（canonical_tree / hash / eval_trace）
```

- 求值错误按 E12 分 tier 折叠：tier≤2 及 Guard 上下文 fail-close，tier 3–5 折叠为 false；
- `EMERGENCY_HALT` 命中即短路；`DENY` 不短路——继续求值以判断是否有 override ALLOW 覆盖。

#### 7.0.3 输出契约（求值结果）

求值结果 MUST 包含以下字段：

| 字段 | 说明 |
|------|------|
| `decision` | 最终决策（§6 枚举之一，或 fallback 决策） |
| `matched_rules` | 命中的规则（按求值顺序） |
| `unless_exemptions` | 被 unless 豁免的规则（单独记录，不计入 matched_rules） |
| `primary_instruction` | 首要指令（ALLOW + instruction 场景） |
| `primary_reason` | 首要理由（DENY 等拦截场景） |
| `primary_explanation` | 首要解释（可中英双语） |
| `primary_correction` | 纠正文本（CORRECT 决策；来源为规则字段 `correction`，见 §4.1） |
| `total_evaluated` | 求值的规则总数 |
| `total_matched` | 命中的规则总数 |
| `temporal_state` | within/rate 滑动窗口状态快照（无命中时省略） |

> 求值证据（canonical_tree 快照、结果哈希、eval_trace）为可独立重算的派生产物（§8.2、E6）——canonical_tree 进哈希，eval_trace 不进哈希（§8.3）。

### 7.1 优先级与冲突解决

1. 按 `priority` 从小到大排序（值越小越先）；
2. 同 priority 有 `override` 标记的排前；
3. `override` 枚举：`critical` > `high` > `normal` > `low`（默认 `normal`）；
4. 同 priority 同 override 按定义顺序；
5. `override` 仅允许 DENY → ALLOW 方向覆盖（不得覆盖到更不安全状态）。

### 7.2 求值约束（E1–E12，全部 MUST）

| 编号 | 约束 |
|------|------|
| E1 | 求值是纯函数：无副作用、无隐式外部状态、无时钟读取；`within`/`rate` 的状态注入（`temporal_state`）与 `as_of` 同级，属受控外部输入 |
| E2 | 定点小数 scale=14 + half-even + 字符串序列化；中间计算用高精度有界有理数，仅输出节点舍入 |
| E3 | 求值错误记 eval_warnings，折叠方向按 E12 分 tier |
| E4 | 资源上限（分级）：Grade A 算术深度≤2 / 树深≤6 / 节点≤64 / 数组≤10000 / 单规则≤50ms / 量词不嵌套 / 正则步数≤10000；Grade B 树深≤10 / 节点≤256 / 算术深度≤4，量词嵌套≤2 层；Grade C 不适用 |
| E5 | 加载时类型检查；`when` 与 `expr` 不得共存 |
| E6 | 树即证据：canonical_tree（树快照）作为求值证据参与哈希；eval_trace 为可重算派生产物，不进哈希 |
| E7 | Simple 与 Expression 编译到同一求值核心，禁止两个求值器 |
| E8 | 量词安全折叠：空数组 → all/any/none 一律 false（反空洞真） |
| E9 | 禁读墙钟；as_of 由引擎注入并记入审计记录 |
| E10 | 字符串 NFC 规范化 |
| E11 | undefined 哨兵语义（空值传播，见 §7.3） |
| E12 | 求值错误处理：tier≤2 及 Guard 上下文缺省 fail-close，tier 3–5 折叠为 false |

内核显式排除：字符串拼接、正则替换、位运算、日期格式化、递归引用、用户自定义节点——以维持求值的封闭性与可验证性。

### 7.3 确定性语义（跨实现分叉防护）

以下语义 MUST 在文档与向量中显式标注，避免与标准实现产生语义误解：

**(a) 空值传播（E11）**：Agent 上下文高度动态，字段缺失是常态。求值 MUST 三值逻辑安全失败：

| 场景 | 行为 |
|------|------|
| 字段不存在时的相等/数值比较 | 返回 false（非 NPE） |
| `== null` / `!= null` 检查 | 正常返回 true / false |
| 类型不匹配的比较 | 返回 false（禁止隐式转换） |
| 字段不存在时的算术运算 | 返回 false（条件）或 EvaluationError（算术表达式） |

**(b) 量词空数组的安全折叠（E8）**：标准量词语义下 `all(空)=true`（空洞真）。本规范刻意偏离：`all/any/none(空)` 一律折叠为 false——防「无元素可校验却被判为放行」，并在审计记录中记录安全折叠。第三方实现 MUST 采用本折叠语义。

**(c) 定点小数的中间精度（E2）**：中间计算采用高精度有界有理数（如 128 位整数分子/分母），仅输出节点按 scale=14 + half-even 舍入为字符串序列化（IEEE 754-2019 ROUND_HALF_EVEN）。

**(d) 正则的 ReDoS 防护**：`match` 节点 MUST 同时满足：① 单次匹配步数 ≤10000；② 输入长度上限；③ 优先确定性引擎（RE2 类）或安全语法子集。

**(e) aggregate 空数组的安全折叠**：

| 函数 | 空数组结果 | 依据 |
|------|-----------|------|
| `count(空)` | `0` | 标准计数语义 |
| `sum(空)` | `0` | 空和恒等元 |
| `avg(空)` | `false` | 安全失败折叠（避免除零） |
| `min(空)` | `false` | 安全失败折叠（标准 +Infinity，禁用） |
| `max(空)` | `false` | 安全失败折叠（标准 −Infinity，禁用） |

`aggregate` 的 `over` MUST 为数组；非数组（缺失/标量/对象）返回 `null` + `type_mismatch` warning（折叠为 false）。`count(缺失)` 与 `count(空数组)` 语义不同：前者 type_mismatch，后者 0。

**(f) 时间节点的 UTC 语义（E9）**：所有时间节点统一以 UTC 求值，保证跨实现、跨时区逐字节一致：

- 输入解析：date-only（`YYYY-MM-DD`）按 UTC 解析；date-time 按 ISO 8601 带时区解析，无时区后缀按 UTC；
- 分量提取（`date_part`）：一律取 UTC 分量；
- 日期推演（`date_add`、`month_last_day`）：按 UTC 日历运算；
- 时间差（`days_between`）：UTC 毫秒差 ÷ 86400000 向下取整（floor）；
- 序列化：ISO 8601 UTC（`toISOString`）。

业务本地时区由引擎注入 `as_of` 时转换为 UTC 时刻，求值器以 UTC 纯函数运算。

### 7.4 when 最小完整度约束

`when: "true"` 的语义是「对所有操作生效」，仅适用于建议性规则：

| 规则 | 级别 |
|------|------|
| `when: "true"` MUST NOT 与 `then: DENY` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: EMERGENCY_HALT` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: CORRECT` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: REQUEST_HUMAN` 搭配 | MUST NOT |
| `when: "true"` MAY 与 `then: ALLOW + instruction` 搭配 | MAY |
| `when: "true"` MAY 与 `then: NOTIFY` 搭配 | MAY |
| 安全类规则（category=security）MUST 至少含 1 个 condition | MUST |
| 工具拦截类规则 SHOULD 含 `tool.name` 条件 | SHOULD |
| 文件操作规则 SHOULD 含 `tool.args.path` | SHOULD |
| 命令操作规则 SHOULD 含 `tool.args.command` | SHOULD |

---

## 8. 序列化与规范化

### 8.1 序列化

ERDL 文档以 YAML 承载，可无损转换为 JSON。规范化树（canonical_tree）以 JSON 对象形态序列化。

### 8.2 规范化树（Canonical Form）

表达式树是唯一求值、唯一哈希、唯一重算的基准对象。要使其哈希可跨实现逐字节一致，树 MUST 具有唯一规范化形式：

| 规范化规则 | 说明 |
|-----------|------|
| 节点序固定 | 子节点按规范顺序排列（左→右严格定序），与源书写顺序无关 |
| 字段名承重 | 字段引用路径承重——字段名发布即冻结 `[FREEZE-1]`，别名 MUST 先行归一化 |
| 字面量规范 | 数字以定点小数字符串表示（scale=14 + half-even）；字符串 NFC 规范化 |
| var 规范 | 仅支持 `$` / `$.path`，路径段为确定字节序列 |
| 元数据剥离 | 注释、来源行号、格式、作者等非语义元数据一律不进规范化树 |

> **树哈希的对象是规范化树，而非任何特定实现的内存表示或序列化文本。** 两个结构等价的树（仅字段书写顺序、空格、变量命名不同）规范化后产生完全相同的字节序列与哈希。

### 8.3 规范化树与 gloss 的关系

- gloss 由冻结渲染模板从树生成（G1）；
- **进哈希的是树（规范化形式），不含 gloss 文本**——树逐字节确定，满足哈希要求；
- gloss 文本不进哈希，因此措辞可有实现差异，不破坏树哈希的跨实现一致性；
- gloss 与树由渲染校验绑定（G2）——改 gloss 不改树即被判定无效。

这一「哈希树、校验 gloss 与树一致」的机制，使 gloss 在哈希模式下无需逐字节一致、也无需进哈希，即可获得树的密码学锚定。

---

## 9. 如何集成 ERDL

ERDL 的集成目标，是把关键判断从模型推理、框架代码或口头约定中抽离出来，变成可加载、可执行、可验证的规则资产。它通常以 YAML/JSON 规则文档承载，通过 `when → then` 完成决策，并输出可哈希、可逐字节复算的求值证据。以下三种集成路径，对应三类典型工程落点。

### 9.1 场景一：AI Agent（行为约束层 / Action Guard）

**角色**：在 AI Agent 链路中，ERDL 是 LLM 意图与系统执行之间的「确定性闸门」——Agent 可以生成动作，但动作是否允许执行，必须由规则求值决定。

**模拟**：客服 Agent 收到用户「退款 8000 元」的请求。LLM 将意图转换为工具调用：`issue_refund(amount=8000, order_id=O1024)`。在真正触达支付系统前，Action Guard 把工具名、参数、会话上下文打包成事实对象，交给 ERDL 求值。规则集中，R1 写作：`when tool.name == "issue_refund" 且 tool.args.amount > 5000 → REQUEST_HUMAN`；R2 写作：`when tool.name == "issue_refund" → ALLOW`。由于 R1 先命中，系统返回 `REQUEST_HUMAN`。Agent 停止调用支付工具，转为生成人工审批任务，并向用户返回「需人工复核」的话术。

**集成要点**：第一，规则在模型之外独立求值，Prompt 不再承担安全边界；第二，命中记录、输入摘要、`canonical_tree` 与结果哈希一并写入审计日志，任何一次拦截都可回放；第三，规则变更只需更新 ERDL 文档，不必重写 Agent 框架、工具实现或模型提示词。

### 9.2 场景二：MCP（协议分发 / 跨实现互操作）

**角色**：在 MCP 生态中，ERDL 规则通过 ERDL MCP Server 暴露为标准工具，任何 MCP 兼容 Agent 都能调用同一套规则，实现跨实现的合规分发与互认。

**模拟**：某企业将资金合规规则部署为 ERDL MCP Server，并暴露 `guard_check` 工具。第三方 Agent 准备执行一笔高额退款，但自身不掌握企业规则。执行前，它通过 MCP 调用 `guard_check`，传入动作描述：`action="issue_refund"`、`amount=8000`、`channel="payment"`。ERDL MCP Server 加载规则集，完成求值，返回：`decision=REQUEST_HUMAN`、`matched_rule=R1`、`hash=0x9f...`。第三方 Agent 根据返回值停止直接执行，转入人工审批流程，并将该决策凭据写入自己的执行日志。

**集成要点**：这里的关键是「规则即服务」。规则不再硬编码在某个 Agent 框架里，而是通过标准协议分发；不同厂商、不同语言、不同运行时的客户端，都可以消费同一份判断逻辑。由于返回结果携带规则命中与哈希信息，调用方即使不保存规则原文，也能把决策凭据归档，供后续审计或独立复算。规则升级时，只需更新 MCP Server 端，客户端无需重构执行链。

### 9.3 场景三：规则引擎（规则定义语言 / 确定性求值）

**角色**：在规则引擎内部，ERDL 是规则定义语言本身，负责以声明式方式表达业务策略，并提供确定性求值语义。

**模拟**：反洗钱引擎需要表达「大额交易且高风险国家 → 拦截」。业务团队编写 ERDL 规则：`when context.amount > 10000 且 context.country in ["高风险国家列表"] → DENY`。引擎加载 YAML 后，不会把它当成普通配置，而是编译为表达式树：比较节点处理金额阈值，集合节点判断国家归属，逻辑节点完成与运算。随后，引擎按照 E1–E12 求值语义执行，输出 `DENY`。该规则还可生成 `canonical_tree` 与哈希值；另一实现只要加载同一规则、同一输入，就能重算出相同结果。

**集成要点**：这里的核心价值是「可验证的确定性」。ERDL 不只让规则可读，还让引擎实现可以被测试向量约束。V-ENGINE 类测试向量可以证明：不同引擎、不同平台、不同版本，对同一规则应产生逐字节一致的结果。由此，规则引擎不再只是业务系统内部黑盒，而是可以接受第三方独立验证的执行器。监管方、审计方或平台方都能依据输入、规则哈希与求值证据，判断「引擎算得对不对」。

---

## 10. 示例与一致性验证

### 10.1 Quick Start（快速上手）

一个最小 ERDL 文档 + 一次求值，走完「写 → 加载 → 求值 → 得结果」全链路（管线见 §2.4）。

**第一步 · 写规则**（`refund.erdl.yaml`）：

```yaml
protocol: "erdl/v2"
version: "2.1.0"
metadata:
  name: "refund-guard"
  description: "退款金额管控"
  category: coding
  decision: ALLOW
rules:
  - name: "SEC-001-refund-limit"
    description: "退款超过 5000 需人工审批"
    priority: 10
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "issue_refund"
        - field: "tool.args.amount"
          operator: gt
          value: 5000
    then: REQUEST_HUMAN
    message: "退款金额超过 5000，需人工审批"
```

**第二步 · 加载 + 校验 + 编译**：解析 YAML，校验通过后把 `when` 编译为表达式树（§2.4 步骤①②③）。

**第三步 · 求值**：给定事实对象：

```yaml
fact:
  tool:
    name: "issue_refund"
    args: { amount: 8000 }
```

规则 `SEC-001` 命中（`tool.name == "issue_refund"` 且 `amount > 5000`）。

**第四步 · 结果**：

```yaml
decision: REQUEST_HUMAN
matched_rules: ["SEC-001-refund-limit"]
primary_reason: "退款金额超过 5000，需人工审批"
total_evaluated: 1
total_matched: 1
```

若输入改为 `amount: 100`，规则不命中，走 `metadata.decision` fallback → `decision: ALLOW`。

### 10.2 完整示例

见 §4.2（Simple 规则）与 §5.3（Expression 规则）、§5.4（决策表）。

### 10.3 一致性验证

本规范的语义 MUST 由可独立重算的测试向量证明。表达层向量（V-ENGINE / V-GLOSS / V-PROJ）覆盖：34 节点 × 4 场景（正常/边界/异常/空值）、E1-E12 语义、Simple 30 运算符编译映射、gloss 渲染模板。

**五步验证法**：加载向量输入 → 生成表达式树 → 重算求值结果 → 与答案对比 → 判定一致。

**第三方 Runner 验证流程（从零到合规）**：

1. 读本规范；
2. 用自己选择的技术栈实现独立验证器（不引用任何既有实现代码）；
3. 加载测试向量，逐字节比对；
4. 对照 Runner 契约确认自建实现满足契约；
5. 提交结果至实现注册表，供第三方审计复验。

---

## 附录 A · 34 节点参考表

| 组 | 节点 | 数量 |
|----|------|:---:|
| 取值 | field · var · 字面量 | 3 |
| 逻辑 | and · or · not | 3 |
| 比较 | eq · ne · gt · gte · lt · lte | 6 |
| 集合 | in | 1 |
| 字符串 | contains · match · starts_with · ends_with | 4 |
| 存在/量纲 | exists · length · between | 3 |
| 量词 | all · any · none | 3 |
| 算术 | add · sub · mul · div · round | 5 |
| 时间 | days_between · epoch_ms · date_add · date_part · month_last_day | 5 |
| 聚合 | aggregate（count/sum/avg/min/max） | 1 |

合计 **34 节点**。

## 附录 B · Simple 30 运算符参考表

| 族 | 运算符 | 数量 |
|----|------|:---:|
| 比较 | eq · ne · gt · gte · lt · lte | 6 |
| 列表 | in · not_in | 2 |
| 字符串 | contains · not_contains · match · starts_with · ends_with | 5 |
| 边界否定 | not_starts_with · not_ends_with | 2 |
| 存在性 | exists · not_exists | 2 |
| 长度 | length_gt · length_gte · length_lt · length_lte · length_eq | 5 |
| 范围 | between · not_between | 2 |
| 计数 | count_gt · count_gte · count_lt · count_lte | 4 |
| 修饰符 | within · rate | 2 |

合计 **30 运算符**（28 条件运算符 + 2 条件修饰符）。

## 附录 C · 决策类型枚举（13 种）

见 §6。

## 附录 D · 函数委派与规则分级

对于内核显式排除、确有需求的场景，提供函数委派（FnRegistry）作为受控兜底：

| 约束 | 说明 |
|------|------|
| 注册制 | 函数 MUST 注册方可引用，未注册不可调用 |
| 沙箱执行 | 受限环境，受资源配额与超时约束 |
| 确定性豁免声明 | 用于 Guard 求值路径的函数 MUST 声明并保证确定性 |
| 审计可溯 | 每次调用记入审计记录，可离线核验 |

**规则分级（Grade）**：

| Grade | 表达方式 | 审计 SLA |
|:---:|------|------|
| A | 纯 Simple（30 运算符） | 最高，纯文本可重算 |
| B | Expression 树 | 高，eval_trace MUST |
| C | 含函数委派 | 分层，C 级不得冒充纯文本可重算 |

含函数委派的规则（Grade C）MUST 在 gloss 中显式标记「含不可重算的函数委派」；函数委派的调用输入 + 输出哈希 MUST 纳入结果哈希的原像。

---

## 附录 E · 术语表

| 术语 | 一句话定义 |
|------|-----------|
| Entity（实体） | 规则作用的主体类型（agent/tool/task/workflow/human/guardian），字段引用的命名空间（§3） |
| Rule（规则） | `when → then` 决策单元 |
| when | 规则触发条件（编译为表达式树） |
| then | 规则命中后的决策类型（§6） |
| tier | 规则层级 0–5，由低到高表示约束强度；tier 0–2 用 Simple，≥3 可用 Expression |
| ring | 执行环 0–3（内核/恢复/审批/建议），求值按环序执行 |
| override | 覆盖级别 critical > high > normal > low，仅允许 DENY → ALLOW 方向 |
| 表达式树 | 求值语义内核（34 节点，10 组），三种书写形态编译归一化到它 |
| canonical_tree | 规范化树，唯一哈希、唯一重算的基准对象（§8.2） |
| gloss | 从树确定性生成的自然语言可读投影（§5.5） |
| eval_trace | 逐节点求值轨迹（可重算派生产物，不进哈希，E6） |
| eval_warnings | 求值过程中的非致命警告（E3） |
| temporal_state | within/rate 滑动窗口状态（有状态算子） |
| as_of | 引擎注入的求值时刻（UTC，E9） |
| 事实对象（fact） | 求值输入，承载 Entity 当前状态（§7.0.1） |
| fallback 决策 | 无规则命中时 metadata.decision 的兜底裁决（§2.2） |
| NFC | Unicode 规范化形式 C（字符串归一，E10） |
| ReDoS | 正则拒绝服务攻击；match 节点 MUST 步数上限防护（§7.3(d)） |
| half-even | 银行家舍入（ROUND_HALF_EVEN），E2 定点小数输出舍入 |
| 空值传播 | 字段缺失统一返回 false 的安全失败语义（E11） |

---

## 修订历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.1 | 2026-09-03 | §4.1 新增 `category`（规则级覆盖）、`enabled`（启用标志）、`correction`（CORRECT 纠偏文本）三个可选字段，补全字段表与固定顺序；§7.0.3 补 `primary_correction` 来源交叉引用。协议 `erdl/v2` 不变；规则格式版本 2.0.0 → 2.1.0（新增可选字段，Non-breaking） |
| v2.0 | 2026-08-30 | 定稿 |

---

## 规范性引用

- **[RFC 2119]** Key words for use in RFCs to Indicate Requirement Levels.

---

*© 2026 深圳市秒镜科技有限公司 · MIT License*
