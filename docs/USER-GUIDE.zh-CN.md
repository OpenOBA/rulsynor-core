# rulsynor-core 用户指南

本指南带你**使用** rulsynor-core——ERDL 护栏化的 Agent 运行时。前提是你已安装本包；开发请见 [`docs/DEVELOPMENT.md`](DEVELOPMENT.md)；规则语义请见 [`docs/RULE-AUTHORING.md`](RULE-AUTHORING.md)。

---

## 1. 快速开始

### 1.1 安装

需要 **Node ≥ 22.13.0**（使用内置 `node:sqlite`，零原生依赖）：

```bash
npm install -g @openoba/rulsynor-core
```

### 1.2 零配置试跑 Guard

无需 API key——这会跑通「规则加载 + 求值 + 审计」：

```bash
rulsynor demo --tool=exec --cmd="rm -rf /"   # → DENY
```

### 1.3 配置模型 + key，然后对话

API key **只存在你的环境变量里**——CORE 从不存储它：

```bash
export RULSYNOR_API_KEY=<你的 key>   # 任意 OpenAI 兼容服务商
rulsynor setup --model gpt-4o-mini --base-url https://api.openai.com/v1
rulsynor chat
```

---

## 2. CLI 命令参考

```
rulsynor <command> [options]
```

| 命令 | 用途 | 需 API key |
|------|------|:---:|
| `chat [--once "msg"]` | 7 步 Agent 循环（意图 → 计划 → 依据 → 推理 → 把关 → 审计 → 执行）| ✅ |
| `setup [--model M --base-url U \| --show]` | 配置模型名 / base URL（key 仅从环境读）| ❌ |
| `rules list` | 列出所有已加载规则（预置 + 用户目录）| ❌ |
| `audit list [--limit N]` | 最近的审计记录（只读）| ❌ |
| `audit show <hash-prefix>` | 查看单条 Decision Object（只读）| ❌ |
| `mcp` | 启动 MCP stdio 服务 | ❌ |
| `demo` | 一次性 Guard 演示（无需 API key）| ❌ |
| `help` | 显示帮助 | ❌ |

### 环境变量

| 变量 | 含义 |
|------|------|
| `RULSYNOR_API_KEY` | LLM API key（OpenAI 兼容）——`chat` 必需 |
| `RULSYNOR_HOME` | CORE 主目录（默认 `~/.rulsynor`）|
| `RULSYNOR_RULES_DIR` | 用户规则目录（默认 `./rules` 或 `~/.rulsynor/rules`）|

> `audit show` 的哈希前缀**带不带 `sha256:` 都行**。

---

## 3. 新增规则

一条规则就是一个 `.erdl.yaml` 文件，使用 ERDL 规范文档格式。

### 3.1 写规则文件

```yaml
protocol: erdl/v2
version: 2.0.0
metadata:
  name: my-rules
  category: security
  decision: ALLOW          # 无规则命中时的兜底决策
rules:
  - name: SEC-050-block-api-key-write
    description: 阻止把 API key / secret 写进文件
    priority: 900          # 越大越先
    ring: 0                # 决议层级 0-3（0 最强）
    when:
      logic: AND
      conditions:
        - field: tool.name
          operator: eq
          value: write_file
        - field: tool.args.content
          operator: match
          value: (api_key|secret|token)\s*[:=]\s*[A-Za-z0-9]
    then: DENY             # 13 决策之一
    message: 疑似凭证写入，已拦截
    alternative: 改用环境变量或 secrets manager 注入
```

### 3.2 放进规则目录

```bash
mkdir -p ./rules          # 或 ~/.rulsynor/rules，或设置 RULSYNOR_RULES_DIR
# 放入你的 *.erdl.yaml —— 启动时自动加载，经质量门禁
rulsynor rules list
```

### 3.3 关键字段

| 字段 | 含义 |
|------|------|
| `name` | 规则名——**前缀需登记**（见 `RULE_NAME_PREFIXES`）|
| `priority` | 越大越先 |
| `ring` | 决议层级 0-3 |
| `when.conditions` | `field` + `operator`（28 种运算符）+ `value` |
| `then` | 13 决策之一 |
| `message` / `alternative` / `correction` | 命中消息 / 替代建议 / 纠正文本 |

> 自定义前缀必须先登记（ADR-003「先登记后使用」），否则加载时以 `NON_STANDARD_NAME_FULL` 拒载。

---

## 4. 七步工作法

`rulsynor chat` 每轮执行七步：

| 步骤 | 作用 |
|------|------|
| ① 意图 | 识别意图域 |
| ② 计划 | 产出步骤计划 + 风险等级 |
| ③ 依据 | 组装知识片段 |
| ④ 推理 | ReAct 推理轮 |
| ⑤ 把关 | ERDL 规则裁决 ALLOW / DENY / CORRECT / … |
| ⑥ 审计 | 落链防篡改 Decision Object |
| ⑦ 执行 | 执行工具调用 |

每次受护栏的工具调用都会记录**一条 Decision Object**——见 §5。

---

## 5. 审计

每一次受护栏决策都写入只读、防篡改的审计链。

```bash
rulsynor audit list                      # 最近的记录
rulsynor audit show sha256:5cd397b1…     # 单条完整 Decision Object
```

- `audit list` 显示时间 / 决策 / 工具 / 哈希。
- `audit show` 打印完整 Decision Object v1.5（合规画像、规则集版本、命中规则、逐字段哈希）。
- CORE 只提供只读查看；导出/下载是商业版能力。

---

## 6. 部署

把 Guard 放在 Agent 工具调用的前面。规则在**模型之外**求值——安全边界从不押在提示词上。

```ts
import { Evaluator, GuardStateManager, loadPresetRules, toCompiledRules } from '@openoba/rulsynor-core';

const evaluator = new Evaluator(new GuardStateManager());
const rules = toCompiledRules(loadPresetRules());
const decision = evaluator.evaluate(rules, {
  tool: { name: 'exec', args: { command: 'rm -rf /' } },
  sessionId: 's1',
  agentId: 'my-agent',
});
```

MCP 集成：运行 `rulsynor mcp` 启动 stdio 服务。

---

参见：[`docs/RULE-AUTHORING.md`](RULE-AUTHORING.md)（规则语义）、
[`docs/API.md`](API.md)（引擎 API）、[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)（架构）。
