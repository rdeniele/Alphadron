import { getDb } from '../db';

export interface ScheduledEvent {
  id: number;
  title: string;
  notes: string | null;
  startsAt: number;
  endsAt: number | null;
}

interface Row {
  id: number;
  title: string;
  notes: string | null;
  starts_at: number;
  ends_at: number | null;
}

const map = (r: Row): ScheduledEvent => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
});

export async function createEvent(input: {
  title: string;
  notes?: string;
  startsAt: number;
  endsAt?: number | null;
}): Promise<ScheduledEvent> {
  const res = await getDb().runAsync(
    'INSERT INTO scheduled_events (title, notes, starts_at, ends_at, created_at) VALUES (?,?,?,?,?)',
    input.title,
    input.notes ?? null,
    input.startsAt,
    input.endsAt ?? null,
    Date.now(),
  );
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM scheduled_events WHERE id = ?', res.lastInsertRowId);
  return map(r!);
}

export async function listEvents(from: number, to: number): Promise<ScheduledEvent[]> {
  const rows = await getDb().getAllAsync<Row>(
    'SELECT * FROM scheduled_events WHERE starts_at BETWEEN ? AND ? ORDER BY starts_at ASC',
    from,
    to,
  );
  return rows.map(map);
}

export async function deleteEvent(id: number) {
  await getDb().runAsync('DELETE FROM scheduled_events WHERE id = ?', id);
}
