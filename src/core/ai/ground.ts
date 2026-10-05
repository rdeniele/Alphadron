/**
 * "Grounding": small models are good at choosing a tool but sloppy at copying
 * details. After the model picks a tool, the app re-derives the fragile fields
 * (times, dates, titles) from the user's own words and overrides the model.
 * Pure; unit-testable.
 */
import { cleanTitle, extractWhen } from './fastPath';

type Args = Record<string, unknown>;

const LEADING_COMMAND =
  /^\s*(?:(?:hey|hi|ok|okay)[, ]+)?(?:alphadex[, ]+)?(?:please[, ]+)?(?:(?:can|could|would) you\s+)?(?:remind me|set (?:me )?(?:a |an )?(?:reminder|alarm)|add (?:a |an )?(?:reminder|task|to-?do|todo|event|note)|create (?:a |an )?(?:reminder|task|to-?do|todo|event|note)|schedule(?: a| an)?|put|note(?: down)?|new (?:task|reminder|event|note))\b[:,\s]*/i;

/** Best-effort title from the raw user sentence (command words and times removed). */
export function deriveTitle(userText: string): string {
  const { rest } = extractWhen(userText.replace(LEADING_COMMAND, ''));
  return cleanTitle(rest);
}

const isBlank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

export function groundArgs(tool: string, args: Args, userText: string): Args {
  const out: Args = { ...args };
  const { when } = extractWhen(userText);

  switch (tool) {
    case 'create_reminder':
    case 'create_schedule': {
      if (when) {
        out.when = when; // the user's words beat the model's paraphrase
      }
      const title = typeof out.title === 'string' ? out.title.trim() : '';
      if (!title || title.toLowerCase() === userText.trim().toLowerCase()) {
        const d = deriveTitle(userText);
        if (d) {
          out.title = d;
        }
      }
      break;
    }
    case 'create_task': {
      if (when) {
        out.due_date = when;
      }
      if (isBlank(out.title)) {
        const d = deriveTitle(userText);
        if (d) {
          out.title = d;
        }
      }
      if (!out.priority && /\b(urgent|asap|important|high priority)\b/i.test(userText)) {
        out.priority = 'high';
      }
      break;
    }
    case 'get_schedule': {
      out.when = when || (typeof out.when === 'string' && out.when) || 'today';
      break;
    }
    case 'create_note': {
      if (isBlank(out.body)) {
        const d = userText.replace(LEADING_COMMAND, '').trim();
        if (d) {
          out.body = d;
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}
