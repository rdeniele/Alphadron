import { isDateOnlyDue } from '../scheduling/dateParse';

/** A task with only a day (no time) gets one gentle nudge at this hour on that day. */
export const DATE_ONLY_TASK_HOUR = 9;

/** When a task's due alert should fire, or null if it should not alert at all. Pure. */
export function taskAlertAt(dueAt: number | null, status: string): Date | null {
  if (dueAt === null || status === 'done' || status === 'cancelled') {
    return null;
  }
  if (isDateOnlyDue(dueAt)) {
    const d = new Date(dueAt);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), DATE_ONLY_TASK_HOUR, 0);
  }
  return new Date(dueAt);
}
