/**
 * ERDL 表达式树 — 类型化表达式树内核（SPEC v2.0 §10 SafeExpr 表达式引擎）
 *
 * 语义内核是类型化表达式树。本文件的 TS 判别式联合共 17 个 type：
 * 参数化节点（compare 6 算子 / string 4 算子 / arith 5 算子 / quantifier 3 量词 / aggregate 5 聚合）
 * 合并为单 type，故 type 数少于 S-expression 语义键名数（35，见 s-expression.ts）。
 * 节点集规范级冻结，只裁剪不扩张。
 *
 * 本文件定义内核的【内存类型表示】与【S-expression 规范化序列化】两个视图：
 *  - TS 内部：判别式联合（type 字段），供求值器做穷尽 switch + 类型安全
 *  - S-expression（SPEC §12 外在形态，键名即节点）：供跨实现哈希 / 向量 / LLM 生成对标
 *
 * 二者是同一棵树的两种投影，语义零损失，非两套求值器（E7）。
 *
 * @author 唐浩然 (Tang Haoran) · OpenOBA AI 执行官
 * @since 2026-08-15
 * @license MIT
 */

// ═══════════════════════════════════════════
// 17 个 type（参数化节点合并，见文件头说明；冻结）
// ═══════════════════════════════════════════

/** 取值：field / var / literal */
export type FieldNode = { type: 'field'; field: string };
export type VarNode = { type: 'var'; path: string }; // 仅 '$' 或 '$.path'，禁读时钟/随机
export type LiteralNode = { type: 'literal'; value: unknown };

/** 逻辑：and / or / not */
export type AndNode = { type: 'and'; args: ExprNode[] };
export type OrNode = { type: 'or'; args: ExprNode[] };
export type NotNode = { type: 'not'; arg: ExprNode };

/** 比较：eq / ne / gt / gte / lt / lte（操作数可为字段/变量/字面量/算术子树） */
export type CompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
export type CompareNode = { type: 'compare'; op: CompareOp; left: ExprNode; right: ExprNode };

/** 集合：in */
export type InNode = { type: 'in'; left: ExprNode; right: ExprNode }; // right 求值为数组

/** 字符串：contains / match / starts_with / ends_with */
export type StringOp = 'contains' | 'match' | 'starts_with' | 'ends_with';
export type StringNode = { type: 'string'; op: StringOp; left: ExprNode; right: ExprNode };

/** 存在/量纲：exists / length / between */
export type ExistsNode = { type: 'exists'; arg: ExprNode };
export type LengthNode = { type: 'length'; arg: ExprNode };
export type BetweenNode = { type: 'between'; value: ExprNode; min: ExprNode; max: ExprNode };

/** 量词：all / any / none（数组逐元素判定；空数组折叠见 E8） */
export type QuantifierKind = 'all' | 'any' | 'none';
export type QuantifierNode = {
  type: 'quantifier';
  kind: QuantifierKind;
  /** 被量化元素的绑定变量名（如 'x'） */
  binding: string;
  /** 迭代的数组来源 */
  over: ExprNode;
  /** 对每个元素判定的谓词（可引用 binding） */
  predicate: ExprNode;
};

/** 算术：add / sub / mul / div / round（定点小数确定性运算，E2） */
export type ArithOp = 'add' | 'sub' | 'mul' | 'div' | 'round';
export type ArithNode = { type: 'arith'; op: ArithOp; args: ExprNode[] };

/** 时间：days_between / epoch_ms（禁读墙钟，E9；as_of 由引擎注入） */
export type DaysBetweenNode = { type: 'days_between'; from: ExprNode; to: ExprNode };
export type EpochMsNode = { type: 'epoch_ms'; arg: ExprNode };

/** 时间加法单位（参数化；对齐民法典 §200 年/月/日/小时） */
export type DateAddUnit = 'years' | 'months' | 'days' | 'hours';
/** 时间加减：date_add{unit}，amount 正=顺加往后推，负=逆推往前推（对齐 §200 + 逆推） */
export type DateAddNode = { type: 'date_add'; unit: DateAddUnit; base: ExprNode; amount: ExprNode };

/** 时间分量单位（参数化） */
export type DatePartUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'day_of_week';
/** 取时间分量：date_part{unit}（day_of_week：1=周一 … 7=周日） */
export type DatePartNode = { type: 'date_part'; unit: DatePartUnit; arg: ExprNode };

/** 某日所在月的最后一天（§202 月末回退的底层原语） */
export type MonthLastDayNode = { type: 'month_last_day'; arg: ExprNode };

/** 聚合：aggregate(count/sum/avg/min/max)，数组聚合 + 可选结构化窗口 */
export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type AggregateNode = { type: 'aggregate'; fn: AggregateFn; over: ExprNode };

/** 表达式树节点联合（时间节点族扩展后 20 个判别式联合 type） */
export type ExprNode =
  | FieldNode
  | VarNode
  | LiteralNode
  | AndNode
  | OrNode
  | NotNode
  | CompareNode
  | InNode
  | StringNode
  | ExistsNode
  | LengthNode
  | BetweenNode
  | QuantifierNode
  | ArithNode
  | DaysBetweenNode
  | EpochMsNode
  | DateAddNode
  | DatePartNode
  | MonthLastDayNode
  | AggregateNode;

// ═══════════════════════════════════════════
// 节点类型分类（用于校验 / 资源上限 / 规范化）
// ═══════════════════════════════════════════

export const NODE_TYPE_LABELS: Record<ExprNode['type'], string> = {
  field: 'field',
  var: 'var',
  literal: 'literal',
  and: 'and',
  or: 'or',
  not: 'not',
  compare: 'compare',
  in: 'in',
  string: 'string',
  exists: 'exists',
  length: 'length',
  between: 'between',
  quantifier: 'quantifier',
  arith: 'arith',
  days_between: 'days_between',
  epoch_ms: 'epoch_ms',
  aggregate: 'aggregate',
  date_add: 'date_add',
  date_part: 'date_part',
  month_last_day: 'month_last_day',
};

/** 叶子节点（无子节点） */
export type LeafNodeType = 'field' | 'var' | 'literal';
/** 逻辑组合子 */
export type LogicNodeType = 'and' | 'or' | 'not';

export function isLeaf(node: ExprNode): node is FieldNode | VarNode | LiteralNode {
  return node.type === 'field' || node.type === 'var' || node.type === 'literal';
}
