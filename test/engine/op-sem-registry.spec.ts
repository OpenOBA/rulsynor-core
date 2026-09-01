/**
 * OpSemRegistry — Unit Tests
 *
 * @author 唐浩然 · 2026-07-21
 */

import { OpSemRegistry } from '../../src/engine/op-sem-registry.js'
import * as path from 'node:path'

const YAML_PATH = path.resolve(__dirname, '../../src/engine/op-sem-registry.yaml')

describe('OpSemRegistry', () => {
  let registry: OpSemRegistry

  beforeAll(() => {
    registry = new OpSemRegistry()
    registry.load(YAML_PATH)
  })

  it('应成功加载 YAML', () => {
    expect(registry.isLoaded).toBe(true)
  })

  // ── 直接工具映射 ──

  describe('direct tool_map mapping', () => {
    it('read_file → OP_READ', () => {
      const r = registry.classify('read_file', {})
      expect(r.code).toBe('OP_READ')
      expect(r.risk).toBe('low')
    })

    it('write_file → OP_WRITE', () => {
      const r = registry.classify('write_file', {})
      expect(r.code).toBe('OP_WRITE')
      expect(r.risk).toBe('medium')
    })

    it('edit → OP_WRITE', () => {
      const r = registry.classify('edit', {})
      expect(r.code).toBe('OP_WRITE')
    })

    it('apply_patch → OP_WRITE', () => {
      const r = registry.classify('apply_patch', {})
      expect(r.code).toBe('OP_WRITE')
    })

    it('glob → OP_READ', () => {
      const r = registry.classify('glob', {})
      expect(r.code).toBe('OP_READ')
    })

    it('grep → OP_READ', () => {
      const r = registry.classify('grep', {})
      expect(r.code).toBe('OP_READ')
    })

    it('list_dir → OP_READ', () => {
      const r = registry.classify('list_dir', {})
      expect(r.code).toBe('OP_READ')
    })

    it('web_search → OP_NETWORK', () => {
      const r = registry.classify('web_search', {})
      expect(r.code).toBe('OP_NETWORK')
    })

    it('web_fetch → OP_NETWORK', () => {
      const r = registry.classify('web_fetch', {})
      expect(r.code).toBe('OP_NETWORK')
    })

    it('recall → OP_MEMORY', () => {
      const r = registry.classify('recall', {})
      expect(r.code).toBe('OP_MEMORY')
    })

    it('remember → OP_MEMORY', () => {
      const r = registry.classify('remember', {})
      expect(r.code).toBe('OP_MEMORY')
    })

    it('forget → OP_MEMORY', () => {
      const r = registry.classify('forget', {})
      expect(r.code).toBe('OP_MEMORY')
    })
  })

  // ── exec 命令子分类 ──

  describe('exec command sub-classification', () => {
    const exec = (cmd: string) => registry.classify('exec', { command: cmd })

    it('git log → VCS_READ, low risk', () => {
      const r = exec('git log')
      expect(r.code).toBe('OP_EXEC')
      expect(r.subCode).toBe('VCS_READ')
      expect(r.risk).toBe('low')
    })

    it('git push → VCS_WRITE, medium risk', () => {
      const r = exec('git push')
      expect(r.subCode).toBe('VCS_WRITE')
      expect(r.risk).toBe('medium')
    })

    it('git reset --hard → VCS_DANGEROUS, high risk', () => {
      const r = exec('git reset --hard')
      expect(r.subCode).toBe('VCS_DANGEROUS')
      expect(r.risk).toBe('high')
    })

    it('git push --force → medium → high (parameter trigger)', () => {
      const r = exec('git push --force')
      expect(r.subCode).toBe('VCS_WRITE') // sub-action preserved
      expect(r.risk).toBe('high')         // risk escalated by trigger
    })

    it('npm install → PKG_WRITE, medium risk', () => {
      const r = exec('npm install')
      expect(r.subCode).toBe('PKG_WRITE')
      expect(r.risk).toBe('medium')  // WRITE operations keep medium
    })

    it('npm run test → PKG_EXEC, medium risk', () => {
      const r = exec('npm run test')
      expect(r.subCode).toBe('PKG_EXEC')
      expect(r.risk).toBe('medium')
    })

    it('npm publish → PKG_DANGEROUS, high risk', () => {
      const r = exec('npm publish')
      expect(r.subCode).toBe('PKG_DANGEROUS')
      expect(r.risk).toBe('high')
    })

    it('npx → PKG_EXEC', () => {
      const r = exec('npx eslint --fix')
      expect(r.subCode).toBe('PKG_EXEC')
    })

    it('npx create → PKG_EXEC, high risk (trigger)', () => {
      const r = exec('npx create-vite my-app')
      expect(r.subCode).toBe('PKG_EXEC')
      expect(r.risk).toBe('high')
    })

    it('node my-script.js → BUILD', () => {
      const r = exec('node my-script.js')
      expect(r.subCode).toBe('BUILD')
    })

    it('rm -rf node_modules → FS_DELETE, high risk', () => {
      const r = exec('rm -rf node_modules')
      expect(r.subCode).toBe('FS_DELETE')
      expect(r.risk).toBe('high')
    })

    it('mkdir my-dir → FS_WRITE, low risk', () => {
      const r = exec('mkdir my-dir')
      expect(r.subCode).toBe('FS_WRITE')
      expect(r.risk).toBe('low')
    })

    it('ls → FS_READ, low risk', () => {
      const r = exec('ls')
      expect(r.subCode).toBe('FS_READ')
      expect(r.risk).toBe('low')
    })

    it('echo hello → DATA, low risk', () => {
      const r = exec('echo hello')
      expect(r.subCode).toBe('DATA')
      expect(r.risk).toBe('low')
    })

    it('python analyze.py → SCRIPT, medium risk', () => {
      const r = exec('python analyze.py')
      expect(r.subCode).toBe('SCRIPT')
      expect(r.risk).toBe('medium')
    })

    it('which git → ENV_READ, low risk', () => {
      const r = exec('which git')
      expect(r.subCode).toBe('ENV_READ')
      expect(r.risk).toBe('low')
    })

    // ── PowerShell ──

    it('Get-ChildItem → FS_READ', () => {
      const r = exec('Get-ChildItem -Path . -Recurse')
      expect(r.subCode).toBe('FS_READ')
      expect(r.risk).toBe('low')
    })

    it('Remove-Item -Recurse → FS_DELETE, high risk (trigger)', () => {
      const r = exec('Remove-Item -Recurse -Force .\\node_modules')
      expect(r.subCode).toBe('FS_DELETE')
      expect(r.risk).toBe('high')
    })

    // ── Unknown command ──

    it('unknown command → UNKNOWN subCode', () => {
      const r = exec('mystery-tool --flag')
      expect(r.subCode).toBe('UNKNOWN')
    })

    // ── Missing command ──

    it('no command → default OP_EXEC', () => {
      const r = registry.classify('exec', {})
      expect(r.code).toBe('OP_EXEC')
      expect(r.subCode).toBeUndefined()
    })
  })

  // ── Output format for ERDL ──

  describe('output format for ERDL evalContext', () => {
    it('codeStr/subCodeStr/riskStr are strings', () => {
      const r = registry.classify('exec', { command: 'git push --force' })
      expect(typeof r.codeStr).toBe('string')
      expect(typeof r.subCodeStr).toBe('string')
      expect(typeof r.riskStr).toBe('string')
      expect(r.codeStr).toBe('OP_EXEC')
      expect(r.subCodeStr).toBe('VCS_WRITE')
      expect(r.riskStr).toBe('high')
    })
  })

  // ── Categories ──

  describe('getCategories()', () => {
    it('返回 6 个分类', () => {
      const cats = registry.getCategories()
      expect(cats.length).toBe(6)
    })
  })
})
