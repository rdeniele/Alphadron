import test from 'node:test';
import assert from 'node:assert/strict';
import { taskAlertAt } from '../src/core/reminders/alertTimes.ts';
import { dateOnlyDue } from '../src/core/scheduling/dateParse.ts';

test('a task with a due time alerts at that time', () => {
  const due = new Date(2026, 9, 9, 15, 30).getTime();
  assert.equal(taskAlertAt(due, 'todo')?.getTime(), due);
});
test('a date-only task alerts at 9:00 that day', () => {
  const at = taskAlertAt(dateOnlyDue(new Date(2026, 9, 9)), 'todo')!;
  assert.equal(at.getTime(), new Date(2026, 9, 9, 9, 0).getTime());
});
test('no alert for done/cancelled tasks or tasks without a due date', () => {
  const due = new Date(2026, 9, 9, 15, 30).getTime();
  assert.equal(taskAlertAt(due, 'done'), null);
  assert.equal(taskAlertAt(due, 'cancelled'), null);
  assert.equal(taskAlertAt(null, 'todo'), null);
});
