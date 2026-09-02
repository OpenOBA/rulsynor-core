import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRulesFromDir, toCompiledRules } from '../src/rules/index.js';

describe('loadRulesFromDir — user-authored rules', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rulsynor-user-rules-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads single- and multi-document *.erdl.yaml files', () => {
    writeFileSync(
      join(dir, 'single.erdl.yaml'),
      [
        'name: user-block-rm',
        'version: 1',
        'category: security',
        'ring: 0',
        'priority: 900',
        'when:',
        '  conditions:',
        '    - field: "toolName"',
        '      operator: eq',
        '      value: "exec"',
        '  conditionLogic: AND',
        'then:',
        '  decision: DENY',
        '  instruction: "blocked by user rule"',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, 'multi.erdl.yaml'),
      [
        'name: user-a',
        'category: security',
        'ring: 1',
        'when:',
        '  conditions:',
        '    - field: "toolName"',
        '      operator: eq',
        '      value: "a"',
        'then:',
        '  decision: DENY',
        '  instruction: "a"',
        '---',
        'name: user-b',
        'category: security',
        'ring: 1',
        'when:',
        '  conditions:',
        '    - field: "toolName"',
        '      operator: eq',
        '      value: "b"',
        'then:',
        '  decision: DENY',
        '  instruction: "b"',
        '',
      ].join('\n'),
    );
    writeFileSync(join(dir, 'ignored.txt'), 'not a rule');

    const rules = loadRulesFromDir(dir);
    expect(rules).toHaveLength(3);
    const names = rules.map(r => r.name).sort();
    expect(names).toEqual([
      'multi.erdl.yaml#user-a',
      'multi.erdl.yaml#user-b',
      'single.erdl.yaml#user-block-rm',
    ]);
  });

  it('user rules compile through the same quality gate as presets', () => {
    writeFileSync(
      join(dir, 'ok.erdl.yaml'),
      [
        'name: SEC-900-user-ok',
        'version: 1',
        'category: security',
        'severity: high',
        'ring: 0',
        'priority: 900',
        'description: "user-authored test rule"',
        'when:',
        '  conditions:',
        '    - field: "toolName"',
        '      operator: eq',
        '      value: "exec"',
        '  conditionLogic: AND',
        'then:',
        '  decision: DENY',
        '  instruction: "user rule"',
        '',
      ].join('\n'),
    );
    const compiled = toCompiledRules(loadRulesFromDir(dir));
    expect(compiled).toHaveLength(1);
    expect(compiled[0].name).toBe('SEC-900-user-ok');
    expect(compiled[0].action.decision).toBe('DENY');
  });

  it('returns an empty array for a directory without rule files', () => {
    expect(loadRulesFromDir(dir)).toEqual([]);
  });
});
