import { argsToJsonSchema, type ArgsSchema } from '../tools/schema';
import type { Tool } from '../tools/types';

function argLine(name: string, schema: ArgsSchema) {
  const parts = Object.entries(schema).map(([k, s]) => {
    const t = s.enum ? s.enum.join('|') : s.type;
    return `${k}${s.required ? '' : '?'}: ${t}`;
  });
  return `${name}(${parts.join(', ')})`;
}

const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0].replace(/\.$/, '');

/** Always offered: the actions people ask for most. */
const CORE_TOOLS = ['create_reminder', 'create_task', 'create_note', 'get_schedule', 'save_memory'];

/** Extra tools are offered only when the request hints at them (fewer choices = fewer mistakes). */
const HINTS: [RegExp, string[]][] = [
  [/\b(battery|charge|charging|power)\b/i, ['get_battery']],
  [/\b(device|phone|model|android|ram|memory size|storage)\b/i, ['get_device_info']],
  [/\b(open|launch|start|go to)\b/i, ['open_app', 'open_url']],
  [/\b(https?:|www\.|link|website|url)\b/i, ['open_url']],
  [/\b(notify|notification|alert me)\b/i, ['send_notification']],
  [/\b(time|date|day|clock|today'?s)\b/i, ['get_current_time']],
  [/\b(find|search|look up|look for|did i (?:write|note|save))\b/i, ['search_notes', 'search_memory']],
  [/\b(remember|recall|what do you know|did i tell you)\b/i, ['search_memory']],
  [/\b(done|finish|finished|complete|completed|check off|tick)\b/i, ['complete_task']],
  [/\b(cancel|delete|remove|stop)\b.*\b(reminder|alarm)\b/i, ['cancel_reminder']],
  [/\b(tasks?|to-?dos?)\b/i, ['list_tasks', 'complete_task']],
  [/\b(reminders?)\b/i, ['list_reminders', 'cancel_reminder']],
  [/\b(meeting|appointment|event|calendar)\b/i, ['create_schedule']],
  [/\b(focus|work on|prioriti[sz]e|what next|what should)\b/i, ['suggest_focus']],
];

export function selectTools(all: Tool[], userText: string): Tool[] {
  const want = new Set(CORE_TOOLS);
  for (const [re, names] of HINTS) {
    if (re.test(userText)) {
      names.forEach(n => want.add(n));
    }
  }
  return all.filter(t => want.has(t.name));
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

const EXAMPLES = `Examples:
User: remind me to call mom tomorrow at 6 pm
{"tool":"create_reminder","arguments":{"title":"Call mom","when":"tomorrow at 6 pm"}}
User: add buy milk to my tasks
{"tool":"create_task","arguments":{"title":"Buy milk"}}
User: what's the plan for friday?
{"tool":"get_schedule","arguments":{"when":"friday"}}
User: note that the router is in the hall closet
{"tool":"create_note","arguments":{"body":"The router is in the hall closet"}}
User: remember I prefer morning meetings
{"tool":"save_memory","arguments":{"content":"Prefers morning meetings","category":"preference"}}
User: any tips to focus while studying?
{"reply":"Try 25-minute focus blocks with 5-minute breaks, and silence your phone."}`;

/**
 * Static instructions + examples come first so the model can reuse its cached
 * prefix between messages; the changing context (time, memories) goes last.
 */
export function buildSystemPrompt(opts: {
  tools: Tool[];
  now: Date;
  memories: string[];
  openTaskCount: number;
  userName?: string | null;
}): string {
  const date = opts.now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = opts.now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const toolLines = opts.tools.map(t => `- ${argLine(t.name, t.args)}: ${firstSentence(t.description)}`).join('\n');
  const mem = opts.memories.length ? `\nRemembered: ${opts.memories.join('; ')}` : '';

  return `You are Alphadex, an offline personal assistant on the user's phone. Reply with exactly ONE JSON object:
{"tool":"NAME","arguments":{...}}  to act, or  {"reply":"..."}  to talk.

Rules:
1. To create, add, remind, note, remember, complete or cancel anything, or to answer about the user's own tasks/reminders/schedule/notes, you MUST call a tool.
2. Put times and dates in "when"/"due_date" exactly as the user said them. Never calculate dates.
3. Otherwise answer in one or two short sentences with reply.
4. Never say you did something unless you called the tool.

Tools:
${toolLines}

${EXAMPLES}

Now: ${date}, ${time}. User${opts.userName ? ': ' + opts.userName : ''}. Open tasks: ${opts.openTaskCount}.${mem}`;
}
