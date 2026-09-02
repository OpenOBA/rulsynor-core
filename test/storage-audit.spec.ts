import { Store } from '../src/storage/index.js';

describe('Store — audit records (write + read-only view)', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  const entry = (hash: string) => ({
    sessionId: 's1',
    agentId: 'a1',
    step: 0,
    toolName: 'exec',
    decision: 'DENY',
    hash,
    previousHash: null,
    decisionObject: { spec: 'decision-object-v1.5', audit: { hash } },
  });

  it('records and lists audit entries newest-first', () => {
    store.recordAudit(entry('sha256:aaa'));
    store.recordAudit({ ...entry('sha256:bbb'), previousHash: 'sha256:aaa', decision: 'ALLOW' });
    const rows = store.listAudit(10);
    expect(rows).toHaveLength(2);
    expect(rows[0].hash).toBe('sha256:bbb');
    expect(rows[0].previousHash).toBe('sha256:aaa');
    expect(rows[1].hash).toBe('sha256:aaa');
    expect(rows[0].doJson).toContain('decision-object-v1.5');
  });

  it('rejects duplicate hashes idempotently', () => {
    const first = store.recordAudit(entry('sha256:dup'));
    const second = store.recordAudit(entry('sha256:dup'));
    expect(store.countAudit()).toBe(1);
    expect(second.hash).toBe(first.hash);
  });

  it('finds a record by exact hash and unique prefix', () => {
    store.recordAudit(entry('sha256:abcdef1111'));
    store.recordAudit(entry('sha256:zzzzzz2222'));
    expect(store.getAuditByHash('sha256:abcdef1111')?.decision).toBe('DENY');
    expect(store.getAuditByHashPrefix('sha256:abc')?.hash).toBe('sha256:abcdef1111');
    expect(store.getAuditByHashPrefix('sha256:zzz')?.hash).toBe('sha256:zzzzzz2222');
  });

  it('returns undefined for empty, missing or ambiguous prefixes', () => {
    store.recordAudit(entry('sha256:aa11'));
    store.recordAudit(entry('sha256:aa22'));
    expect(store.getAuditByHashPrefix('')).toBeUndefined();
    expect(store.getAuditByHashPrefix('sha256:missing')).toBeUndefined();
    expect(store.getAuditByHashPrefix('sha256:aa')).toBeUndefined();
  });

  it('clamps list limits to a sane range', () => {
    for (let i = 0; i < 5; i++) store.recordAudit(entry(`sha256:${i}`));
    expect(store.listAudit(0)).toHaveLength(1); // 0 clamps up to the minimum of 1
    expect(store.listAudit(2)).toHaveLength(2);
    expect(store.listAudit(1000)).toHaveLength(5);
  });
});
