import { getDb } from '../db';

export interface Memory {
  id: number;
  content: string;
  category: string | null;
  sensitive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  id: number;
  content: string;
  category: string | null;
  sensitive: number;
  created_at: number;
  updated_at: number;
}

const map = (r: Row): Memory => ({
  id: r.id,
  content: r.content,
  category: r.category,
  sensitive: r.sensitive === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function addMemory(input: {
  content: string;
  category?: string | null;
  sensitive?: boolean;
}): Promise<Memory> {
  const now = Date.now();
  const res = await getDb().runAsync(
    'INSERT INTO memories (content, category, sensitive, created_at, updated_at) VALUES (?,?,?,?,?)',
    input.content,
    input.category ?? null,
    input.sensitive ? 1 : 0,
    now,
    now,
  );
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM memories WHERE id = ?', res.lastInsertRowId);
  return map(r!);
}

export async function listMemories(): Promise<Memory[]> {
  const rows = await getDb().getAllAsync<Row>('SELECT * FROM memories ORDER BY updated_at DESC');
  return rows.map(map);
}

export async function updateMemory(id: number, content: string) {
  await getDb().runAsync('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?', content, Date.now(), id);
}

export async function deleteMemory(id: number) {
  await getDb().runAsync('DELETE FROM memories WHERE id = ?', id);
}

export async function clearMemories() {
  await getDb().runAsync('DELETE FROM memories');
}

/** Keyword relevance search (no embeddings; fully offline and cheap). */
export async function searchMemories(query: string, limit = 5): Promise<Memory[]> {
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const all = await listMemories();
  if (!words.length) {
    return all.slice(0, limit);
  }
  return all
    .map(m => ({ m, score: words.filter(w => m.content.toLowerCase().includes(w)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.m);
}
