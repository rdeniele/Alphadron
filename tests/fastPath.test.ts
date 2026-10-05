import test from 'node:test';
import assert from 'node:assert/strict';
import { fastPath, extractWhen, claimsAction } from '../src/core/ai/fastPath.ts';

const tool = (s: string) => {
  const r = fastPath(s);
  assert.equal(r?.kind, 'tool', `expected tool for: ${s} -> ${JSON.stringify(r)}`);
  return r as { kind: 'tool'; tool: string; args: Record<string, unknown> };
};

test('the MVP sentence', () => {
  const r = tool('Remind me tomorrow at 9 AM to work on my project.');
  assert.equal(r.tool, 'create_reminder');
  assert.equal(r.args.title, 'Work on my project');
  assert.match(String(r.args.when), /tomorrow/i);
  assert.match(String(r.args.when), /9 AM/i);
});
test('voice variant with Alphadex prefix', () => {
  const r = tool('Alphadex, remind me tomorrow at 9 AM to work on my project');
  assert.equal(r.args.title, 'Work on my project');
});
test('time after title', () => {
  const r = tool('remind me to call John at 7');
  assert.equal(r.args.title, 'Call John');
  assert.equal(r.args.when, 'at 7');
});
test('relative time', () => {
  const r = tool('remind me in 2 hours to stretch');
  assert.equal(r.args.title, 'Stretch');
  assert.equal(r.args.when, 'in 2 hours');
});
test('repeat', () => {
  const r = tool('remind me every day at 8am to take vitamins');
  assert.equal(r.args.repeat, 'daily');
  assert.equal(r.args.title, 'Take vitamins');
});
test('set a reminder for ... to ...', () => {
  const r = tool('set a reminder for friday at 3pm to submit the report');
  assert.equal(r.args.title, 'Submit the report');
  assert.match(String(r.args.when), /friday/i);
});
test('reminder without time asks', () => {
  const r = fastPath('remind me to buy milk');
  assert.equal(r?.kind, 'reply');
  assert.match((r as { text: string }).text, /When should I remind you/);
});
test('add task with due', () => {
  const r = tool('add a task finish proposal by friday');
  assert.equal(r.tool, 'create_task');
  assert.equal(r.args.title, 'Finish proposal');
  assert.match(String(r.args.due_date), /friday/i);
});
test('add task without due', () => {
  const r = tool('add task: buy groceries');
  assert.equal(r.args.title, 'Buy groceries');
  assert.equal(r.args.due_date, undefined);
});
test('note + remember', () => {
  assert.equal(tool('note: call the dentist about the invoice').tool, 'create_note');
  const m = tool('remember that my birthday is March 3');
  assert.equal(m.tool, 'save_memory');
  assert.equal(m.args.content, 'My birthday is March 3');
});
test('schedule questions', () => {
  const a = tool('What do I have tomorrow?');
  assert.equal(a.tool, 'get_schedule');
  assert.equal(a.args.when, 'tomorrow');
  assert.equal(tool('what are my plans tomorrow').args.when, 'tomorrow');
  assert.equal(tool("what's on my schedule today").args.when, 'today');
  assert.equal(tool('what is my agenda').args.when, 'today');
});
test('tasks / reminders / focus / time / battery', () => {
  assert.equal(tool('what tasks do I have').tool, 'list_tasks');
  assert.equal(tool('show my reminders').tool, 'list_reminders');
  assert.equal(tool('What should I work on today?').tool, 'suggest_focus');
  assert.equal(tool('what time is it').tool, 'get_current_time');
  assert.equal(tool("how's my battery").tool, 'get_battery');
});
test('complete + cancel', () => {
  assert.equal(tool('mark finish proposal as done').args.title, 'finish proposal');
  assert.equal(tool('cancel the reminder about john').tool, 'cancel_reminder');
});
test('open-ended chat falls through to the LLM', () => {
  assert.equal(fastPath('how do I stay focused when studying'), null);
  assert.equal(fastPath('tell me a joke'), null);
  assert.equal(fastPath('I have a meeting plan to discuss with the team'), null);
});
test('extractWhen leaves the title', () => {
  const { when, rest } = extractWhen('call mom tomorrow at 6:30 pm please');
  assert.match(when, /tomorrow/);
  assert.match(when, /6:30 pm/);
  assert.equal(rest.replace(/\s+/g, ' ').trim(), 'call mom please');
});
test('claimsAction detects hallucinated completion', () => {
  assert.equal(claimsAction("Done. I'll remind you tomorrow at 9 AM."), true);
  assert.equal(claimsAction("I've added the task."), true);
  assert.equal(claimsAction('Sure, here is a tip for focus.'), false);
});
