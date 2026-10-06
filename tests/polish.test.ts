import test from 'node:test';
import assert from 'node:assert/strict';
import { polishReply } from '../src/core/ai/polish.ts';

test('em and en dashes are removed from replies', () => {
  assert.equal(polishReply('Sure — I can do that.'), 'Sure, I can do that.');
  assert.equal(polishReply('Work 9–5 on weekdays'), 'Work 9-5 on weekdays');
  assert.equal(polishReply('Sounds good—let me know.'), 'Sounds good, let me know.');
  assert.equal(polishReply('Plain text stays the same.'), 'Plain text stays the same.');
  assert.ok(!/[—–]/.test(polishReply('a — b – c — d')));
});
