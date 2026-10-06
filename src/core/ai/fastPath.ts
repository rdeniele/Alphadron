/**
 * Instant, offline, rule-based intent recognition for the common commands.
 * Handles reminders/tasks/notes/memory/schedule questions without waking the LLM,
 * so they respond immediately and work even if no model is downloaded.
 * Returns null for anything it is not sure about -> the LLM handles it.
 * Pure (no React Native imports) so it is unit-testable.
 */

import { normalizeSpoken } from './spoken';

export type FastResult =
  | { kind: 'tool'; tool: string; args: Record<string, string | number | boolean> }
  | { kind: 'reply'; text: string };

const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';

const TIME_PATTERNS: RegExp[] = [
  /\bday after tomorrow\b/gi,
  /\b(?:tomorrow|today|tonight)\b/gi,
  /\bin\s+(?:an?|\d+)\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\b/gi,
  new RegExp(`\\b(?:next\\s+|this\\s+|on\\s+)?(?:${WEEKDAYS})\\b`, 'gi'),
  new RegExp(`\\b(?:on\\s+)?(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'),
  new RegExp(`\\b(?:on\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b`, 'gi'),
  /\b\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2})?\b/gi,
  /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)(?=\W|$)/gi,
  /\b(?:at|@)\s*\d{1,2}(?::\d{2})?(?=\W|$)/gi,
  /\b(?:at\s+)?(?:noon|midnight)\b/gi,
  /\b(?:in the\s+|this\s+)?(?:morning|afternoon|evening)\b/gi,
];

/** Pulls every time/date expression out of the text. */
export function extractWhen(text: string): { when: string; rest: string } {
  let rest = text;
  const found: string[] = [];
  for (const re of TIME_PATTERNS) {
    rest = rest.replace(re, m => {
      found.push(m.trim());
      return ' ';
    });
  }
  return { when: found.join(' '), rest };
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function cleanTitle(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^(?:to|that|about|for|:|,|-|me to|me about)\s+/i, '')
      .replace(/\s+(?:on|at|in|by|for|due|before|,|-|and|then)$/i, '')
      .replace(/^(?:on|at|by|due|before|and|then)\s+/i, '')
      .replace(/[\s.,!?]+$/, '')
      .trim();
  }
  return cap(t);
}

function stripRepeat(s: string): { rest: string; repeat: 'daily' | 'weekly' | null } {
  let repeat: 'daily' | 'weekly' | null = null;
  const rest = s
    .replace(/\b(?:every\s?day|daily|each day)\b/gi, () => {
      repeat = 'daily';
      return ' ';
    })
    .replace(new RegExp(`\\b(?:every week|weekly|every (?:${WEEKDAYS}))\\b`, 'gi'), () => {
      repeat = 'weekly';
      return ' ';
    });
  return { rest, repeat };
}

const REMIND = /^\s*(?:(?:hey|hi|ok|okay)[, ]+)?(?:alphadex[, ]+)?(?:please[, ]+)?(?:(?:can|could|would) you\s+)?(?:remind me|set (?:me )?(?:a |an )?(?:reminder|alarm)|add (?:a )?reminder|create (?:a )?reminder|reminder)\b(.*)$/i;
const ADD_TASK = /^\s*(?:please[, ]+)?(?:add|create|new|make)\s+(?:a |an |new )?(?:task|to-?do|todo)\b[:\s]*(.*)$/i;
const ADD_NOTE = /^\s*(?:please[, ]+)?(?:note(?: down)?|add (?:a )?note|take (?:a )?note|create (?:a )?note|write (?:this |that )?down)\b[:,\s]*(.+)$/i;
const REMEMBER = /^\s*(?:please[, ]+)?remember(?: that)?[:,\s]+(.+)$/i;
const CANCEL_REMINDER = /^\s*(?:please[, ]+)?(?:cancel|delete|remove)\s+(?:the |my )?reminder(?:\s+(?:to|about|for))?\s*(.*)$/i;
const COMPLETE_A = /^\s*(?:please[, ]+)?(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)\s*$/i;
const COMPLETE_B = /^\s*(?:please[, ]+)?(?:complete|finish|i (?:finished|completed|did)|done with)\s+(?:the\s+)?(?:task\s+)?(.+)$/i;

const SCHEDULE_Q = /\b(plans?|schedule|agenda|calendar|what do i have|what(?:'s| is) on|what am i doing|am i free|am i busy|anything (?:on|planned|scheduled))\b/i;
const QUESTIONISH = /\b(what|show|list|tell|any|do i|have i|how many|how|which|check|whats|what's)\b|\?$/i;
const TASKS_Q = /\b(tasks?|to-?dos?|todo list)\b/i;
const REMINDERS_Q = /\breminders?\b/i;
const FOCUS_Q = /\bwhat should i (?:work on|do|focus on|tackle)\b|\bwhat(?:'s| is) (?:most )?(?:important|next|urgent)\b/i;
const TIME_Q = /\bwhat(?:'s| is)? the time\b|\bwhat time is it\b|\bcurrent time\b|\bwhat(?:'s| is)? (?:today'?s |the )?date\b|\bwhat day is (?:it|today)\b/i;
const BATTERY_Q = /\bbattery\b/i;

export function fastPath(input: string): FastResult | null {
  const text = normalizeSpoken(input);
  if (!text || text.length > 400) {
    return null;
  }

  // ---- Create reminder ----
  const rm = text.match(REMIND);
  if (rm) {
    const { rest: noRepeat, repeat } = stripRepeat(rm[1]);
    const { when, rest } = extractWhen(noRepeat);
    const title = cleanTitle(rest);
    if (!title) {
      return { kind: 'reply', text: 'What should I remind you about?' };
    }
    if (!when) {
      return {
        kind: 'reply',
        text: `When should I remind you to ${title.charAt(0).toLowerCase() + title.slice(1)}? For example: "tomorrow at 9 AM".`,
      };
    }
    return {
      kind: 'tool',
      tool: 'create_reminder',
      args: { title, when, ...(repeat ? { repeat } : {}) },
    };
  }

  // ---- Create task ----
  const at = text.match(ADD_TASK);
  if (at) {
    const { when, rest } = extractWhen(at[1]);
    const title = cleanTitle(rest);
    if (!title) {
      return { kind: 'reply', text: 'What is the task?' };
    }
    return { kind: 'tool', tool: 'create_task', args: { title, ...(when ? { due_date: when } : {}) } };
  }

  // ---- Notes & memory ----
  const an = text.match(ADD_NOTE);
  if (an && an[1].trim().length > 1) {
    return { kind: 'tool', tool: 'create_note', args: { body: cap(an[1].trim()) } };
  }
  const mem = text.match(REMEMBER);
  if (mem && mem[1].trim().length > 2) {
    return { kind: 'tool', tool: 'save_memory', args: { content: cap(mem[1].trim().replace(/[.!]+$/, '')) } };
  }

  // ---- Cancel / complete ----
  const cr = text.match(CANCEL_REMINDER);
  if (cr && cr[1].trim()) {
    return { kind: 'tool', tool: 'cancel_reminder', args: { title: cr[1].trim() } };
  }
  const cm = text.match(COMPLETE_A) || text.match(COMPLETE_B);
  if (cm && cm[1].trim() && !/^(it|that|this)$/i.test(cm[1].trim())) {
    return { kind: 'tool', tool: 'complete_task', args: { title: cm[1].trim() } };
  }

  // ---- Questions about the user's own data ----
  if (FOCUS_Q.test(text)) {
    return { kind: 'tool', tool: 'suggest_focus', args: {} };
  }
  if (TIME_Q.test(text)) {
    return { kind: 'tool', tool: 'get_current_time', args: {} };
  }
  if (BATTERY_Q.test(text) && QUESTIONISH.test(text)) {
    return { kind: 'tool', tool: 'get_battery', args: {} };
  }
  if (SCHEDULE_Q.test(text) && QUESTIONISH.test(text)) {
    const { when } = extractWhen(text);
    return { kind: 'tool', tool: 'get_schedule', args: { when: when || 'today' } };
  }
  if (REMINDERS_Q.test(text) && QUESTIONISH.test(text)) {
    return { kind: 'tool', tool: 'list_reminders', args: {} };
  }
  if (TASKS_Q.test(text) && QUESTIONISH.test(text)) {
    const done = /\b(done|completed|finished)\b/i.test(text);
    return { kind: 'tool', tool: 'list_tasks', args: { status: done ? 'done' : 'open' } };
  }

  return null;
}

/**
 * True when a model reply claims an action was done (so we can detect hallucinated
 * "Done, I'll remind you" answers where no tool was actually called).
 */
export function claimsAction(reply: string): boolean {
  return /\b(i'?ll remind|i will remind|reminder (?:is |has been )?(?:set|created|added)|i'?ve (?:set|added|created|saved|scheduled)|(?:task|note|event) (?:is |has been )?(?:added|created|saved)|i (?:added|created|saved|scheduled|set))\b/i.test(
    reply,
  );
}
