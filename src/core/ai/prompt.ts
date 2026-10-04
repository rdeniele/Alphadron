import { argsToJsonSchema, type ArgsSchema } from '../tools/schema';
import type { Tool } from '../tools/types';

function argLine(name: string, schema: ArgsSchema) {
  const parts = Object.entries(schema).map(([k, s]) => {
    const t = s.enum ? s.enum.join('|') : s.type;
    return `${k}${s.required ? '' : '?'}: ${t}`;
  });
  return `${name}(${parts.join(', ')})`;
}

/** Grammar-constrained schema: exactly one tool call, or a plain reply. */
export function buildResponseSchema(tools: Tool[]): object {
  const variants: object[] = tools.map(t => ({
    type: 'object',
    properties: { tool: { const: t.name }, arguments: argsToJsonSchema(t.args) },
    required: ['tool', 'arguments'],
    additionalProperties: false,
  }));
  variants.push({
    type: 'object',
    properties: { reply: { type: 'string' } },
    required: ['reply'],
    additionalProperties: false,
  });
  return { anyOf: variants };
}

export function buildSystemPrompt(opts: {
  tools: Tool[];
  now: Date;
  memories: string[];
  openTaskCount: number;
}): string {
  const date = opts.now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = opts.now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const toolLines = opts.tools.map(t => `- ${argLine(t.name, t.args)}: ${t.description}`).join('\n');
  const mem = opts.memories.length
    ? `\nThings the user asked you to remember:\n${opts.memories.map(m => `- ${m}`).join('\n')}\n`
    : '';
  return `You are Alphadron, a private personal assistant running fully offline on the user's phone. Current time: ${date}, ${time}. The user has ${opts.openTaskCount} open task(s).
${mem}
You reply with ONE JSON object and nothing else:
- To perform an action: {"tool": "<name>", "arguments": {...}}
- To just talk: {"reply": "<short answer>"}

Rules:
- Use a tool whenever the user asks to create, change, check or find something. Never claim to have done something without calling its tool.
- For times and dates, pass the user's own words (e.g. "tomorrow at 9 AM") in "when"/"due_date". Do not compute dates yourself.
- "What do I have tomorrow/today?" -> get_schedule. "What should I work on?" -> list_tasks.
- Only call save_memory when the user asks you to remember something or states a lasting preference or fact.
- Keep replies to 1-2 short sentences. If something is unclear, ask a short question using reply.

Tools:
${toolLines}`;
}
