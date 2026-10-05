/**
 * Turns read-tool results into readable text, deterministically (no LLM).
 * Fast, offline and can't invent anything that isn't in the database.
 */

interface ScheduleItem {
  kind: 'reminder' | 'event' | 'task';
  title: string;
  time?: string;
}

const bullet = (s: string) => `• ${s}`;

function item(i: ScheduleItem): string {
  const label = i.kind === 'task' ? 'Task' : i.kind === 'reminder' ? 'Reminder' : 'Event';
  return bullet(i.time ? `${i.time} — ${i.title}` : `${i.title}  (${label.toLowerCase()} due)`);
}

export function formatReadResult(tool: string, data: unknown): string | null {
  switch (tool) {
    case 'get_schedule': {
      const d = data as { label: string; items: ScheduleItem[]; overdue: string[] };
      const lines: string[] = [];
      if (d.items.length) {
        lines.push(`Here's ${d.label}:`, ...d.items.map(item));
      } else {
        lines.push(`You have nothing planned ${d.label === 'today' || d.label === 'tomorrow' ? d.label : 'for ' + d.label}.`);
      }
      if (d.overdue.length) {
        lines.push('', 'Overdue:', ...d.overdue.map(bullet));
      }
      return lines.join('\n');
    }
    case 'list_tasks': {
      const list = data as { title: string; due: string | null; status: string }[];
      if (!list.length) {
        return 'You have no tasks in that list.';
      }
      return [
        `${list.length} task${list.length === 1 ? '' : 's'}:`,
        ...list.map(t => bullet(t.due ? `${t.title}  (due ${t.due})` : t.title)),
      ].join('\n');
    }
    case 'list_reminders': {
      const list = data as { title: string; when: string }[];
      if (!list.length) {
        return 'You have no upcoming reminders.';
      }
      return ['Upcoming reminders:', ...list.map(r => bullet(`${r.when} — ${r.title}`))].join('\n');
    }
    case 'suggest_focus': {
      const d = data as { overdue: string[]; today: string[]; next: string[]; openCount: number };
      if (!d.openCount && !d.today.length) {
        return "Nothing is pending. You're all clear — enjoy it, or add a task to plan ahead.";
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
