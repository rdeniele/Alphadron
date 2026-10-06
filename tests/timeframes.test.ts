import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, parseRange, dateOnlyDue, isDateOnlyDue, formatDue } from '../src/core/scheduling/dateParse.ts';
import { fastPath, resolvePending } from '../src/core/ai/fastPath.ts';

// Wednesday 7 Oct 2026, 10:00
const now = new Date(2026, 9, 7, 10, 0);
const d = (m: number, day: number, h = 0, mi = 0) => new Date(2026, m - 1, day, h, mi).getTime();
const when = (p: string, n = now) => parseWhen(p, n)!;

test('"today" with no time picks the next whole hour (9 AM has already passed)', () => {
  assert.equal(when('today').date.getTime(), d(10, 7, 11));
  assert.equal(when('today').hasTime, false);
});
test('"today" late in the evening rolls to tomorrow morning', () => {
  assert.equal(when('today', new Date(2026, 9, 7, 22, 30)).date.getTime(), d(10, 8, 9));
});
test('later today = about two hours from now, rounded up', () => {
  assert.equal(when('later today').date.getTime(), d(10, 7, 12));
  assert.equal(when('later').date.getTime(), d(10, 7, 12));
});
test('end of day / eod = 5 PM; end of the week = Friday 5 PM', () => {
  assert.equal(when('by end of day').date.getTime(), d(10, 7, 17));
  assert.equal(when('eod').date.getTime(), d(10, 7, 17));
  assert.equal(when('by the end of the week').date.getTime(), d(10, 9, 17));
});
test('this week = Friday, next week = next Monday, weekend = Saturday, next month = the 1st', () => {
  assert.equal(when('this week').date.getTime(), d(10, 9, 9));
  assert.equal(when('next week').date.getTime(), d(10, 12, 9));
  assert.equal(when('this weekend').date.getTime(), d(10, 10, 9));
  assert.equal(when('on the weekend').date.getTime(), d(10, 10, 9));
  assert.equal(when('next weekend').date.getTime(), d(10, 17, 9));
  assert.equal(when('next month').date.getTime(), d(11, 1, 9));
  assert.equal(when('end of the month').date.getTime(), d(10, 31, 9));
});
test('timeframes combine with a time', () => {
  assert.equal(when('next week at 3pm').date.getTime(), d(10, 12, 15));
  assert.equal(when('this weekend at 10 am').date.getTime(), d(10, 10, 10));
});

test('ranges for questions', () => {
  const today = parseRange('today', now)!;
  assert.equal(today.days, 1);
  assert.equal(today.label, 'today');
  assert.equal(parseRange('tomorrow', now)!.label, 'tomorrow');
  const week = parseRange('this week', now)!;
  assert.equal(week.days, 5); // Wed..Sun
  assert.equal(week.from, d(10, 7));
  const next = parseRange('next week', now)!;
  assert.equal(next.days, 7);
  assert.equal(next.from, d(10, 12));
  const wk = parseRange('this weekend', now)!;
  assert.equal(wk.days, 2);
  assert.equal(wk.from, d(10, 10));
  assert.equal(parseRange('this month', now)!.to > d(10, 31), true);
  assert.equal(parseRange('gibberish', now), null);
});

test('date-only due dates are stored as end of day and shown without a time', () => {
  const ms = dateOnlyDue(new Date(2026, 9, 9));
  assert.equal(isDateOnlyDue(ms), true);
  assert.equal(formatDue(ms, now), 'Fri, Oct 9');
  assert.equal(formatDue(dateOnlyDue(now), now), 'today');
  assert.equal(isDateOnlyDue(d(10, 9, 15, 0)), false);
  assert.equal(formatDue(d(10, 9, 15, 0), now), 'Fri, Oct 9 at 3 PM');
});

const tool = (s: string) => {
  const r = fastPath(s);
  assert.equal(r?.kind, 'tool', `${s} -> ${JSON.stringify(r)}`);
  return r as { tool: string; args: Record<string, string> };
};

test('tasks keep their timeframe instead of leaving it in the title', () => {
  for (const [text, due, title] of [
    ['add a task finish the report this week', 'this week', 'Finish the report'],
    ['add a task finish the report by end of day', 'by end of day', 'Finish the report'],
    ['add a task pay bills by the end of the week', 'by the end of the week', 'Pay bills'],
    ['add a task call dentist next week', 'next week', 'Call dentist'],
    ['add a task buy a gift today', 'today', 'Buy a gift'],
  ]) {
    const r = tool(text);
    assert.equal(r.tool, 'create_task');
    assert.equal(r.args.title, title);
    assert.equal(r.args.due_date, due);
  }
});
test('reminders accept timeframes', () => {
  assert.equal(tool('remind me next week to pay rent').args.when, 'next week');
  assert.equal(tool('remind me later today to email Sam').args.title, 'Email Sam');
  assert.equal(tool('remind me this weekend to clean the garage').args.when, 'this weekend');
  assert.equal(tool('remind me at the end of the day to review').args.title, 'Review');
});
test('scheduling an event', () => {
  const a = tool('schedule a meeting today at 3 pm');
  assert.equal(a.tool, 'create_schedule');
  assert.equal(a.args.title, 'Meeting');
  assert.equal(a.args.when, 'today at 3 pm');
  assert.equal(tool('schedule a meeting with Sam this friday at 2').args.title, 'Meeting with Sam');
  assert.equal(tool('add a lunch with Anna tomorrow at noon').args.title, 'Lunch with Anna');
  assert.equal(tool('book a dentist appointment next week at 9 am').args.title, 'Dentist appointment');
});
test('an event without a time asks, and the answer completes it', () => {
  const ask = fastPath('schedule a dentist appointment') as { kind: string; pending: never };
  assert.equal(ask.kind, 'reply');
  const done = resolvePending(ask.pending, 'tomorrow at 4 pm') as { tool: string; args: Record<string, string> };
  assert.equal(done.tool, 'create_schedule');
  assert.equal(done.args.title, 'Dentist appointment');
});
test('questions with timeframes', () => {
  assert.deepEqual(tool('what do I have this week').args, { when: 'this week' });
  assert.deepEqual(tool('what is on my schedule next week').args, { when: 'next week' });
  assert.deepEqual(tool('show me today').args, { when: 'today' });
  assert.deepEqual(tool('anything due this week?').args, { when: 'this week' });
  assert.deepEqual(tool("what's coming up").args, { when: 'this week' });
  assert.deepEqual(tool('what tasks are due today').args, { status: 'open', when: 'today' });
  assert.deepEqual(tool('what tasks do I have').args, { status: 'open' });
  assert.deepEqual(tool('what do I have tomorrow?').args, { when: 'tomorrow' });
});
