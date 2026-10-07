import { getDb } from '../db';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number; // 1 high, 2 normal, 3 low
  dueAt: number | null;
  createdAt: number;
  completedAt: number | null;
}

interface Row {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  due_at: number | null;
  created_at: number;
  completed_at: number | null;
}

const map = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  dueAt: r.due_at,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

export async function createTask(input: {
  title: string;
  description?: string;
  priority?: number;
  dueAt?: number | null;
}): Promise<Task> {
  const now = Date.now();
  const res = await getDb().runAsync(
    'INSERT INTO tasks (title, description, priority, due_at, created_at) VALUES (?,?,?,?,?)',
    input.title,
    input.description ?? null,
    input.priority ?? 2,
    input.dueAt ?? null,
    now,
  );
  return (await getTask(res.lastInsertRowId))!;
}

export async function getTask(id: number): Promise<Task | null> {
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM tasks WHERE id = ?', id);
  return r ? map(r) : null;
}

export async function listTasks(opts: { status?: 'open' | 'done' | 'all'; dueBefore?: number } = {}) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const status = opts.status ?? 'open';
  if (status === 'open') {
    where.push("status IN ('todo','in_progress')");
  } else if (status === 'done') {
    where.push("status = 'done'");
  }
  if (opts.dueBefore !== undefined) {
    where.push('due_at IS NOT NULL AND due_at <= ?');
    args.push(opts.dueBefore);
  }
  const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY priority ASC, COALESCE(due_at, 9e15) ASC, id DESC LIMIT 200`;
  return (await getDb().getAllAsync<Row>(sql, ...args)).map(map);
}

export async function completeTask(id: number): Promise<void> {
  await getDb().runAsync(
    "UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?",
    Date.now(),
    id,
  );
}

export async function reopenTask(id: number): Promise<void> {
  await getDb().runAsync("UPDATE tasks SET status = 'todo', completed_at = NULL WHERE id = ?", id);
}

export async function deleteTask(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM tasks WHERE id = ?', id);
}

/** Best-effort match of a user phrase to an open task by id or title words. */
export async function findOpenTask(query: { id?: number; title?: string }): Promise<Task | null> {
  if (query.id !== undefined) {
    const t = await getTask(query.id);
    return t && t.status !== 'done' ? t : null;
  }
  if (!query.title) {
    return null;
  }
  const words = query.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const open = await listTasks({ status: 'open' });
  let best: { t: Task; score: number } | null = null;
  for (const t of open) {
    const title = t.title.toLowerCase();
    const score = words.filter(w => title.includes(w)).length + (title === query.title.toLowerCase() ? 5 : 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { t, score };
    }
  }
  return best?.t ?? null;
}

export async function updateTask(
  id: number,
  patch: { title: string; description: string | null; priority: number; dueAt: number | null },
): Promise<Task | null> {
  await getDb().runAsync(
    'UPDATE tasks SET title = ?, description = ?, priority = ?, due_at = ? WHERE id = ?',
    patch.title,
    patch.description,
    patch.priority,
    patch.dueAt,
    id,
  );
  return getTask(id);
}
