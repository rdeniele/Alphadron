import { platform } from '../../platform';
import { listReminders, setReminderEnabled, type Reminder } from '../../database/repositories/remindersRepo';

const keyFor = (id: number) => `reminder-${id}`;

export async function scheduleReminder(r: Reminder): Promise<boolean> {
  const rule = r.repeatRule === 'daily' || r.repeatRule === 'weekly' ? r.repeatRule : null;
  if (!rule && r.triggerAt <= Date.now()) {
    return false;
  }
  const ok = await platform.notifications.ensurePermission();
  if (!ok) {
    return false;
  }
  await platform.notifications.schedule({
    key: keyFor(r.id),
    title: r.title,
    body: r.message ?? r.title,
    at: new Date(r.triggerAt),
    repeat: rule,
  });
  return true;
}

export const cancelReminderNotification = (id: number) => platform.notifications.cancel(keyFor(id));

/** Re-registers all pending reminders (e.g. after reboot or app update). Safe to call on every launch. */
export async function rescheduleAll(): Promise<void> {
  const now = Date.now();
  for (const r of await listReminders()) {
    if (r.repeatRule || r.triggerAt > now) {
      await scheduleReminder(r).catch(() => undefined);
    } else {
      await setReminderEnabled(r.id, false);
    }
  }
}
