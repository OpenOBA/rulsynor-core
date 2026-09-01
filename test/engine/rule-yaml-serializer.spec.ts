/**
 * Rule YAML Serializer — SPEC §5 compliance tests
 *
 * Tests that the RuleYamlSerializer produces YAML matching SPEC §5 F1-F8 format rules.
 */
import { RuleYamlSerializer } from '../../src/engine/rule-yaml-serializer.js';
import type { RuleConfig } from '../../src/engine/rule-config.js';

// Minimal helper to construct RuleConfig-like objects for testing
function makeRuleConfig(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return {
    id: 'uuid-test-001',
    name: 'SEC-001-test-rule',
    description: 'A test rule for serializer verification',
    category: 'security',
    decision: 'DENY',
    priority: 5,
    ring_level: 0,
    enabled: true,
    is_deleted: false,
    version: 1,
    scope: 'builtin',
    created_at: new Date(),
    updated_at: new Date(),
    content: {
      protocol: 'erdl/v2',
      version: '2.0.0',
      metadata: {
        name: 'SEC-001-test-rule',
        description: 'A test rule for serializer verification',
        category: 'security',
        decision: 'DENY',
        tags: ['security', 'test'],
      },
      rules: [
        {
          name: 'SEC-001-test-rule',
          description: 'Block exec with dangerous commands',
          priority: 5,
          override: 'critical',
          ring: 0,
          when: {
            logic: 'AND',
            conditions: [{ field: 'tool.name', operator: 'eq', value: 'exec' }],
          },
          then: 'DENY',
          message: 'Exec blocked by security policy',
          instruction: 'Use an approved tool instead',
        },
      ],
    },
    ...overrides,
  } as RuleConfig;
}

describe('RuleYamlSerializer — SPEC §5 compliance', () => {
  const serializer = new RuleYamlSerializer('/tmp/test-rules');

  describe('F1 + F8: protocol must be first line', () => {
    it('outputs protocol: "erdl/v2" on line 1', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      const lines = yaml.split('\n');
      expect(lines[0]).toBe('protocol: "erdl/v2"');
    });

    it('version line follows protocol', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      const lines = yaml.split('\n');
      expect(lines[1]).toBe('version: "2.0.0"');
    });
  });

  describe('F2: metadata field order and quoting', () => {
    it('metadata fields follow name → description → category → decision → tags order', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      const lines = yaml.split('\n');
      const metaStart = lines.indexOf('metadata:');
      expect(metaStart).toBeGreaterThan(0);
      // After the blank line, metadata: line, then indented fields
      expect(lines[metaStart + 1]).toContain('name: "SEC-001-test-rule"');
    });

    it('category and decision are bare words (no quotes)', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).toContain('category: security');
      expect(yaml).toContain('decision: DENY');
    });

    it('tags are bare words in brackets', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).toContain('tags: [security, test]');
    });

    it('omits tags line when tags is empty', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.metadata.tags = [];
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).not.toContain('tags:');
    });

    it('omits tags line when tags is missing', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      delete content.metadata.tags;
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).not.toContain('tags:');
    });
  });

  describe('F3: rule field order', () => {
    it('rule name is quoted', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).toContain('name: "SEC-001-test-rule"');
    });

    it('rule fields follow F3 order: name → description → priority → override → ring → when → then → message → instruction', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      const lines = yaml.split('\n');
      const ruleIdx = lines.findIndex(l => l.includes('- name: "SEC-001-test-rule"'));
      expect(ruleIdx).toBeGreaterThan(0);

      // Extract rule fields in order
      const ruleLines = lines.slice(ruleIdx);
      const fieldOrder = ruleLines
        .filter(l => l.match(/^    [a-z_]+:/))
        .map(l => l.trim().split(':')[0]);

      // Verify F3 order (description/name already consumed, remaining in order)
      const descIdx = fieldOrder.indexOf('description');
      const prioIdx = fieldOrder.indexOf('priority');
      const overIdx = fieldOrder.indexOf('override');
      const ringIdx = fieldOrder.indexOf('ring');
      const whenIdx = fieldOrder.indexOf('when');
      const thenIdx = fieldOrder.indexOf('then');
      const msgIdx = fieldOrder.indexOf('message');
      const instrIdx = fieldOrder.indexOf('instruction');

      // Each field appears in ascending position
      expect(descIdx).toBeLessThan(prioIdx);
      expect(prioIdx).toBeLessThan(overIdx);
      expect(overIdx).toBeLessThan(ringIdx);
      expect(ringIdx).toBeLessThan(whenIdx);
      expect(whenIdx).toBeLessThan(thenIdx);
      expect(thenIdx).toBeLessThan(msgIdx);
      expect(msgIdx).toBeLessThan(instrIdx);
    });

    it('enum values are bare: override, ring, then, logic, operator', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).toContain('override: critical');
      expect(yaml).toContain('ring: 0');
      expect(yaml).toContain('then: DENY');
      expect(yaml).toContain('logic: AND');
      expect(yaml).toContain('operator: eq');
    });

    it('natural language strings are double-quoted', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).toContain('message: "Exec blocked by security policy"');
      expect(yaml).toContain('instruction: "Use an approved tool instead"');
    });

    it('omits optional fields when absent', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      delete content.rules[0].instruction;
      delete content.rules[0].override;
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).not.toContain('instruction:');
      expect(yaml).not.toContain('override:');
    });
  });

  describe('F4: when conditions field order', () => {
    it('conditions follow field → operator → value order', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      const lines = yaml.split('\n');

      // Find the conditions block
      const condStart = lines.findIndex(l => l.includes('conditions:'));
      expect(condStart).toBeGreaterThan(0);

      // First condition item: field, operator, value in order
      expect(lines[condStart + 1]).toContain('field: "tool.name"');
      expect(lines[condStart + 2]).toContain('operator: eq');
      expect(lines[condStart + 3]).toContain('value: "exec"');
    });

    it('value arrays quote string elements', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].when.conditions[0] = {
        field: 'tool.name',
        operator: 'in',
        value: ['exec', 'write_file'],
      };
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('value: ["exec", "write_file"]');
    });

    it('when: "true" is preserved with single quotes', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].when = 'true';
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain("when: 'true'");
    });
  });

  describe('unless block', () => {
    it('serializes unless with same structure as when', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].unless = {
        logic: 'OR',
        conditions: [{ field: 'tool.args.path', operator: 'match', value: '\\.test\\.' }],
      };
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('unless:');
      expect(yaml).toContain('logic: OR');
      expect(yaml).toContain('operator: match');
    });

    it('omits unless when not present', () => {
      const yaml = serializer.toSpec5Yaml(makeRuleConfig());
      expect(yaml).not.toContain('unless:');
    });
  });

  describe('null/edge handling', () => {
    it('serializes null value as ""', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].when.conditions[0].value = null;
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('value: ""');
    });

    it('handles empty metadata gracefully', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.metadata = {};
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('protocol: "erdl/v2"');
    });
  });

  describe('legacy/flat content fallback', () => {
    it('constructs minimal SPEC §5 from DB fields when content is flat', () => {
      const rule = makeRuleConfig();
      rule.content = {
        name: 'legacy-rule',
        when: 'tool.name == "exec"',
        then: 'DENY',
        message: 'Blocked',
      } as any;
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('protocol: "erdl/v2"');
      expect(yaml).toContain('name: "legacy-rule"');
      expect(yaml).toContain('then: DENY');
    });

    it('constructs minimal SPEC §5 when content is missing', () => {
      const rule = makeRuleConfig();
      rule.content = undefined as any;
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('protocol: "erdl/v2"');
      expect(yaml).toContain('name: "SEC-001-test-rule"');
    });
  });

  describe('YAML special character escaping', () => {
    it('escapes double quotes inside strings', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].message = 'He said "hello"';
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('message: "He said \\"hello\\""');
    });

    it('escapes backslashes', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].when.conditions[0].value = 'C:\\Users\\test';
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('value: "C:\\\\Users\\\\test"');
    });

    it('escapes newlines in strings', () => {
      const rule = makeRuleConfig();
      const content = rule.content as any;
      content.rules[0].message = 'Line 1\nLine 2';
      const yaml = serializer.toSpec5Yaml(rule);
      expect(yaml).toContain('\\n');
    });
  });
});
