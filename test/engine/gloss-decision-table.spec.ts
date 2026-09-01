/**
 * gloss-decision-table.spec.ts — 决策表 gloss 渲染回归测试
 */
import { renderDecisionTableGloss } from '../../src/engine/expr-tree/gloss.js';

describe('renderDecisionTableGloss', () => {
  const table = {
    columns: ['disease_category'],
    rows: [
      { conditions: { disease_category: '罕见重疾' }, decision: 'ALLOW' },
      { conditions: { disease_category: '普通重疾' }, decision: 'ALLOW' },
      { conditions: { disease_category: '一般轻症' }, decision: 'DENY' },
    ],
  };

  it('渲染中文对照：多行用；分隔，每行「当 X 为 a 时，动作」', () => {
    const gloss = renderDecisionTableGloss(table, 'zh');
    expect(gloss).toContain('当 disease_category 为 "罕见重疾" 时，放行');
    expect(gloss).toContain('当 disease_category 为 "一般轻症" 时，拒绝');
    expect(gloss).toContain('；'); // 行间分隔
  });

  it('注入 fieldNames 显示中文 display_name', () => {
    const gloss = renderDecisionTableGloss(table, 'zh', { disease_category: '疾病类别' });
    expect(gloss).toContain('当 疾病类别 为 "罕见重疾" 时，放行');
    expect(gloss).not.toContain('disease_category 为');
  });

  it('英文渲染', () => {
    const gloss = renderDecisionTableGloss(table, 'en');
    expect(gloss).toContain('When disease_category is "罕见重疾", allow');
  });
});
