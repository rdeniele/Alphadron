import { dateOnlyDue, endOfLocalDay, formatDue, formatWhen, parseRange, parseWhen, startOfLocalDay } from '../scheduling/dateParse';
import { looksSensitive } from '../memory/sensitive';
import { SUPPORTED_APPS } from '../../platform/android/device';
import { cancelReminderNotification, cancelTaskAlert, scheduleEventAlert, scheduleReminder, syncTaskAlert } from '../reminders/scheduler';
import * as tasks from '../../database/repositories/tasksRepo';
import * as reminders from '../../database/repositories/remindersRepo';
import * as events from '../../database/repositories/eventsRepo';
import * as notes from '../../database/repositories/notesRepo';
import * as memories from '../../database/repositories/memoriesRepo';
import type { Tool, ToolResult } from './types';

const fail = (summary: string): ToolResult => ({ ok: false, summary, chip: 'Could not complete' });
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

function dayLabel(d: Date, now: Date): string {
  const diff = Math.round((startOfLocalDay(d) - startOfLocalDay(now)) / 86400000);
  if (diff === 0) {
    return 'today';
  }
  if (diff === 1) {
    return 'tomorrow';
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const PRIORITY: Record<string, number> = { high: 1, normal: 2, low: 3 };

export const TOOLS: Tool[] = [
  {
    name: 'create_task',
    description: 'Create a to-do task. due_date is optional (e.g. "friday", "2026-10-05").',
    args: {
      title: { type: 'string', description: 'task title', required: true, maxLength: 200 },
      description: { type: 'string', description: 'details' },
      due_date: { type: 'string', description: 'when it is due, natural language or ISO date', maxLength: 100 },
      priority: { type: 'string', description: 'priority', enum: ['high', 'normal', 'low'] },
    },
    readOnly: false,
    async run(a, ctx) {
      let dueAt: number | null = null;
      if (a.due_date) {
        const p = parseWhen(String(a.due_date), ctx.now);
        if (!p) {
          return fail(`I couldn't understand the due date "${a.due_date}".`);
        }
        // "by Friday" / "this week" / "today" have no time of day: store them as due that whole day.
        dueAt = p.hasTime ? p.date.getTime() : dateOnlyDue(p.date);
      }
      const t = await tasks.createTask({
        title: String(a.title),
        description: str(a.description),
        dueAt,
        priority: a.priority ? PRIORITY[String(a.priority)] : 2,
      });
      await syncTaskAlert(t).catch(() => undefined);
      const due = dueAt ? ` It's due ${formatDue(dueAt, ctx.now)}.` : '';
      return { ok: true, summary: `Added the task "${t.title}".${due}`, chip: 'Task created', data: t };
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as done. Give id or the task title.',
    args: {
      id: { type: 'number', description: 'task id' },
      title: { type: 'string', description: 'task title or part of it' },
    },
    readOnly: false,
    async run(a) {
      const t = await tasks.findOpenTask({ id: num(a.id), title: str(a.title) });
      if (!t) {
        return fail("I couldn't find a matching open task.");
      }
      await tasks.completeTask(t.id);
      await cancelTaskAlert(t.id);
      return { ok: true, summary: `Marked "${t.title}" as done.`, chip: 'Task completed', data: t };
    },
  },
  {
    name: 'list_tasks',
    description: 'List the user\'s tasks, optionally only those due in a timeframe like "today" or "this week".',
    args: {
      status: { type: 'string', description: 'which tasks', enum: ['open', 'done', 'all'] },
      when: { type: 'string', description: 'only tasks due then, e.g. "today", "this week"', maxLength: 100 },
    },
    readOnly: true,
    async run(a, ctx) {
      let list = await tasks.listTasks({ status: (a.status as 'open' | 'done' | 'all') ?? 'open' });
      const range = a.when ? parseRange(String(a.when), ctx.now) : null;
      if (range) {
        const startToday = startOfLocalDay(ctx.now);
        const includesToday = range.from <= startToday && startToday <= range.to;
        list = list.filter(
          t => t.dueAt !== null && ((t.dueAt >= range.from && t.dueAt <= range.to) || (includesToday && t.dueAt < startToday && t.status !== 'done')),
        );
      }
      const items = list.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        due: t.dueAt ? formatDue(t.dueAt, ctx.now) : null,
        overdue: t.status !== 'done' && t.dueAt !== null && t.dueAt < startOfLocalDay(ctx.now),
      }));
      return { ok: true, summary: `${list.length} task(s).`, chip: 'Tasks checked', data: { scope: range?.label ?? null, items } };
    },
  },
  {
    name: 'create_reminder',
    description: 'Set a reminder that fires a notification. "when" is the time phrase exactly as the user said it (e.g. "tomorrow at 9 AM").',
    args: {
      title: { type: 'string', description: 'what to be reminded about', required: true, maxLength: 200 },
      when: { type: 'string', description: 'time phrase, e.g. "tomorrow at 9 AM"', required: true, maxLength: 100 },
      message: { type: 'string', description: 'optional longer message' },
      repeat: { type: 'string', description: 'repeat rule', enum: ['none', 'daily', 'weekly'] },
    },
    readOnly: false,
    async run(a, ctx) {
      const p = parseWhen(String(a.when), ctx.now);
      if (!p) {
        return fail(`I couldn't understand the time "${a.when}". Try something like "tomorrow at 9 AM".`);
      }
      const repeat = a.repeat === 'daily' || a.repeat === 'weekly' ? a.repeat : null;
      if (!repeat && p.date.getTime() <= ctx.now.getTime()) {
        return fail('That time has already passed.');
      }
      const r = await reminders.createReminder({
        title: String(a.title),
        message: str(a.message),
        triggerAt: p.date.getTime(),
        repeatRule: repeat,
      });
      const scheduled = await scheduleReminder(r);
      const when = formatWhen(p.date, ctx.now);
      const warn = scheduled ? '' : ' (Notifications are turned off, so it will not alert you. Enable them in system settings.)';
      return {
        ok: true,
        summary: `Done. I'll remind you ${when}${repeat ? `, repeating ${repeat}` : ''}.${warn}`,
        chip: 'Reminder created',
        data: r,
      };
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel an upcoming reminder. Give id or the reminder title.',
    args: {
      id: { type: 'number', description: 'reminder id' },
      title: { type: 'string', description: 'reminder title or part of it' },
    },
    readOnly: false,
    async run(a) {
      const r = await reminders.findReminder({ id: num(a.id), title: str(a.title) });
      if (!r) {
        return fail("I couldn't find a matching reminder.");
      }
      await reminders.setReminderEnabled(r.id, false);
      await cancelReminderNotification(r.id);
      return { ok: true, summary: `Cancelled the reminder "${r.title}".`, chip: 'Reminder cancelled', data: r };
    },
  },
  {
    name: 'create_note',
    description: 'Save a note.',
    args: {
      title: { type: 'string', description: 'note title', maxLength: 200 },
      body: { type: 'string', description: 'note text', required: true },
    },
    readOnly: false,
    async run(a) {
      const n = await notes.createNote({ title: str(a.title), body: String(a.body) });
      return { ok: true, summary: 'Saved your note.', chip: 'Note saved', data: n };
    },
  },
  {
    name: 'search_notes',
    description: 'Search the user\'s notes by keywords.',
    args: { query: { type: 'string', description: 'keywords', required: true } },
    readOnly: true,
    async run(a) {
      const found = await notes.searchNotes(String(a.query));
      return {
        ok: true,
        summary: `${found.length} note(s) found.`,
        chip: 'Notes searched',
        data: found.map(n => ({ title: n.title, body: n.body.slice(0, 300) })),
      };
    },
  },
  {
    name: 'save_memory',
    description: 'Remember a fact about the user for the long term. Only when the user asks to remember something or states a lasting preference/fact.',
    args: {
      content: { type: 'string', description: 'the fact, phrased in third person or neutral', required: true, maxLength: 500 },
      category: { type: 'string', description: 'preference, fact, project, routine or other', enum: ['preference', 'fact', 'project', 'routine', 'other'] },
    },
    readOnly: false,
    async run(a, ctx) {
      if (!ctx.memoryEnabled) {
        return fail('Memory is turned off in Settings, so I did not save that.');
      }
      const content = String(a.content);
      const sensitive = looksSensitive(content);
      if (sensitive) {
        const ok = await ctx.confirm(`This looks sensitive:\n\n"${content}"\n\nSave it to permanent memory?`);
        if (!ok) {
          return { ok: false, summary: "Okay, I won't save that.", chip: 'Not saved' };
        }
      }
      const m = await memories.addMemory({ content, category: str(a.category), sensitive });
      return { ok: true, summary: "Got it, I'll remember that.", chip: 'Memory saved', data: m };
    },
  },
  {
    name: 'search_memory',
    description: 'Look up things the user told Alphadex to remember.',
    args: { query: { type: 'string', description: 'keywords', required: true } },
    readOnly: true,
    async run(a, ctx) {
      if (!ctx.memoryEnabled) {
        return { ok: true, summary: 'Memory is turned off.', chip: 'Memory off', data: [] };
      }
      const found = await memories.searchMemories(String(a.query));
      return { ok: true, summary: `${found.length} memory(ies).`, chip: 'Memory searched', data: found.map(m => m.content) };
    },
  },
  {
    name: 'get_schedule',
    description: 'Get what the user has on a given day: tasks due, reminders and events. "when" defaults to today (e.g. "tomorrow", "friday").',
    args: { when: { type: 'string', description: 'day phrase, e.g. "tomorrow"', maxLength: 100 } },
    readOnly: true,
    async run(a, ctx) {
      const phrase = a.when ? String(a.when) : 'today';
      const range = parseRange(phrase, ctx.now) ?? parseRange('today', ctx.now)!;
      const { from, to } = range;
      const startToday = startOfLocalDay(ctx.now);
      const includesToday = from <= startToday && startToday <= to;
      const [dueTasks, rems, evs, overdue] = await Promise.all([
        tasks.listTasks({ status: 'open', dueBefore: to }),
        reminders.listReminders({ from, to }),
        events.listEvents(from, to),
        includesToday ? tasks.listTasks({ status: 'open', dueBefore: startToday - 1 }) : Promise.resolve([]),
      ]);
      const time = (ms: number) => formatWhen(new Date(ms), ctx.now).replace(/^.* at /, '');

      // One entry per calendar day in the range (a single day for "today"/"tomorrow").
      const days = [];
      for (let i = 0; i < range.days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const dFrom = startOfLocalDay(d);
        const dTo = endOfLocalDay(d);
        const timed = [
          ...rems.filter(r => r.triggerAt >= dFrom && r.triggerAt <= dTo).map(r => ({ at: r.triggerAt, item: { kind: 'reminder' as const, title: r.title, time: time(r.triggerAt) } })),
          ...evs.filter(e => e.startsAt >= dFrom && e.startsAt <= dTo).map(e => ({ at: e.startsAt, item: { kind: 'event' as const, title: e.title, time: time(e.startsAt) } })),
        ]
          .sort((x, y) => x.at - y.at)
          .map(x => x.item);
        const taskItems = dueTasks
          .filter(t => t.dueAt !== null && t.dueAt >= dFrom && t.dueAt <= dTo)
          .map(t => ({ kind: 'task' as const, title: t.title }));
        days.push({ label: dayLabel(d, ctx.now), items: [...timed, ...taskItems] });
      }
      const data = {
        label: range.label,
        days,
        overdue: overdue.map(t => t.title),
      };
      return { ok: true, summary: 'Schedule retrieved.', chip: 'Schedule checked', data };
    },
  },
  {
    name: 'list_reminders',
    description: "List the user's upcoming reminders.",
    args: {},
    readOnly: true,
    async run(_a, ctx) {
      const list = await reminders.listReminders({ from: ctx.now.getTime() - 60000 });
      const data = list.map(r => ({ title: r.title, when: formatWhen(new Date(r.triggerAt), ctx.now) }));
      return { ok: true, summary: `${list.length} reminder(s).`, chip: 'Reminders checked', data };
    },
  },
  {
    name: 'suggest_focus',
    description: 'Suggest what the user should work on now, from their real tasks and schedule.',
    args: {},
    readOnly: true,
    async run(_a, ctx) {
      const from = startOfLocalDay(ctx.now);
      const to = endOfLocalDay(ctx.now);
      const open = await tasks.listTasks({ status: 'open' });
      const overdue = open.filter(t => t.dueAt !== null && t.dueAt < from).map(t => t.title);
      const today = open.filter(t => t.dueAt !== null && t.dueAt >= from && t.dueAt <= to).map(t => t.title);
      const next = open.filter(t => t.dueAt === null || t.dueAt > to).slice(0, 3).map(t => t.title);
      return {
        ok: true,
        summary: 'Focus suggestion.',
        chip: 'Plan suggested',
        data: { overdue, today, next, openCount: open.length },
      };
    },
  },
  {
    name: 'create_schedule',
    description: 'Add an event to the user\'s schedule/calendar at a specific time.',
    args: {
      title: { type: 'string', description: 'event title', required: true, maxLength: 200 },
      when: { type: 'string', description: 'time phrase, e.g. "friday at 2 PM"', required: true, maxLength: 100 },
      duration_minutes: { type: 'number', description: 'length in minutes' },
    },
    readOnly: false,
    async run(a, ctx) {
      const p = parseWhen(String(a.when), ctx.now);
      if (!p) {
        return fail(`I couldn't understand the time "${a.when}".`);
      }
      const dur = num(a.duration_minutes);
      const e = await events.createEvent({
        title: String(a.title),
        startsAt: p.date.getTime(),
        endsAt: dur ? p.date.getTime() + dur * 60000 : null,
      });
      await scheduleEventAlert(e).catch(() => undefined);
      return {
        ok: true,
        summary: `Added "${e.title}" to your schedule for ${formatWhen(p.date, ctx.now)}.`,
        chip: 'Event added',
        data: e,
      };
    },
  },
  {
    name: 'get_current_time',
    description: 'Get the current local date and time.',
    args: {},
    readOnly: true,
    async run(_a, ctx) {
      const d = ctx.now;
      const text = `${d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      return { ok: true, summary: `It's ${text}.`, chip: 'Time checked', data: { now: text } };
    },
  },
  {
    name: 'get_battery',
    description: 'Get the phone battery level.',
    args: {},
    readOnly: true,
    async run(_a, ctx) {
      const b = await ctx.platform.device.getBattery();
      const text = b.level === null ? 'Battery level is unavailable.' : `Battery is at ${b.level}%${b.charging ? ' and charging' : ''}.`;
      return { ok: true, summary: text, chip: 'Battery checked', data: b };
    },
  },
  {
    name: 'get_device_info',
    description: 'Get information about this device.',
    args: {},
    readOnly: true,
    async run(_a, ctx) {
      const d = ctx.platform.device.getDeviceInfo();
      const ram = d.totalMemoryBytes ? `, ${(d.totalMemoryBytes / 1073741824).toFixed(1)} GB RAM` : '';
      return { ok: true, summary: `${d.brand ?? ''} ${d.model ?? 'device'}, ${d.os} ${d.osVersion ?? ''}${ram}.`.trim(), chip: 'Device checked', data: d };
    },
  },
  {
    name: 'open_app',
    description: `Open a built-in app. Allowed apps: ${SUPPORTED_APPS.join(', ')}.`,
    args: { app: { type: 'string', description: 'app name', required: true, enum: SUPPORTED_APPS } },
    readOnly: false,
    sensitive: true,
    async run(a, ctx) {
      const ok = await ctx.platform.device.openApp(String(a.app));
      return ok
        ? { ok: true, summary: `Opened ${a.app}.`, chip: 'App opened' }
        : fail(`I couldn't open ${a.app} on this device.`);
    },
  },
  {
    name: 'open_url',
    description: 'Open a web link (https) in the browser.',
    args: { url: { type: 'string', description: 'https URL', required: true, maxLength: 500 } },
    readOnly: false,
    sensitive: true,
    async run(a, ctx) {
      const url = String(a.url);
      if (!/^https:\/\/[^\s]+$/i.test(url)) {
        return fail('I can only open https:// links.');
      }
      await ctx.platform.device.openUrl(url);
      return { ok: true, summary: 'Opened the link.', chip: 'Link opened' };
    },
  },
  {
    name: 'send_notification',
    description: 'Show a notification on this phone right now.',
    args: {
      title: { type: 'string', description: 'title', required: true, maxLength: 100 },
      body: { type: 'string', description: 'text', required: true, maxLength: 300 },
    },
    readOnly: false,
    async run(a, ctx) {
      if (!(await ctx.platform.notifications.ensurePermission())) {
        return fail('Notifications are turned off for Alphadron in system settings.');
      }
      await ctx.platform.notifications.showNow(String(a.title), String(a.body));
      return { ok: true, summary: 'Notification sent.', chip: 'Notification sent' };
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map(t => [t.name, t]));
