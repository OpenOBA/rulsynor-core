/**
 * Storage — node:sqlite persistence layer (zero npm dependency).
 *
 * CORE keeps its own lightweight persistence for user-created rules and model config.
 * Uses Node's built-in `node:sqlite` (DatabaseSync) — no native compilation, no server.
 *
 * Design decisions (2026-09-02):
 * - node:sqlite over better-sqlite3 (native build) / sql.js (WASM, slow) — zero-dependency.
 * - Model config stores name/baseUrl ONLY — the API key NEVER enters the DB (kept by the
 *   caller / environment; see runtime.ts llm injection).
 *
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { DatabaseSync } from 'node:sqlite';

/** A stored user-created rule (subset of the engine RuleDefinition persisted to SQLite). */
export interface StoredRule {
  id: string;
  name: string;
  description?: string;
  category: string;
  priority: number;
  enabled: boolean;
  version: number;
  scopeLevel?: number;
  /** Serialized conditions / action / etc. as JSON strings (persisted verbatim). */
  conditionsJson: string;
  actionJson: string;
  createdAt: string;
  updatedAt: string;
}

/** Model configuration persisted by CORE (API key deliberately excluded). */
export interface ModelConfig {
  modelName?: string;
  baseUrl?: string;
}

/** A persisted audit record — one tamper-evident Decision Object per row. */
export interface AuditRecord {
  id: number;
  createdAt: string;
  sessionId: string;
  agentId: string;
  step: number;
  toolName: string;
  decision: string;
  hash: string;
  previousHash: string | null;
  doJson: string;
}

/** Input for persisting one Decision Object (built by the runtime). */
export interface AuditEntryInput {
  sessionId: string;
  agentId: string;
  step: number;
  toolName: string;
  decision: string;
  hash: string;
  previousHash?: string | null;
  decisionObject: unknown;
}

export interface CreateRuleInput {
  id: string;
  name: string;
  description?: string;
  category: string;
  priority?: number;
  enabled?: boolean;
  version?: number;
  scopeLevel?: number;
  conditions: unknown;
  action: unknown;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  scope_level INTEGER,
  conditions_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  tool_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  previous_hash TEXT,
  do_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_records (created_at);
`;

/** A single open SQLite database. Pass a path (file) or ':memory:' (tests). */
export class Store {
  private readonly db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
  }

  // ── Rules ──

  createRule(input: CreateRuleInput): StoredRule {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO rules (id, name, description, category, priority, enabled, version, scope_level, conditions_json, action_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.name,
        input.description ?? null,
        input.category,
        input.priority ?? 100,
        input.enabled === false ? 0 : 1,
        input.version ?? 1,
        input.scopeLevel ?? null,
        JSON.stringify(input.conditions),
        JSON.stringify(input.action),
        now,
        now,
      );
    return {
      id: input.id,
      name: input.name,
      description: input.description,
      category: input.category,
      priority: input.priority ?? 100,
      enabled: input.enabled !== false,
      version: input.version ?? 1,
      scopeLevel: input.scopeLevel,
      conditionsJson: JSON.stringify(input.conditions),
      actionJson: JSON.stringify(input.action),
      createdAt: now,
      updatedAt: now,
    };
  }

  listRules(): StoredRule[] {
    return (this.db.prepare('SELECT * FROM rules ORDER BY priority, name').all() as unknown[]).map(
      row => this.mapRule(row as Record<string, unknown>),
    );
  }

  getRule(id: string): StoredRule | undefined {
    const row = this.db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return row ? this.mapRule(row) : undefined;
  }

  updateRule(id: string, patch: Partial<CreateRuleInput>): StoredRule | undefined {
    const existing = this.getRule(id);
    if (!existing) return undefined;
    const merged: CreateRuleInput = {
      id,
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      category: patch.category ?? existing.category,
      priority: patch.priority ?? existing.priority,
      enabled: patch.enabled ?? existing.enabled,
      version: patch.version ?? existing.version,
      scopeLevel: patch.scopeLevel ?? existing.scopeLevel,
      conditions: patch.conditions ?? JSON.parse(existing.conditionsJson),
      action: patch.action ?? JSON.parse(existing.actionJson),
    };
    this.db
      .prepare(
        `UPDATE rules SET name=?, description=?, category=?, priority=?, enabled=?, version=?, scope_level=?, conditions_json=?, action_json=?, updated_at=? WHERE id=?`,
      )
      .run(
        merged.name,
        merged.description ?? null,
        merged.category,
        merged.priority ?? null,
        merged.enabled === false ? 0 : 1,
        merged.version ?? null,
        merged.scopeLevel ?? null,
        JSON.stringify(merged.conditions),
        JSON.stringify(merged.action),
        new Date().toISOString(),
        id,
      );
    return this.getRule(id);
  }

  deleteRule(id: string): boolean {
    const r = this.db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    return Number(r.changes) > 0;
  }

  countRules(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM rules').get() as { n: number };
    return row.n;
  }

  // ── Model config (name/baseUrl only — NEVER the API key) ──

  setModelConfig(cfg: ModelConfig): ModelConfig {
    const entries: Array<[string, string]> = [];
    if (cfg.modelName !== undefined) entries.push(['modelName', cfg.modelName]);
    if (cfg.baseUrl !== undefined) entries.push(['baseUrl', cfg.baseUrl]);
    const stmt = this.db.prepare(
      'INSERT INTO model_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    );
    for (const [k, v] of entries) stmt.run(k, v);
    return this.getModelConfig();
  }

  getModelConfig(): ModelConfig {
    const rows = this.db.prepare('SELECT key, value FROM model_config').all() as Array<{
      key: string;
      value: string;
    }>;
    const cfg: ModelConfig = {};
    for (const r of rows) {
      if (r.key === 'modelName') cfg.modelName = r.value;
      if (r.key === 'baseUrl') cfg.baseUrl = r.value;
    }
    return cfg;
  }

  // ── Audit records (write + read-only view; CORE never exports) ──

  /** Persist one Decision Object. Duplicate hashes are rejected (idempotent write). */
  recordAudit(input: AuditEntryInput): AuditRecord {
    const createdAt = new Date().toISOString();
    const r = this.db
      .prepare(
        `INSERT OR IGNORE INTO audit_records
         (created_at, session_id, agent_id, step, tool_name, decision, hash, previous_hash, do_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        createdAt,
        input.sessionId,
        input.agentId,
        input.step,
        input.toolName,
        input.decision,
        input.hash,
        input.previousHash ?? null,
        JSON.stringify(input.decisionObject),
      );
    if (Number(r.changes) === 0) {
      const existing = this.getAuditByHash(input.hash);
      if (existing) return existing;
    }
    return {
      id: Number(r.lastInsertRowid),
      createdAt,
      sessionId: input.sessionId,
      agentId: input.agentId,
      step: input.step,
      toolName: input.toolName,
      decision: input.decision,
      hash: input.hash,
      previousHash: input.previousHash ?? null,
      doJson: JSON.stringify(input.decisionObject),
    };
  }

  /** Most recent audit records, newest first. Read-only view. */
  listAudit(limit = 20): AuditRecord[] {
    const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
    const rows = this.db
      .prepare('SELECT * FROM audit_records ORDER BY id DESC LIMIT ?')
      .all(safeLimit) as unknown[];
    return rows.map(row => this.mapAudit(row as Record<string, unknown>));
  }

  /** Exact-hash lookup. */
  getAuditByHash(hash: string): AuditRecord | undefined {
    const row = this.db.prepare('SELECT * FROM audit_records WHERE hash = ?').get(hash) as
      Record<string, unknown> | undefined;
    return row ? this.mapAudit(row) : undefined;
  }

  /** Prefix lookup (short hash from CLI output). Ambiguous prefix → undefined. */
  getAuditByHashPrefix(prefix: string): AuditRecord | undefined {
    if (prefix.length === 0) return undefined;
    // `%` and `_` are LIKE wildcards and can never appear in a valid hash prefix
    // (sha256:<hex>). Reject them so a viewer can't wildcard-match arbitrary records.
    if (/[%_]/.test(prefix)) return undefined;
    const rows = this.db
      .prepare("SELECT * FROM audit_records WHERE hash LIKE ? || '%' LIMIT 2")
      .all(prefix) as unknown[];
    if (rows.length !== 1) return undefined;
    return this.mapAudit(rows[0] as Record<string, unknown>);
  }

  countAudit(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM audit_records').get() as { n: number };
    return row.n;
  }

  close(): void {
    this.db.close();
  }

  // ── Helpers ──

  private mapAudit(row: Record<string, unknown>): AuditRecord {
    return {
      id: Number(row.id),
      createdAt: String(row.created_at),
      sessionId: String(row.session_id),
      agentId: String(row.agent_id),
      step: Number(row.step),
      toolName: String(row.tool_name),
      decision: String(row.decision),
      hash: String(row.hash),
      previousHash: row.previous_hash == null ? null : String(row.previous_hash),
      doJson: String(row.do_json),
    };
  }

  private mapRule(row: Record<string, unknown>): StoredRule {
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description == null ? undefined : String(row.description),
      category: String(row.category),
      priority: Number(row.priority),
      enabled: Number(row.enabled) === 1,
      version: Number(row.version),
      scopeLevel: row.scope_level == null ? undefined : Number(row.scope_level),
      conditionsJson: String(row.conditions_json),
      actionJson: String(row.action_json),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}
