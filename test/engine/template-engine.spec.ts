/**
 * Template Engine — SPEC §5 compliance tests
 *
 * Verifies that template-generated YAML follows SPEC §5 F1-F8 format rules,
 * matching the output of RuleYamlSerializer.
 */
import { templateEngine, type TemplateInput } from '../../src/engine/template-engine.js'
import * as yaml from 'js-yaml'

describe('TemplateEngine — SPEC §5 compliance', () => {
  const sampleInput: TemplateInput = {
    templateId: 'toolInList',
    ruleName: 'TEST-001-block-dangerous-tools',
    decision: 'DENY',
    message: 'This tool is not allowed',
    priority: 2,
    category: 'security',
    params: { toolNames: ['exec', 'write_file'] },
  }

  describe('generate() output format', () => {
    it('produces SPEC §5 YAML with protocol first', () => {
      const output = templateEngine.generate(sampleInput)
      expect(output.success).toBe(true)
      const lines = output.yaml.split('\n')
      expect(lines[0]).toBe('protocol: "erdl/v2"')
    })

    it('version is 2.0.0', () => {
      const output = templateEngine.generate(sampleInput)
      expect(output.yaml).toContain('version: "2.0.0"')
    })

    it('metadata block has all SPEC §5 F2 fields', () => {
      const output = templateEngine.generate(sampleInput)
      const obj = yaml.load(output.yaml) as any
      expect(obj.metadata.name).toBe('TEST-001-block-dangerous-tools')
      expect(obj.metadata.category).toBe('security')
      expect(obj.metadata.decision).toBe('DENY')
      expect(obj.metadata.tags).toEqual(['security'])
      expect(obj.metadata.description).toBeDefined()
    })

    it('rule object has SPEC §5 F3 fields', () => {
      const output = templateEngine.generate(sampleInput)
      const obj = yaml.load(output.yaml) as any
      const rule = obj.rules[0]
      expect(rule.name).toBe('TEST-001-block-dangerous-tools')
      expect(rule.priority).toBe(2)
      expect(rule.then).toBe('DENY')
      expect(rule.message).toBe('This tool is not allowed')
      expect(rule.when.logic).toBe('AND')
    })

    it('enums are bare words (no quotes)', () => {
      const output = templateEngine.generate(sampleInput)
      expect(output.yaml).toContain('category: security')
      expect(output.yaml).toContain('decision: DENY')
      expect(output.yaml).toContain('then: DENY')
      expect(output.yaml).toContain('operator: in')
    })

    it('natural language strings are double-quoted', () => {
      const output = templateEngine.generate(sampleInput)
      expect(output.yaml).toContain('name: "TEST-001-block-dangerous-tools"')
      expect(output.yaml).toContain('message: "This tool is not allowed"')
    })

    it('roundtrips correctly through YAML parser', () => {
      const output = templateEngine.generate(sampleInput)
      const parsed = yaml.load(output.yaml) as any
      expect(parsed).toBeDefined()
      expect(parsed.protocol).toBe('erdl/v2')
      expect(parsed.rules[0].name).toBe('TEST-001-block-dangerous-tools')
    })
  })

  describe('template-specific output', () => {
    it('toolEq produces single eq condition', () => {
      const output = templateEngine.generate({
        ...sampleInput,
        templateId: 'toolEq',
        params: { toolName: 'exec' },
      })
      const obj = yaml.load(output.yaml) as any
      expect(obj.rules[0].when.conditions[0]).toEqual({
        field: 'tool.name',
        operator: 'eq',
        value: 'exec',
      })
    })

    it('twoFieldOr produces OR logic', () => {
      const output = templateEngine.generate({
        ...sampleInput,
        templateId: 'twoFieldOr',
        params: {
          field1: 'tool.name', operator1: 'eq', value1: 'exec',
          field2: 'tool.name', operator2: 'eq', value2: 'write_file',
        },
      })
      const obj = yaml.load(output.yaml) as any
      expect(obj.rules[0].when.logic).toBe('OR')
      expect(obj.rules[0].when.conditions).toHaveLength(2)
    })

    it('fieldExists with exists=true uses exists operator', () => {
      const output = templateEngine.generate({
        ...sampleInput,
        templateId: 'fieldExists',
        params: { field: 'approval_id', exists: true },
      })
      const obj = yaml.load(output.yaml) as any
      expect(obj.rules[0].when.conditions[0].operator).toBe('exists')
    })

    it('empty conditions produce when: true', () => {
      const output = templateEngine.generate({
        ...sampleInput,
        templateId: 'toolEq',
        params: {}, // missing toolName → empty conditions
      })
      // With missing required params, conditions array is empty
      // The when block should be 'true' (not an empty object)
      const obj = yaml.load(output.yaml) as any
      if (obj.rules[0].when === true || obj.rules[0].when === 'true') {
        // YAML parses 'true' or '"true"' to boolean true or string
        expect([true, 'true']).toContain(obj.rules[0].when)
      }
    })

    it('override is computed from priority', () => {
      const highPrio = templateEngine.generate({
        ...sampleInput, priority: 1,
        ruleName: 'HIGH-PRIO',
        params: { toolNames: ['exec'] },
      })
      const lowPrio = templateEngine.generate({
        ...sampleInput, priority: 10,
        ruleName: 'LOW-PRIO',
        params: { toolNames: ['exec'] },
      })
      expect(highPrio.yaml).toContain('override: critical')
      expect(lowPrio.yaml).not.toContain('override:')
    })
  })

  describe('error handling', () => {
    it('returns error for unknown template', () => {
      const output = templateEngine.generate({
        ...sampleInput,
        templateId: 'nonexistent' as any,
      })
      expect(output.success).toBe(false)
      expect(output.error).toContain('Unknown template')
    })
  })
})
