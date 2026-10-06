import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpoken } from '../src/core/ai/spoken.ts';
import { fastPath } from '../src/core/ai/fastPath.ts';
import { parseWhen } from '../src/core/scheduling/dateParse.ts';

test('spoken numbers and times are normalised', () => {
  assert.equal(normalizeSpoken('remind me at nine a.m.'), 'remind me at 9 am');
  assert.equal(normalizeSpoken('at seven thirty pm'), 'at 7:30 pm');
  assert.equal(normalizeSpoken('in half an hour'), 'in 30 minutes');
  assert.equal(normalizeSpoken('in two hours'), 'in 2 hours');
  assert.equal(normalizeSpoken("at 9 o'clock"), 'at 9');
  assert.equal(normalizeSpoken('Alpha Dex, add a task'), 'add a task');
  assert.equal(normalizeSpoken('call two people'), 'call two people');
});
test('spoken commands reach the right tool with clean titles', () => {
  const r = fastPath('Remind me tomorrow at nine a.m. to work on my project.') as { tool: string; args: Record<string, string> };
  assert.equal(r.tool, 'create_reminder');
  assert.equal(r.args.title, 'Work on my project');
  const q = fastPath('Alpha decks remind me in thirty minutes to check the oven') as { args: Record<string, string> };
  assert.equal(q.args.title, 'Check the oven');
  assert.equal(q.args.when, 'in 30 minutes');
});
test('tonight / morning pick the right half of the day', () => {
  const early = new Date(2026, 9, 2, 6, 0);
  assert.equal(parseWhen('tonight at 8', early)?.date.getHours(), 20);
  assert.equal(parseWhen('tomorrow morning at 9', early)?.date.getHours(), 9);
});
