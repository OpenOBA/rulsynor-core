import { Store } from '../src/storage/index.js';

describe('Store (node:sqlite)', () => {
  it('rule CRUD + model config roundtrip', () => {
    const s = new Store(':memory:');
    s.createRule({
      id: 'r1',
      name: 'my-rule',
      category: 'security',
      priority: 10,
      conditions: [{ field: 'context.operation', operator: 'eq', value: 'delete' }],
      action: { decision: 'DENY' },
    });
    expect(s.countRules()).toBe(1);
    expect(s.getRule('r1')?.name).toBe('my-rule');

    s.setModelConfig({ modelName: 'm', baseUrl: 'https://x.example.com' });
    expect(s.getModelConfig()).toEqual({ modelName: 'm', baseUrl: 'https://x.example.com' });

    s.updateRule('r1', { enabled: false });
    expect(s.getRule('r1')?.enabled).toBe(false);

    expect(s.deleteRule('r1')).toBe(true);
    expect(s.countRules()).toBe(0);
    s.close();
  });
});
