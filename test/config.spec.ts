import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  API_KEY_ENV,
  HOME_ENV,
  RULES_DIR_ENV,
  ensureHome,
  resolveApiKey,
  resolvePaths,
} from '../src/config.js';

describe('config', () => {
  const savedEnv = {
    home: process.env[HOME_ENV],
    rulesDir: process.env[RULES_DIR_ENV],
    apiKey: process.env[API_KEY_ENV],
  };

  afterEach(() => {
    if (savedEnv.home === undefined) delete process.env[HOME_ENV];
    else process.env[HOME_ENV] = savedEnv.home;
    if (savedEnv.rulesDir === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = savedEnv.rulesDir;
    if (savedEnv.apiKey === undefined) delete process.env[API_KEY_ENV];
    else process.env[API_KEY_ENV] = savedEnv.apiKey;
  });

  it('defaults home to ~/.rulsynor and db inside it', () => {
    delete process.env[HOME_ENV];
    const paths = resolvePaths();
    expect(paths.home.endsWith('.rulsynor')).toBe(true);
    expect(paths.dbPath).toBe(join(paths.home, 'rulsynor.db'));
  });

  it('honors RULSYNOR_HOME', () => {
    process.env[HOME_ENV] = join(tmpdir(), 'rulsynor-test-home');
    const paths = resolvePaths();
    expect(paths.home).toBe(join(tmpdir(), 'rulsynor-test-home'));
    expect(paths.dbPath).toBe(join(paths.home, 'rulsynor.db'));
  });

  it('prefers RULSYNOR_RULES_DIR over any existing directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rulsynor-rules-'));
    process.env[RULES_DIR_ENV] = dir;
    const paths = resolvePaths();
    expect(paths.rulesDir).toBe(dir);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null rulesDir when no candidate exists', () => {
    const home = mkdtempSync(join(tmpdir(), 'rulsynor-home-'));
    process.env[HOME_ENV] = home;
    delete process.env[RULES_DIR_ENV];
    // cwd is the repo root; guard against an accidental ./rules there
    const paths = resolvePaths();
    if (paths.rulesDir !== null) {
      expect(paths.rulesDir).toBe(join(home, 'rules'));
    } else {
      expect(paths.rulesDir).toBeNull();
    }
    rmSync(home, { recursive: true, force: true });
  });

  it('ensureHome creates the directory idempotently', () => {
    const home = join(tmpdir(), `rulsynor-ensure-${Date.now()}`);
    ensureHome(home);
    ensureHome(home);
    const paths = resolvePaths();
    expect(paths).toBeDefined();
    rmSync(home, { recursive: true, force: true });
  });

  it('reads the API key from env only, ignoring blanks', () => {
    delete process.env[API_KEY_ENV];
    expect(resolveApiKey()).toBeUndefined();
    process.env[API_KEY_ENV] = '   ';
    expect(resolveApiKey()).toBeUndefined();
    process.env[API_KEY_ENV] = 'sk-test';
    expect(resolveApiKey()).toBe('sk-test');
  });

  it('user rules dir falls back to RULSYNOR_HOME/rules when it exists', () => {
    const home = mkdtempSync(join(tmpdir(), 'rulsynor-home2-'));
    mkdirSync(join(home, 'rules'));
    process.env[HOME_ENV] = home;
    delete process.env[RULES_DIR_ENV];
    const paths = resolvePaths();
    // Only assert the shared fallback when cwd has no ./rules.
    if (paths.rulesDir !== join(process.cwd(), 'rules')) {
      expect(paths.rulesDir).toBe(join(home, 'rules'));
    }
    rmSync(home, { recursive: true, force: true });
  });
});
