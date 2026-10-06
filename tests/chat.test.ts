import test from 'node:test';
import assert from 'node:assert/strict';
import { smallTalk } from '../src/core/ai/smallTalk.ts';
import { fastPath, resolvePending } from '../src/core/ai/fastPath.ts';

const first = <T,>(items: T[]) => items[0];
const opts = { name: 'Sam', hour: 9, pick: first };

test('greetings are friendly, use the name and ask a question', () => {
  const r = smallTalk('Hey!', opts)!;
  assert.match(r, /^Hey, Sam!/);
  assert.match(r, /\?$/);
  assert.match(smallTalk('good morning', opts)!, /^Good morning, Sam!/);
});
test('small talk: thanks, how are you, who are you, help, bye', () => {
  assert.match(smallTalk('thank you', opts)!, /Anytime/);
  assert.match(smallTalk("how are you?", opts)!, /how's your day/i);
  assert.match(smallTalk("who are you", opts)!, /private assistant/);
  assert.match(smallTalk('what can you do', opts)!, /Reminders/);
  assert.match(smallTalk('bye', opts)!, /Bye/);
});
test('feelings get an empathetic reply', () => {
  assert.match(smallTalk("I'm stressed", opts)!, /plate/);
  assert.match(smallTalk('i am so tired', opts)!, /break/);
});
test('real requests are never swallowed by small talk', () => {
  assert.equal(smallTalk('remind me to call mom tomorrow', opts), null);
  assert.equal(smallTalk('what do I have tomorrow', opts), null);
  assert.equal(smallTalk('hey remind me to buy milk', opts), null);
});

test('asking for a missing time keeps the question pending, and the answer completes it', () => {
  const ask = fastPath('remind me to buy milk');
  assert.equal(ask?.kind, 'reply');
  const pending = (ask as { pending?: never }).pending;
  assert.ok(pending);
  const done = resolvePending(pending, 'tomorrow at five pm');
  assert.deepEqual(done, { kind: 'tool', tool: 'create_reminder', args: { title: 'Buy milk', when: 'tomorrow at 5 pm' } });
});
test('answer by voice wording works too', () => {
  const ask = fastPath('remind me to call the bank') as { pending: never };
  const done = resolvePending(ask.pending, 'at nine thirty tomorrow morning') as { args: Record<string, string> };
  assert.equal(done.args.title, 'Call the bank');
  assert.match(done.args.when, /9:30/);
});
test('missing title question then title', () => {
  const ask = fastPath('remind me tomorrow at 8am') as { pending: never; text: string };
  assert.match(ask.text, /remind you about/);
  const done = resolvePending(ask.pending, 'to water the plants') as { args: Record<string, string> };
  assert.equal(done.args.title, 'Water the plants');
  assert.match(done.args.when, /tomorrow/);
});
test('task without a title then title', () => {
  const ask = fastPath('add a task') as { pending: never };
  const done = resolvePending(ask.pending, 'finish the proposal by friday') as { args: Record<string, string> };
  assert.equal(done.args.title, 'Finish the proposal');
  assert.match(done.args.due_date, /friday/i);
});
test('cancel words drop the pending question; unrelated text is not an answer', () => {
  const ask = fastPath('remind me to buy milk') as { pending: never };
  assert.equal(resolvePending(ask.pending, 'never mind'), 'cancel');
  assert.equal(resolvePending(ask.pending, 'what is the weather like'), null);
});

test('the assistant can be greeted by either name', () => {
  assert.match(smallTalk('Hey Alphadron!', opts)!, /^Hey, Sam!/);
  assert.match(smallTalk('hello Alphadex', opts)!, /^Hey, Sam!/);
  assert.match(smallTalk('thanks Alphadron', opts)!, /Anytime/);
  assert.match(smallTalk("who are you", opts)!, /I'm Alphadron/);
});
