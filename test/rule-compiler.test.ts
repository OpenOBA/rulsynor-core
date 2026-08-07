/**
 * rule-compiler.test.ts — RuleCompilerImpl unit tests
 */
import { RuleCompilerImpl } from '../src/engine/rule-compiler.js';

describe('RuleCompilerImpl', () => {
  let compiler: RuleCompilerImpl;

  beforeEach(() => {
    compiler = new RuleCompilerImpl();
  });

  describe('compile', () => {
    it('compiles empty rule set', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: {},
        rules: [],
      });
      expect(result.id).toBeTruthy();
      expect(result.sourceHash).toBeTruthy();
      expect(result.guardDirectives).toHaveLength(0);
      expect(result.qualityGateAlerts).toBeDefined();
    });

    it('compiles single DENY rule', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001-block-exec',
            name: 'SEC-001-block-exec',
            description: 'Block dangerous exec commands',
            category: 'security',
            priority: 100,
            ring: 0,
            when: {
              logic: 'AND',
              conditions: [
                { field: 'tool.name', operator: 'eq', value: 'exec' },
                { field: 'tool.args.command', operator: 'match', value: '(rm|shutdown|reboot)' },
              ],
            },
            then: 'DENY',
            message: 'Destructive command blocked.',
            enabled: true,
          },
        ],
      });

      expect(result.guardDirectives).toHaveLength(1);
      expect(result.guardDirectives[0].toolDecisionTree).toBeDefined();
      // DENY rule on exec with rm match
      const ctx = { 'tool.name': 'exec', 'tool.args': { command: 'rm -rf /' } };
      const decision = result.guardDirectives[0].toolDecisionTree.traverse(ctx);
      expect(decision).toBe('DENY');
    });

    it('ALLOW rule on safe tool', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'COD-001-allow-read',
            name: 'COD-001-allow-read',
            description: 'Allow read_file',
            category: 'convention',
            priority: 10,
            ring: 3,
            when: {
              logic: 'AND',
              conditions: [
                { field: 'tool.name', operator: 'eq', value: 'read_file' },
              ],
            },
            then: 'ALLOW',
            message: 'Read-only operation allowed.',
            enabled: true,
          },
        ],
      });

      const ctx = { 'tool.name': 'read_file', 'tool.args': {} };
      const decision = result.guardDirectives[0].toolDecisionTree.traverse(ctx);
      expect(decision).toBe('ALLOW');

      const ctx2 = { 'tool.name': 'write_file', 'tool.args': {} };
      const decision2 = result.guardDirectives[0].toolDecisionTree.traverse(ctx2);
      expect(decision2).toBe('ALLOW'); // default
    });

    it('generates four parallel products', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001',
            name: 'SEC-001',
            description: 'Test rule',
            category: 'security',
            priority: 100,
            ring: 0,
            when: {
              logic: 'AND',
              conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
            },
            then: 'DENY',
            message: 'Blocked.',
            enabled: true,
          },
        ],
      });

      expect(result.complianceSchema).toBeDefined();
      expect(result.guidanceArtifacts.length).toBeGreaterThan(0);
      expect(result.guardDirectives.length).toBeGreaterThan(0);
      expect(result.auditTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('verifyDFA', () => {
    it('DFA verification passes for simple rule set', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001', name: 'SEC-001', description: 'Block exec',
            category: 'security', priority: 100, ring: 0,
            when: {
              logic: 'AND',
              conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
            },
            then: 'DENY', message: 'Blocked.', enabled: true,
          },
        ],
      });

      const dfa = result.guardDirectives[0].meta.dfaVerification;
      expect(dfa.status).toBe('verified');
      expect(dfa.simulatedStates).toBeGreaterThan(0);
    });
  });

  describe('quality gates', () => {
    it('detects security rule with no conditions', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001', name: 'SEC-001', description: 'Empty',
            category: 'security', priority: 100, ring: 0,
            then: 'DENY', message: 'Blocked.', enabled: true,
          },
        ],
      });

      const noCond = result.qualityGateAlerts!.filter(a => a.gate === 'no-condition-on-security-rule');
      expect(noCond.length).toBeGreaterThan(0);
    });

    it('detects non-standard name', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'bad-name', name: 'bad-name', description: 'Bad name',
            category: 'security', priority: 100, ring: 0,
            when: {
              logic: 'AND',
              conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
            },
            then: 'DENY', message: 'Blocked.', enabled: true,
          },
        ],
      });

      const nameAlerts = result.qualityGateAlerts!.filter(a => a.gate === 'non-standard-name');
      expect(nameAlerts.length).toBeGreaterThan(0);
    });

    it('passes quality gate for well-formed rule', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001-allow-read',
            name: 'SEC-001-allow-read',
            description: 'Well-formed rule',
            category: 'security', priority: 100, ring: 0,
            when: {
              logic: 'AND',
              conditions: [{ field: 'tool.name', operator: 'eq', value: 'read_file' }],
            },
            then: 'DENY', message: 'Blocked.', enabled: true,
          },
        ],
      });

      const blockLevel = result.qualityGateAlerts!.filter(a => a.level === 'error');
      expect(blockLevel.length).toBe(0);
    });
  });

  describe('runGoldenTests', () => {
    it('all golden tests pass', () => {
      const report = compiler.runGoldenTests();
      expect(report.failed).toBe(0);
      expect(report.passed).toBe(report.total);
    });
  });

  describe('guidance artifacts', () => {
    it('generates guidance for blocking rule', () => {
      const result = compiler.compile({
        protocol: 'erdl/v1',
        version: '1.0',
        metadata: { name: 'test' },
        rules: [
          {
            id: 'SEC-001', name: 'SEC-001', description: 'Block destructive ops',
            category: 'security', priority: 100, ring: 0,
            when: {
              logic: 'AND',
              conditions: [{ field: 'tool.name', operator: 'in', value: ['exec', 'write_file'] }],
            },
            then: 'DENY', message: 'Dangerous operation blocked.',
            enabled: true,
          },
        ],
      });

      expect(result.guidanceArtifacts.length).toBe(1);
      expect(result.guidanceArtifacts[0].ruleId).toBe('SEC-001');
      expect(result.guidanceArtifacts[0].riskProfile.category).toBe('security');
    });
  });
});
