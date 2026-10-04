/** Parses the model's structured output. Pure; unit-testable. */

export type ModelAction =
  | { kind: 'tool'; tool: string; arguments: unknown }
  | { kind: 'reply'; reply: string };

/** Strips Qwen3 <think> blocks and code fences, then extracts the first JSON object. */
export function extractJson(text: string): unknown | null {
  let s = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseModelAction(text: string): ModelAction | null {
  const obj = extractJson(text) as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  if (typeof obj.tool === 'string' && obj.tool) {
    return { kind: 'tool', tool: obj.tool, arguments: obj.arguments ?? {} };
  }
  if (typeof obj.reply === 'string') {
    return { kind: 'reply', reply: obj.reply };
  }
  return null;
}
