import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOME_ENV, RULES_DIR_ENV } from '../src/config.js';
import { createMcpDeps } from '../src/mcp/server.js';

describe('createMcpDeps — wired to CORE (rules + audit persistence)', () => {
  let home: string;
  const savedHome = process.env[HOME_ENV];
  const savedRules = process.env[RULES_DIR_ENV];

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'rulsynor-mcp-'));
    process.env[HOME_ENV] = home;
    delete process.env[RULES_DIR_ENV];
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env[HOME_ENV];
    else process.env[HOME_ENV] = savedHome;
    if (savedRules === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = savedRules;
    rmSync(home, { recursive: true, force: true });
  });

  it('evaluates guarded tool calls and persists audit records read-only', () => {
    const deps = createMcpDeps();
    try {
      const rules = deps.listRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => typeof r.name === 'string')).toBe(true);

      const deny = deps.evaluate('exec', { command: 'rm -rf /' });
      expect(deny.decision).toBe('DENY');
      expect(deny.hash).toMatch(/^sha256:/);

      const allow = deps.evaluate('read_file', { path: 'README.md' });
      expect(allow.decision).toBe('ALLOW');

      const recent = deps.recentAudit(10);
      expect(recent.length).toBe(2);
      expect(recent[0].toolName).toBe('read_file');
    } finally {
      deps.close();
    }
  });

  it('threads business context into context.* rule evaluation', () => {
    const deps = createMcpDeps();
    try {
      const halt = deps.evaluate('exec', { command: 'ls' }, { event_type: 'credential_leak' });
      expect(halt.decision).toBe('EMERGENCY_HALT');

      const maintenance = deps.evaluate('exec', { command: 'ls' }, { maintenance_mode: true });
      expect(maintenance.decision).toBe('DENY');

      const silent = deps.evaluate('exec', { command: 'ls' });
      expect(silent.decision).toBe('ALLOW');
    } finally {
      deps.close();
    }
  });
});
