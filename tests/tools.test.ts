import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArgs, argsToJsonSchema } from '../src/core/tools/schema.ts';
import { looksSensitive } from '../src/core/memory/sensitive.ts';
import { parseModelAction, extractJson } from '../src/core/ai/parseOutput.ts';

const schema = {
  title: { type: 'string', description: 't', required: true },
  priority: { type: 'number', description: 'p' },
  status: { type: 'string', description: 's', enum: ['open', 'done'] },
} as const;

test('valid args pass, strings trimmed', () => {
  const r = validateArgs(schema, { title: '  Finish proposal ', priority: 1 });
  assert.deepEqual(r, { ok: true, args: { title: 'Finish proposal', priority: 1 } });
});
test('missing required fails', () => {
  assert.equal(validateArgs(schema, {}).ok, false);
});
test('unknown argument rejected (no smuggling extra fields)', () => {
  const r = validateArgs(schema, { title: 'x', command: 'rm -rf /' });
  assert.equal(r.ok, false);
});
test('number coerced from string', () => {
  const r = validateArgs(schema, { title: 'x', priority: '2' });
  assert.equal(r.ok && r.args.priority, 2);
});
test('enum enforced', () => {
  assert.equal(validateArgs(schema, { title: 'x', status: 'weird' }).ok, false);
});
test('non-object args rejected', () => {
  assert.equal(validateArgs(schema, 'rm').ok, false);
  assert.equal(validateArgs(schema, [1]).ok, false);
});
test('json schema', () => {
  const j = argsToJsonSchema(schema) as { required: string[]; additionalProperties: boolean };
  assert.deepEqual(j.required, ['title']);
  assert.equal(j.additionalProperties, false);
});
test('sensitive detection', () => {
  assert.equal(looksSensitive('my wifi password is hunter2'), true);
  assert.equal(looksSensitive('card 4111 1111 1111 1111'), true);
  assert.equal(looksSensitive('I prefer dark mode'), false);
  assert.equal(looksSensitive('My birthday is March 3'), false);
});
test('parse tool action', () => {
  const a = parseModelAction('{"tool":"create_task","arguments":{"title":"Finish proposal"}}');
  assert.deepEqual(a, { kind: 'tool', tool: 'create_task', arguments: { title: 'Finish proposal' } });
});
test('parse reply with think block and fences', () => {
  const a = parseModelAction('<think>hmm</think>\n```json\n{"reply":"Hi {there}"}\n```');
  assert.deepEqual(a, { kind: 'reply', reply: 'Hi {there}' });
});
test('garbage -> null', () => {
  assert.equal(parseModelAction('no json here'), null);
  assert.equal(extractJson('{"a":'), null);
});
