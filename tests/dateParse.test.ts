import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, formatWhen } from '../src/core/scheduling/dateParse.ts';

// Fixed "now": Fri 2026-10-02 15:00 local
const now = new Date(2026, 9, 2, 15, 0);
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('tomorrow at 9 AM', () => {
  assert.equal(parseWhen('tomorrow at 9 AM', now)?.date.getTime(), at(2026, 10, 3, 9));
});
test('tomorrow at 9 (bare, morning)', () => {
  assert.equal(parseWhen('tomorrow at 9', now)?.date.getTime(), at(2026, 10, 3, 9));
});
test('at 7 with no day, 3pm now -> 7 PM today', () => {
  assert.equal(parseWhen('at 7', now)?.date.getTime(), at(2026, 10, 2, 19));
});
test('9:30 pm today', () => {
  assert.equal(parseWhen('today 9:30 pm', now)?.date.getTime(), at(2026, 10, 2, 21, 30));
});
test('in 2 hours', () => {
  assert.equal(parseWhen('in 2 hours', now)?.date.getTime(), at(2026, 10, 2, 17));
});
test('next monday defaults to 9 AM, no time flag', () => {
  const r = parseWhen('next monday', now)!;
  assert.equal(r.date.getTime(), at(2026, 10, 5, 9));
  assert.equal(r.hasTime, false);
});
test('same weekday means next week', () => {
  assert.equal(parseWhen('friday at 10am', now)?.date.getTime(), at(2026, 10, 9, 10));
});
test('october 20th at noon', () => {
  assert.equal(parseWhen('october 20th at noon', now)?.date.getTime(), at(2026, 10, 20, 12));
});
test('ISO date', () => {
  assert.equal(parseWhen('2026-10-05', now)?.date.getTime(), at(2026, 10, 5, 9));
});
test('past time today rolls to tomorrow', () => {
  assert.equal(parseWhen('at 2pm', now)?.date.getTime(), at(2026, 10, 3, 14));
});
test('garbage -> null', () => {
  assert.equal(parseWhen('banana', now), null);
});
test('formatWhen', () => {
  assert.equal(formatWhen(new Date(2026, 9, 3, 9), now), 'tomorrow at 9 AM');
  assert.equal(formatWhen(new Date(2026, 9, 2, 19, 30), now), 'today at 7:30 PM');
});
