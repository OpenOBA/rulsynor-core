/**
 * plan-parser.test.ts — PlanParser unit tests
 */
import { PlanParser } from '../src/engine/plan-parser.js';

describe('PlanParser', () => {
  let p: PlanParser;

  beforeEach(() => {
    p = new PlanParser();
  });

  describe('hasRecognizablePlan', () => {
    it('detects English PLAN marker', () => {
      expect(p.hasRecognizablePlan('PLAN:\nStep 1: do something')).toBe(true);
    });

    it('detects Chinese 计划 marker', () => {
      expect(p.hasRecognizablePlan('计划：\n步骤1: 做某事')).toBe(true);
    });

    it('detects 执行方案 marker', () => {
      expect(p.hasRecognizablePlan('执行方案：\n1. read file\n2. modify')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(p.hasRecognizablePlan('just some random text')).toBe(false);
    });
  });

  describe('parse', () => {
    it('returns hasPlan=false for empty input', () => {
      const result = p.parse('');
      expect(result.hasPlan).toBe(false);
      expect(result.steps).toHaveLength(0);
    });

    it('returns hasPlan=false for non-plan text', () => {
      const result = p.parse('hello world');
      expect(result.hasPlan).toBe(false);
      expect(result.steps).toHaveLength(0);
    });

    it('returns hasPlan=true for valid PLAN', () => {
      const result = p.parse('PLAN:\n步骤1: read the config file');
      expect(result.hasPlan).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('extracts step descriptions', () => {
      const result = p.parse(
        'PLAN:\n步骤1: read config file | 工具: read | 操作: READ | 目的: load settings'
      );
      expect(result.steps[0].description).toContain('read config file');
      expect(result.steps[0].opSem).toBe('OP_READ');
      expect(result.steps[0].purpose).toBe('load settings');
    });

    it('extracts goal field', () => {
      const result = p.parse(
        '目标: deploy the application\nPLAN:\n步骤1: npm install\n步骤2: npm run build'
      );
      expect(result.goal).toBe('deploy the application');
    });

    it('extracts success criteria', () => {
      const result = p.parse(
        'PLAN:\n步骤1: test\n成功标准: all tests pass'
      );
      expect(result.successCriteria).toBe('all tests pass');
    });

    it('extracts estimated rounds', () => {
      const result = p.parse(
        'PLAN:\n步骤1: do work\n预计轮次: 3'
      );
      expect(result.estimatedRounds).toBe(3);
    });

    it('extracts risk level', () => {
      const result = p.parse(
        'PLAN:\n步骤1: dangerous op\n风险: high'
      );
      expect(result.riskLevel).toBe('high');
    });

    it('extracts alternatives', () => {
      const result = p.parse(
        'PLAN:\n步骤1: do it\n替代方案: use a different tool'
      );
      expect(result.alternatives).toBe('use a different tool');
    });

    it('handles Step N: format (English)', () => {
      const result = p.parse(
        'PLAN:\nStep 1: read file | Tools: cat | Operation: READ | Purpose: inspect'
      );
      expect(result.steps[0].index).toBe(1);
      expect(result.steps[0].tools).toEqual(['cat']);
      expect(result.steps[0].opSem).toBe('OP_READ');
    });

    it('handles numbered format', () => {
      const result = p.parse(
        'PLAN:\n1. write file\n2. test\n3. deploy'
      );
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].index).toBe(1);
      expect(result.steps[2].index).toBe(3);
    });

    it('handles multi-tool steps', () => {
      const result = p.parse(
        'PLAN:\n步骤1: setup | 工具: npm, node, git | 操作: EXEC | 目的: prepare'
      );
      expect(result.steps[0].tools).toEqual(['npm', 'node', 'git']);
    });

    it('extracts multiple steps in order', () => {
      const result = p.parse(
        'PLAN:\n步骤1: read | 工具: cat | 操作: READ | 目的: check\n步骤2: modify | 工具: sed | 操作: WRITE | 目的: fix\n步骤3: verify | 工具: test | 操作: EXEC | 目的: confirm'
      );
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].opSem).toBe('OP_READ');
      expect(result.steps[1].opSem).toBe('OP_WRITE');
      expect(result.steps[2].opSem).toBe('OP_EXEC');
    });

    it('skips metadata lines but still parses formatted steps', () => {
      // Metadata (目标/成功标准/预计) comes first, then PLAN with steps
      const text = '目标: deploy\n成功标准: live\n预计轮次: 2\nPLAN:\n步骤1: build | 工具: npm | 操作: EXEC | 目的: compile';
      const result = p.parse(text);
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
      expect(result.goal).toBe('deploy');
    });
  });

  describe('normalizeOpSem', () => {
    // Test through parse()
    it('normalizes Chinese READ', () => {
      const r = p.parse('PLAN:\n步骤1: test | 操作: 读取 | 目的: check');
      expect(r.steps[0].opSem).toBe('OP_READ');
    });

    it('normalizes Chinese WRITE', () => {
      const r = p.parse('PLAN:\n步骤1: test | 操作: 写 | 目的: modify');
      expect(r.steps[0].opSem).toBe('OP_WRITE');
    });

    it('normalizes Chinese DELETE', () => {
      const r = p.parse('PLAN:\n步骤1: test | 操作: 删除 | 目的: cleanup');
      expect(r.steps[0].opSem).toBe('OP_DELETE');
    });

    it('normalizes Chinese EXEC', () => {
      const r = p.parse('PLAN:\n步骤1: test | 操作: 执行 | 目的: run');
      expect(r.steps[0].opSem).toBe('OP_EXEC');
    });
  });
});
