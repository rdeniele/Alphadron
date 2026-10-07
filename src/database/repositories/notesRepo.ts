import { getDb } from '../db';

export interface Note {
  id: number;
  title: string | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: number;
  title: string | null;
  body: string;
  created_at: number;
  updated_at: number;
}

const map = (r: Row): Note => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function createNote(input: { title?: string; body: string }): Promise<Note> {
  const now = Date.now();
  const res = await getDb().runAsync(
    'INSERT INTO notes (title, body, created_at, updated_at) VALUES (?,?,?,?)',
    input.title ?? null,
    input.body,
    now,
    now,
  );
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM notes WHERE id = ?', res.lastInsertRowId);
  return map(r!);
}

export async function listNotes(limit = 100): Promise<Note[]> {
  const rows = await getDb().getAllAsync<Row>(
    'SELECT * FROM notes ORDER BY updated_at DESC LIMIT ?',
    limit,
  );
  return rows.map(map);
}

export async function searchNotes(query: string, limit = 10): Promise<Note[]> {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) {
    return listNotes(limit);
  }
  const cond = words.map(() => '(LOWER(body) LIKE ? OR LOWER(COALESCE(title,\'\')) LIKE ?)').join(' OR ');
  const args = words.flatMap(w => [`%${w}%`, `%${w}%`]);
  const rows = await getDb().getAllAsync<Row>(
    `SELECT * FROM notes WHERE ${cond} ORDER BY updated_at DESC LIMIT ?`,
    ...args,
    limit,
  );
  return rows.map(map);
}

export async function deleteNote(id: number) {
  await getDb().runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function getNote(id: number): Promise<Note | null> {
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM notes WHERE id = ?', id);
  return r ? map(r) : null;
}

export async function updateNote(id: number, patch: { title: string | null; body: string }): Promise<Note | null> {
  await getDb().runAsync('UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?', patch.title, patch.body, Date.now(), id);
  return getNote(id);
}
