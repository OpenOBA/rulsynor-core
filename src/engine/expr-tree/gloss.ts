/**
 * gloss - deterministic natural-language rendering from an expression tree.
 *
 * gloss = render(tree): frozen rendering templates generate canonical,
 * human-readable text node by node from the tree.
 * This is the mechanism behind "transparent execution, instantly understood by humans".
 *
 * Invariants as realized in this file:
 * - renderTree is a pure function with frozen templates
 * - Uses Entity display_names (injected via fieldNames); raw field paths are
 *   forbidden (falls back to the field name)
 * - Chinese-English bilingual rendering
 *
 * Note: this file only renders "condition tree -> human-readable text"; the
 * then-decision suffix (e.g. "require human approval") is appended by the
 * caller (see renderGloss, which accepts a decision parameter).
 *
 * @license MIT
 */

import type { ExprNode } from './node-types.js';

export type GlossLang = 'zh' | 'en';

/** Field name -> display_name mapping (provided by the knowledge layer; defaults to the raw field name). */
export type FieldNameMap = Record<string, string>;

/** Render the bilingual (zh/en) text for a single node. */
export function renderNode(node: ExprNode, lang: GlossLang, fieldNames: FieldNameMap = {}): string {
  const field = (name: string): string => {
    const dn = fieldNames[name];
    return dn ?? name;
  };

  switch (node.type) {
    case 'literal':
      return renderLiteral(node.value, lang);
    case 'field':
      return field(node.field);
    case 'var':
      return node.path === '$' ? '$' : node.path;

    case 'and':
      return joinLogic(
        node.args.map(a => renderLogicChild('and', a, lang, fieldNames)),
        'and',
        lang,
      );
    case 'or':
      return joinLogic(
        node.args.map(a => renderLogicChild('or', a, lang, fieldNames)),
        'or',
        lang,
      );
    case 'not': {
      // not(exists X) -> normalize to "X is absent" (readable for non-technical users; avoids the double negative "not X exists")
      if (node.arg.type === 'exists') {
        const subject = renderNode(node.arg.arg, lang, fieldNames);
        return lang === 'zh' ? `${subject} 未发生` : `${subject} is absent`;
      }
      // not(compare) -> negated operator wording: equals->does not equal, etc. (avoids "not (A equals B)")
      if (node.arg.type === 'compare') {
        const negated: Record<string, string> = {
          eq: 'ne',
          ne: 'eq',
          gt: 'lte',
          lte: 'gt',
          lt: 'gte',
          gte: 'lt',
        };
        const negOp = negated[node.arg.op];
        if (negOp) {
          return compareGloss(
            negOp,
            renderNode(node.arg.left, lang, fieldNames),
            renderNode(node.arg.right, lang, fieldNames),
            lang,
          );
        }
      }
      const inner = renderNode(node.arg, lang, fieldNames);
      // Parenthesize when the child of not is and/or, to avoid the precedence ambiguity of "not A and B"
      const wrapped = node.arg.type === 'and' || node.arg.type === 'or' ? `(${inner})` : inner;
      return lang === 'zh' ? `非 ${wrapped}` : `not ${wrapped}`;
    }

    case 'compare':
      return compareGloss(
        node.op,
        renderNode(node.left, lang, fieldNames),
        renderNode(node.right, lang, fieldNames),
        lang,
      );
    case 'in': {
      const l = renderNode(node.left, lang, fieldNames);
      const r = renderNode(node.right, lang, fieldNames);
      return lang === 'zh' ? `${l} 在 ${r} 中` : `${l} in ${r}`;
    }
    case 'string': {
      const l = renderNode(node.left, lang, fieldNames);
      const r = renderNode(node.right, lang, fieldNames);
      return stringGloss(node.op, l, r, lang);
    }

    case 'exists': {
      const subject = renderNode(node.arg, lang, fieldNames);
      // Boolean fields (is_*/has_*) are true when present: render as "is true" rather than "exists" (avoids awkward phrasing)
      if (node.arg.type === 'field' && /^(is_|has_)/.test(node.arg.field)) {
        return lang === 'zh' ? `${subject} 为"是"` : `${subject} is true`;
      }
      return lang === 'zh' ? `${subject} 已发生` : `${subject} exists`;
    }
    case 'length':
      return lang === 'zh'
        ? `${renderNode(node.arg, lang, fieldNames)} 的长度`
        : `length of ${renderNode(node.arg, lang, fieldNames)}`;
    case 'between': {
      const v = renderNode(node.value, lang, fieldNames);
      const mn = renderNode(node.min, lang, fieldNames);
      const mx = renderNode(node.max, lang, fieldNames);
      // Closed interval [min,max]; the inclusive endpoints must be spelled out to avoid the open-interval ambiguity of "between"
      return lang === 'zh'
        ? `${v} 在闭区间 ${mn} 到 ${mx}（含两端）`
        : `${v} is in the inclusive range ${mn} to ${mx}`;
    }

    case 'quantifier': {
      const over = renderNode(node.over, lang, fieldNames);
      const pred = renderNode(node.predicate, lang, fieldNames);
      const qz = quantifierGloss(node.kind, lang);
      return lang === 'zh'
        ? `${over} 中${qz}满足「${pred}」`
        : `${qz} elements in ${over} satisfy "${pred}"`;
    }

    case 'arith':
      return arithGloss(
        node.op,
        node.args.map(a => renderNode(a, lang, fieldNames)),
        lang,
      );

    case 'days_between': {
      const f = renderNode(node.from, lang, fieldNames);
      const t = renderNode(node.to, lang, fieldNames);
      return lang === 'zh' ? `从 ${f} 到 ${t} 经过的天数` : `days between ${f} and ${t}`;
    }
    case 'epoch_ms': {
      const a = renderNode(node.arg, lang, fieldNames);
      return lang === 'zh' ? `${a} 的时间戳` : `epoch ms of ${a}`;
    }
    case 'date_add': {
      const b = renderNode(node.base, lang, fieldNames);
      const amt = renderNode(node.amount, lang, fieldNames);
      const unitsZh: Record<string, string> = {
        years: '年',
        months: '个月',
        days: '天',
        hours: '小时',
      };
      const unitsEn: Record<string, string> = {
        years: 'years',
        months: 'months',
        days: 'days',
        hours: 'hours',
      };
      return lang === 'zh'
        ? `${b} 加 ${amt}${unitsZh[node.unit] ?? node.unit}`
        : `${b} plus ${amt} ${unitsEn[node.unit] ?? node.unit}`;
    }
    case 'date_part': {
      const a = renderNode(node.arg, lang, fieldNames);
      const partsZh: Record<string, string> = {
        year: '年',
        month: '月',
        day: '日',
        hour: '时',
        minute: '分',
        second: '秒',
        day_of_week: '星期几',
      };
      const partsEn: Record<string, string> = {
        year: 'year',
        month: 'month',
        day: 'day',
        hour: 'hour',
        minute: 'minute',
        second: 'second',
        day_of_week: 'day of week',
      };
      return lang === 'zh'
        ? `${a} 的${partsZh[node.unit] ?? node.unit}`
        : `${partsEn[node.unit] ?? node.unit} of ${a}`;
    }
    case 'month_last_day': {
      const a = renderNode(node.arg, lang, fieldNames);
      return lang === 'zh' ? `${a} 所在月的最后一天` : `last day of the month of ${a}`;
    }

    case 'aggregate':
      return aggregateGloss(node.fn, renderNode(node.over, lang, fieldNames), lang);
  }
}

/** Render the complete gloss (condition + decision suffix). */
export function renderGloss(
  root: ExprNode,
  decision: string,
  lang: GlossLang = 'zh',
  fieldNames: FieldNameMap = {},
): string {
  const cond = renderNode(root, lang, fieldNames);
  return lang === 'zh'
    ? `当 ${cond} 时，${decisionGloss(decision, lang)}`
    : `When ${cond}, ${decisionGloss(decision, lang)}`;
}

// ===========================================
// Helper rendering functions
// ===========================================

/**
 * Render a child of a logic combinator (and/or), parenthesizing based on precedence.
 * Rule: when a child of and is an or (or vice versa), parenthesize it to avoid
 * the precedence ambiguity of "A and B or C".
 */
function renderLogicChild(
  parent: 'and' | 'or',
  child: ExprNode,
  lang: GlossLang,
  fieldNames: FieldNameMap,
): string {
  const inner = renderNode(child, lang, fieldNames);
  const needsWrap = (child.type === 'and' || child.type === 'or') && child.type !== parent;
  return needsWrap ? `(${inner})` : inner;
}

/**
 * Join parts with the logic-combinator conjunction. Chinese typography: no spaces
 * around the full-width comma; the zh "or" follows a full-width comma and precedes
 * one space before the next branch. English uses the conventional surrounding
 * spaces (" and " / " or ").
 */
function joinLogic(parts: string[], kind: 'and' | 'or', lang: GlossLang): string {
  if (lang === 'zh') return parts.join(kind === 'and' ? '，' : '，或 ');
  return parts.join(kind === 'and' ? ' and ' : ' or ');
}

function renderLiteral(value: unknown, lang: GlossLang): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return lang === 'zh' ? '空' : 'null';
  if (Array.isArray(value)) return `[${value.map(v => renderLiteral(v, lang)).join(', ')}]`;
  return JSON.stringify(value);
}

function compareGloss(op: string, l: string, r: string, lang: GlossLang): string {
  const zh: Record<string, string> = {
    eq: '等于',
    ne: '不等于',
    gt: '大于',
    gte: '大于等于',
    lt: '小于',
    lte: '小于等于',
  };
  const en: Record<string, string> = {
    eq: 'equals',
    ne: 'does not equal',
    gt: 'is greater than',
    gte: 'is greater than or equal to',
    lt: 'is less than',
    lte: 'is less than or equal to',
  };
  const opWord = lang === 'zh' ? zh[op] : en[op];
  return `${l} ${opWord} ${r}`;
}

function stringGloss(op: string, l: string, r: string, lang: GlossLang): string {
  const zh: Record<string, string> = {
    contains: '包含',
    match: '匹配',
    starts_with: '以...开头',
    ends_with: '以...结尾',
  };
  const en: Record<string, string> = {
    contains: 'contains',
    match: 'matches',
    starts_with: 'starts with',
    ends_with: 'ends with',
  };
  const opWord = lang === 'zh' ? zh[op] : en[op];
  if (lang === 'zh') {
    switch (op) {
      case 'contains':
        return `${l} 包含 ${r}`;
      case 'match':
        return `${l} 匹配 ${r}`;
      case 'starts_with':
        return `${l} 以 ${r} 开头`;
      case 'ends_with':
        return `${l} 以 ${r} 结尾`;
      default:
        return `${l} ${opWord} ${r}`;
    }
  }
  return `${l} ${opWord} ${r}`;
}

function quantifierGloss(kind: string, lang: GlossLang): string {
  if (lang === 'zh') {
    return { all: '所有元素都', any: '至少一个元素', none: '没有元素' }[kind] ?? kind;
  }
  return { all: 'all', any: 'at least one element', none: 'no' }[kind] ?? kind;
}

function arithGloss(op: string, args: string[], lang: GlossLang): string {
  const zh: Record<string, string> = {
    add: '加',
    sub: '减',
    mul: '乘',
    div: '除以',
    round: '四舍五入',
  };
  const en: Record<string, string> = {
    add: 'plus',
    sub: 'minus',
    mul: 'times',
    div: 'divided by',
    round: 'rounded',
  };
  if (op === 'round') {
    return lang === 'zh' ? `${args[0]} 四舍五入` : `${args[0]} rounded`;
  }
  const word = lang === 'zh' ? zh[op] : en[op];
  if (args.length === 2) return `(${args[0]} ${word} ${args[1]})`;
  return `(${args.join(` ${word} `)})`;
}

function aggregateGloss(fn: string, over: string, lang: GlossLang): string {
  const zh: Record<string, string> = {
    count: '数量',
    sum: '总和',
    avg: '平均值',
    min: '最小值',
    max: '最大值',
  };
  const en: Record<string, string> = {
    count: 'count',
    sum: 'sum',
    avg: 'average',
    min: 'minimum',
    max: 'maximum',
  };
  const word = lang === 'zh' ? zh[fn] : en[fn];
  return lang === 'zh' ? `${over} 的${word}` : `${word} of ${over}`;
}

function decisionGloss(decision: string, lang: GlossLang): string {
  const zh: Record<string, string> = {
    ALLOW: '放行',
    DENY: '拒绝',
    CORRECT: '纠正',
    REQUEST_HUMAN: '需人工审批',
    ESCALATE: '升级处理',
    NOTIFY: '通知',
    EMERGENCY_HALT: '紧急停机',
    ROLLBACK: '回滚',
    QUARANTINE: '隔离',
    GUIDE: '按指引执行',
    WORKFLOW: '进入工作流',
    DELEGATE: '委派处理',
    DEFER: '暂缓处理',
  };
  const en: Record<string, string> = {
    ALLOW: 'allow',
    DENY: 'deny',
    CORRECT: 'correct',
    REQUEST_HUMAN: 'require human approval',
    ESCALATE: 'escalate',
    NOTIFY: 'notify',
    EMERGENCY_HALT: 'emergency halt',
    ROLLBACK: 'rollback',
    QUARANTINE: 'quarantine',
    GUIDE: 'follow guidance',
    WORKFLOW: 'enter workflow',
    DELEGATE: 'delegate',
    DEFER: 'defer',
  };
  return (lang === 'zh' ? zh[decision] : en[decision]) ?? decision;
}

/**
 * Render a decision table -> natural language (a multi-tier comparison list).
 *
 * A decision table is not a single tree but multiple rows (each row = condition
 * combination + decision), so it does not go through renderNode; instead each
 * row is rendered into a comparison list. Like the tree gloss, this is a
 * deterministic projection.
 */
export function renderDecisionTableGloss(
  table: {
    columns: string[];
    rows: Array<{ conditions: Record<string, unknown>; decision: string }>;
  },
  lang: GlossLang = 'zh',
  fieldNames: FieldNameMap = {},
): string {
  const col = (name: string): string => fieldNames[name] ?? name;
  const val = (v: unknown): string => renderLiteral(v, lang);

  const lines: string[] = table.rows.map(row => {
    const condStrs = table.columns
      .filter(c => row.conditions[c] !== undefined)
      .map(c => `${col(c)} ${lang === 'zh' ? '为' : 'is'} ${val(row.conditions[c])}`);
    const cond = condStrs.join(lang === 'zh' ? ' 且 ' : ' and ');
    const action = decisionGloss(row.decision, lang);
    return lang === 'zh' ? `当 ${cond} 时，${action}` : `When ${cond}, ${action}`;
  });

  return lines.join(lang === 'zh' ? '；' : '; ');
}
