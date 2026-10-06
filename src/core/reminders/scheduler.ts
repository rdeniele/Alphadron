import { platform } from '../../platform';
import { listReminders, setReminderEnabled, type Reminder } from '../../database/repositories/remindersRepo';
import { listTasks, type Task } from '../../database/repositories/tasksRepo';
import { listEvents, type ScheduledEvent } from '../../database/repositories/eventsRepo';
import { taskAlertAt } from './alertTimes';

const reminderKey = (id: number) => `reminder-${id}`;
const taskKey = (id: number) => `task-${id}`;
const eventKey = (id: number) => `event-${id}`;

/** One alert at the due time. Nothing repeats, so it never nags. Returns false if nothing was scheduled. */
async function scheduleOnce(key: string, title: string, body: string, at: Date): Promise<boolean> {
  if (at.getTime() <= Date.now()) {
    return false;
  }
  if (!(await platform.notifications.ensurePermission())) {
    return false;
  }
  await platform.notifications.schedule({ key, title, body, at });
  return true;
}

// ---- Reminders ----

export async function scheduleReminder(r: Reminder): Promise<boolean> {
  const rule = r.repeatRule === 'daily' || r.repeatRule === 'weekly' ? r.repeatRule : null;
  if (!rule) {
    return scheduleOnce(reminderKey(r.id), r.title, r.message ?? 'Reminder', new Date(r.triggerAt));
  }
  if (!(await platform.notifications.ensurePermission())) {
    return false;
  }
  await platform.notifications.schedule({
    key: reminderKey(r.id),
    title: r.title,
    body: r.message ?? 'Reminder',
    at: new Date(r.triggerAt),
    repeat: rule,
  });
  return true;
}

export const cancelReminderNotification = (id: number) => platform.notifications.cancel(reminderKey(id));

// ---- Tasks ----

/** (Re)schedules a task's due alert, or removes it if the task is done / has no due date. */
export async function syncTaskAlert(t: Task): Promise<boolean> {
  const at = taskAlertAt(t.dueAt, t.status);
  if (!at) {
    await platform.notifications.cancel(taskKey(t.id));
    return false;
  }
  return scheduleOnce(taskKey(t.id), 'Task due', t.title, at);
}

export const cancelTaskAlert = (id: number) => platform.notifications.cancel(taskKey(id));

// ---- Events ----

export const scheduleEventAlert = (e: ScheduledEvent) =>
  scheduleOnce(eventKey(e.id), e.title, 'Starting now', new Date(e.startsAt));

export const cancelEventAlert = (id: number) => platform.notifications.cancel(eventKey(id));

/**
 * Re-registers every pending alert (after reboot, app update, or when the alert style changes).
 * Safe to call repeatedly: each alert has a stable key, so it is replaced, never duplicated.
 */
export async function rescheduleAll(): Promise<void> {
  const now = Date.now();
  for (const r of await listReminders()) {
    if (r.repeatRule || r.triggerAt > now) {
      await scheduleReminder(r).catch(() => undefined);
    } else {
      await setReminderEnabled(r.id, false);
    }
  }
  for (const t of await listTasks({ status: 'open' })) {
    await syncTaskAlert(t).catch(() => undefined);
  }
  for (const e of await listEvents(now, now + 365 * 86400000)) {
    await scheduleEventAlert(e).catch(() => undefined);
  }
}
