import * as SQLite from 'expo-sqlite';
import { migrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialised. Call initDatabase() first.');
  }
  return db;
}

/** Opens the local database and applies pending migrations (each in a transaction). */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }
  const conn = await SQLite.openDatabaseAsync('alphadex.db');
  await conn.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await conn.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const row = await conn.getFirstAsync<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_migrations',
  );
  const current = row?.v ?? 0;
  for (const m of migrations.filter(x => x.version > current)) {
    await conn.withExclusiveTransactionAsync(async tx => {
      for (const stmt of m.sql) {
        await tx.execAsync(stmt);
      }
      await tx.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        m.version,
        m.name,
        Date.now(),
      );
    });
  }
  db = conn;
  return conn;
}
