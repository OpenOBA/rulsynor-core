import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOME_ENV, RULES_DIR_ENV } from '../src/config.js';
import { Store } from '../src/storage/index.js';
import { runRules } from '../src/cli/rules.js';
import { runAudit } from '../src/cli/audit.js';
import { runSetup } from '../src/cli/setup.js';
import { buildTools } from '../src/cli/chat.js';

describe('CLI commands', () => {
  let home: string;
  let rulesDir: string;
  const savedHome = process.env[HOME_ENV];
  const savedRules = process.env[RULES_DIR_ENV];

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'rulsynor-cli-'));
    rulesDir = join(home, 'rules');
    mkdirSync(rulesDir);
    process.env[HOME_ENV] = home;
    process.env[RULES_DIR_ENV] = rulesDir;
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env[HOME_ENV];
    else process.env[HOME_ENV] = savedHome;
    if (savedRules === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = savedRules;
    rmSync(home, { recursive: true, force: true });
  });

  it('rules list shows user-authored rules', async () => {
    writeFileSync(
      join(rulesDir, 'cus.erdl.yaml'),
      [
        'name: CUS-001-x',
        'version: 1',
        'category: custom',
        'ring: 0',
        'priority: 900',
        'when:',
        '  conditions:',
        '    - field: tool.name',
        '      operator: eq',
        '      value: exec',
        '  conditionLogic: AND',
        'then:',
        '  decision: DENY',
        '  instruction: blocked',
        '',
      ].join('\n'),
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    let output = '';
    try {
      await runRules(['list']);
      output = log.mock.calls.map(c => c.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }
    expect(output).toContain('CUS-001-x');
    expect(output).toContain('Quality gate');
  });

  it('audit list + show are read-only views over the local DB', async () => {
    const dbPath = join(home, 'rulsynor.db');
    const store = new Store(dbPath);
    store.recordAudit({
      sessionId: 's',
      agentId: 'a',
      step: 0,
      toolName: 'exec',
      decision: 'DENY',
      hash: 'sha256:abc123',
      previousHash: null,
      decisionObject: { spec: 'decision-object-v1.5', result: { decision: 'DENY' } },
    });
    store.close();

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    let output = '';
    try {
      await runAudit(['list']);
      await runAudit(['show', 'sha256:abc']);
      output = log.mock.calls.map(c => c.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }
    expect(output).toContain('DENY');
    expect(output).toContain('decision-object-v1.5');
    expect(output).toContain('read-only');
  });

  it('setup persists model config non-interactively (no API key stored)', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await runSetup(['--model', 'qwen-test', '--base-url', 'https://x.example/v1']);
    } finally {
      log.mockRestore();
    }
    const store = new Store(join(home, 'rulsynor.db'));
    expect(store.getModelConfig().modelName).toBe('qwen-test');
    expect(store.getModelConfig().baseUrl).toBe('https://x.example/v1');
    store.close();
  });

  it('built-in tools: read_file / list_dir / exec work', async () => {
    writeFileSync(join(home, 'f.txt'), 'hello content');
    const tools = buildTools();

    const read = await tools.read_file.execute({ path: join(home, 'f.txt') });
    expect(read).toContain('hello content');

    const missing = await tools.read_file.execute({ path: join(home, 'nope.txt') });
    expect(missing).toContain('error:');

    const listing = await tools.list_dir.execute({ path: home });
    expect(listing).toContain('f.txt');

    const exec = await tools.exec.execute({ command: 'echo hello123' });
    expect(exec).toContain('hello123');
  });
});
