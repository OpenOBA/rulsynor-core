/**
 * `rulsynor audit` — READ-ONLY audit viewer.
 *
 * CORE policy: audit records can be viewed, never exported or downloaded —
 * export is a commercial-edition capability, not a CORE one.
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-09-02
 * @license BSL 1.1
 */

import { Store } from '../storage/index.js';
import { resolvePaths } from '../config.js';
import { dim, parseFlag } from './flags.js';

export async function runAudit(args: string[]): Promise<void> {
  const sub = args[0];
  const paths = resolvePaths();
  const store = new Store(paths.dbPath);

  try {
    if (sub === 'list') {
      const limitRaw = parseFlag(args, 'limit');
      const limit = limitRaw !== undefined ? Number(limitRaw) || 20 : 20;
      const rows = store.listAudit(limit);
      if (rows.length === 0) {
        console.log(
          'No audit records yet. Every guarded tool call in `rulsynor chat` records one Decision Object here.',
        );
        return;
      }
      console.log(`${store.countAudit()} audit record(s) — latest ${rows.length} (read-only):\n`);
      console.log('  TIME (UTC)           DECISION         TOOL         HASH');
      for (const r of rows) {
        const time = r.createdAt.replace('T', ' ').slice(0, 19);
        console.log(
          `  ${time}  ${r.decision.padEnd(16)} ${r.toolName.padEnd(12)} ${r.hash.slice(0, 23)}…`,
        );
      }
      console.log(`\nView one record: rulsynor audit show <hash-prefix>`);
      console.log(dim('CORE provides read-only viewing; export/download is not included.'));
      return;
    }

    if (sub === 'show') {
      let prefix = args[1];
      if (!prefix) throw new Error('usage: rulsynor audit show <hash-prefix>');
      // Accept prefixes with or without the "sha256:" scheme — audit list shows the
      // full "sha256:<hex>" hash, but users often copy just the hex part.
      if (!prefix.startsWith('sha256:')) prefix = 'sha256:' + prefix;
      const rec = store.getAuditByHashPrefix(prefix);
      if (!rec) {
        throw new Error(`No unique audit record matches "${prefix}" (0 matches or ambiguous).`);
      }
      const parsed: unknown = JSON.parse(rec.doJson);
      console.log(
        dim(
          `Audit #${rec.id} · ${rec.createdAt} · session ${rec.sessionId} · step ${rec.step} · read-only view\n`,
        ),
      );
      console.log(JSON.stringify(parsed, null, 2));
      console.log(dim('\nCORE provides read-only viewing; export/download is not included.'));
      return;
    }

    throw new Error('usage: rulsynor audit list [--limit N] | audit show <hash-prefix>');
  } finally {
    store.close();
  }
}
