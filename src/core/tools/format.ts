/**
 * Turns read-tool results into readable text, deterministically (no LLM).
 * Fast, offline and can't invent anything that isn't in the database.
 */

interface ScheduleItem {
  kind: 'reminder' | 'event' | 'task';
  title: string;
  time?: string;
}

interface ScheduleDay {
  label: string;
  items: ScheduleItem[];
}

const bullet = (s: string) => `• ${s}`;

function item(i: ScheduleItem): string {
  return bullet(i.time ? `${i.time}: ${i.title}` : `${i.title} (task due)`);
}

/** "today" -> "today", "this week" -> "this week", a date -> "for Fri, Oct 9" */
const forLabel = (label: string) => (/^(today|tomorrow)$/.test(label) ? label : `for ${label}`);

export function formatReadResult(tool: string, data: unknown): string | null {
  switch (tool) {
    case 'get_schedule': {
      const d = data as { label: string; days: ScheduleDay[]; overdue: string[] };
      const lines: string[] = [];
      const withItems = d.days.filter(x => x.items.length);
      if (!withItems.length) {
        lines.push(`You have nothing planned ${forLabel(d.label)}.`);
      } else if (d.days.length === 1) {
        lines.push(`Here's ${d.label}:`, ...withItems[0].items.map(item));
      } else {
        lines.push(`Here's ${d.label}:`);
        for (const day of withItems) {
          lines.push('', `${day.label.charAt(0).toUpperCase() + day.label.slice(1)}:`, ...day.items.map(item));
        }
      }
      if (d.overdue.length) {
        lines.push('', 'Overdue:', ...d.overdue.map(bullet));
      }
      return lines.join('\n');
    }
    case 'list_tasks': {
      const d = data as { scope: string | null; items: { title: string; due: string | null; overdue: boolean }[] };
      if (!d.items.length) {
        return d.scope ? `You have no tasks due ${d.scope === 'today' || d.scope === 'tomorrow' ? d.scope : 'for ' + d.scope}.` : 'You have no tasks in that list.';
      }
      const head = d.scope
        ? `${d.items.length} task${d.items.length === 1 ? '' : 's'} due ${d.scope === 'today' || d.scope === 'tomorrow' ? d.scope : d.scope}:`
        : `${d.items.length} task${d.items.length === 1 ? '' : 's'}:`;
      return [
        head,
        ...d.items.map(t => bullet(t.due ? `${t.title} (${t.overdue ? 'overdue, was due' : 'due'} ${t.due})` : t.title)),
      ].join('\n');
    }
    case 'list_reminders': {
      const list = data as { title: string; when: string }[];
      if (!list.length) {
        return 'You have no upcoming reminders.';
      }
      return ['Upcoming reminders:', ...list.map(r => bullet(`${r.when}: ${r.title}`))].join('\n');
    }
    case 'suggest_focus': {
      const d = data as { overdue: string[]; today: string[]; next: string[]; openCount: number };
      if (!d.openCount && !d.today.length) {
        return "Nothing is pending. You're all clear. Enjoy it, or add a task to plan ahead.";
      }
      const lines: string[] = [];
      if (d.overdue.length) {
        lines.push('Start with what is overdue:', ...d.overdue.map(bullet));
      }
      if (d.today.length) {
        lines.push(...(lines.length ? [''] : []), 'Due today:', ...d.today.map(bullet));
      }
      if (d.next.length) {
        lines.push(...(lines.length ? [''] : []), d.overdue.length || d.today.length ? 'Then:' : 'Top of your list:', ...d.next.map(bullet));
      }
      return lines.join('\n');
    }
    case 'search_notes': {
      const list = data as { title: string | null; body: string }[];
      if (!list.length) {
        return "I couldn't find any notes about that.";
      }
      return list.map(n => bullet(n.title ? `${n.title}: ${n.body}` : n.body)).join('\n');
    }
    case 'search_memory': {
      const list = data as string[];
      return list.length ? list.map(bullet).join('\n') : "I don't have anything remembered about that.";
    }
    default:
      return null;
  }
}
