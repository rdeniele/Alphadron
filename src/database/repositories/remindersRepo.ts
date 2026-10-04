import { getDb } from '../db';

export interface Reminder {
  id: number;
  title: string;
  message: string | null;
  triggerAt: number;
  repeatRule: string | null; // 'daily' | 'weekly' | 'monthly' | null
  enabled: boolean;
  createdAt: number;
}

interface Row {
  id: number;
  title: string;
  message: string | null;
  trigger_at: number;
  repeat_rule: string | null;
  enabled: number;
  created_at: number;
}

const map = (r: Row): Reminder => ({
  id: r.id,
  title: r.title,
  message: r.message,
  triggerAt: r.trigger_at,
  repeatRule: r.repeat_rule,
  enabled: r.enabled === 1,
  createdAt: r.created_at,
});

export async function createReminder(input: {
  title: string;
  message?: string;
  triggerAt: number;
  repeatRule?: string | null;
}): Promise<Reminder> {
  const res = await getDb().runAsync(
    'INSERT INTO reminders (title, message, trigger_at, repeat_rule, created_at) VALUES (?,?,?,?,?)',
    input.title,
    input.message ?? null,
    input.triggerAt,
    input.repeatRule ?? null,
    Date.now(),
  );
  return (await getReminder(res.lastInsertRowId))!;
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM reminders WHERE id = ?', id);
  return r ? map(r) : null;
}

export async function listReminders(opts: { from?: number; to?: number; enabledOnly?: boolean } = {}) {
  const where: string[] = [];
  const args: number[] = [];
  if (opts.enabledOnly !== false) {
    where.push('enabled = 1');
  }
  if (opts.from !== undefined) {
    where.push('trigger_at >= ?');
    args.push(opts.from);
  }
  if (opts.to !== undefined) {
    where.push('trigger_at <= ?');
    args.push(opts.to);
  }
  const sql = `SELECT * FROM reminders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY trigger_at ASC LIMIT 200`;
  return (await getDb().getAllAsync<Row>(sql, ...args)).map(map);
}

export async function setReminderEnabled(id: number, enabled: boolean) {
  await getDb().runAsync('UPDATE reminders SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
}

export async function setReminderTrigger(id: number, triggerAt: number) {
  await getDb().runAsync('UPDATE reminders SET trigger_at = ? WHERE id = ?', triggerAt, id);
}

export async function deleteReminder(id: number) {
  await getDb().runAsync('DELETE FROM reminders WHERE id = ?', id);
}

export async function findReminder(query: { id?: number; title?: string }): Promise<Reminder | null> {
  if (query.id !== undefined) {
    return getReminder(query.id);
  }
  if (!query.title) {
    return null;
  }
  const words = query.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const all = await listReminders({ from: Date.now() - 60000 });
  let best: { r: Reminder; score: number } | null = null;
  for (const r of all) {
    const title = r.title.toLowerCase();
    const score = words.filter(w => title.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { r, score };
    }
  }
  return best?.r ?? null;
}
