import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResponseSchema, buildSystemPrompt } from '../src/core/ai/prompt.ts';

const tools = [
  {
    name: 'create_reminder',
    description: 'Set a reminder',
    args: {
      title: { type: 'string', description: 't', required: true },
      when: { type: 'string', description: 'w', required: true },
      repeat: { type: 'string', description: 'r', enum: ['none', 'daily'] },
    },
    readOnly: false,
    run: async () => ({ ok: true, summary: '', chip: '' }),
  },
  { name: 'get_battery', description: 'Battery', args: {}, readOnly: true, run: async () => ({ ok: true, summary: '', chip: '' }) },
] as const;

test('schema has one strict variant per tool plus a reply variant', () => {
  const s = buildResponseSchema(tools as never) as { anyOf: any[] };
  assert.equal(s.anyOf.length, 3);
  assert.deepEqual(s.anyOf[0].properties.tool, { const: 'create_reminder' });
  assert.equal(s.anyOf[0].additionalProperties, false);
  assert.deepEqual(s.anyOf[0].properties.arguments.required, ['title', 'when']);
  assert.deepEqual(s.anyOf[2].required, ['reply']);
});

test('system prompt carries time, tools, memories and name', () => {
  const p = buildSystemPrompt({
    tools: tools as never,
    now: new Date(2026, 9, 2, 15, 0),
    memories: ['Prefers morning meetings'],
    openTaskCount: 3,
    userName: 'Sam',
  });
  assert.match(p, /create_reminder\(title: string, when: string, repeat\?: none\|daily\)/);
  assert.match(p, /Prefers morning meetings/);
  assert.match(p, /\(Sam\) has 3 open task/);
  assert.match(p, /2026/);
});
