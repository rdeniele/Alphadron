import test from 'node:test';
import assert from 'node:assert/strict';
import { groundArgs, deriveTitle } from '../src/core/ai/ground.ts';
import { selectTools } from '../src/core/ai/prompt.ts';

test('the user\'s time overrides a wrong model paraphrase', () => {
  const g = groundArgs(
    'create_reminder',
    { title: 'Work on project', when: 'next week' },
    'Remind me tomorrow at 9 AM to work on my project',
  );
  assert.match(String(g.when), /tomorrow/i);
  assert.match(String(g.when), /9 AM/i);
  assert.equal(g.title, 'Work on project');
});
test('missing title is derived from the sentence', () => {
  const g = groundArgs('create_reminder', { when: 'x' }, 'remind me to call John at 7');
  assert.equal(g.title, 'Call John');
  assert.equal(g.when, 'at 7');
});
test('title that just echoes the sentence is replaced', () => {
  const text = 'remind me to pay rent tomorrow at 8am';
  const g = groundArgs('create_reminder', { title: text, when: 'tomorrow' }, text);
  assert.equal(g.title, 'Pay rent');
});
test('task due date + priority grounded', () => {
  const g = groundArgs('create_task', { title: 'Finish proposal' }, 'add an urgent task finish proposal by friday');
  assert.match(String(g.due_date), /friday/i);
  assert.equal(g.priority, 'high');
});
test('get_schedule day comes from the user text', () => {
  assert.equal(groundArgs('get_schedule', { when: 'today' }, 'what about tomorrow').when, 'tomorrow');
  assert.equal(groundArgs('get_schedule', {}, 'anything planned').when, 'today');
});
test('note body falls back to the sentence', () => {
  assert.equal(groundArgs('create_note', {}, 'note that the router is in the closet').body, 'That the router is in the closet'.replace('That', 'that'));
});
test('deriveTitle', () => {
  assert.equal(deriveTitle('add a reminder to water plants every day at 8am'.replace('every day ', '')), 'Water plants');
});

const mk = (name: string) => ({ name, description: '', args: {}, readOnly: true, run: async () => ({ ok: true, summary: '', chip: '' }) });
const ALL = ['create_reminder', 'create_task', 'create_note', 'get_schedule', 'save_memory', 'get_battery', 'open_app', 'open_url', 'list_tasks', 'complete_task', 'suggest_focus', 'get_current_time'].map(mk);

test('core tools always offered; extras only when hinted', () => {
  const plain = selectTools(ALL as never, 'tell me a joke').map(t => t.name);
  assert.deepEqual(plain, ['create_reminder', 'create_task', 'create_note', 'get_schedule', 'save_memory']);
  const bat = selectTools(ALL as never, 'how much battery do I have').map(t => t.name);
  assert.ok(bat.includes('get_battery'));
  assert.ok(!bat.includes('open_app'));
  const open = selectTools(ALL as never, 'open https://example.com').map(t => t.name);
  assert.ok(open.includes('open_url'));
});
