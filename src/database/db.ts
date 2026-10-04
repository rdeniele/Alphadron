import { open, type DB } from '@op-engineering/op-sqlite';
import { migrations } from './migrations';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    throw new Error('Database not initialised. Call initDatabase() first.');
  }
  return db;
}

/** Opens the local database and applies pending migrations (each in a transaction). */
export async function initDatabase(): Promise<DB> {
  if (db) {
    return db;
  }
  const conn = open({ name: 'alphadex.db' });
  await conn.execute('PRAGMA foreign_keys = ON');
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const res = await conn.execute('SELECT MAX(version) AS v FROM schema_migrations');
  const current = Number(res.rows[0]?.v ?? 0);
  for (const m of migrations.filter(x => x.version > current)) {
    await conn.transaction(async tx => {
      for (const stmt of m.sql) {
        await tx.execute(stmt);
      }
      await tx.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, Date.now()],
      );
    });
  }
  db = conn;
  return conn;
}
