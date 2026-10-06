/**
 * Deterministic natural-language date/time parser (no dependencies).
 * The LLM only extracts the raw phrase ("tomorrow at 9 AM"); this resolves it.
 */

export interface ParsedWhen {
  date: Date;
  hasTime: boolean;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

interface Clock {
  hour: number;
  minute: number;
  meridiem: 'am' | 'pm' | null;
}

function parseClock(s: string): Clock | null {
  if (/\bnoon\b/.test(s)) {
    return { hour: 12, minute: 0, meridiem: 'pm' };
  }
  if (/\bmidnight\b/.test(s)) {
    return { hour: 12, minute: 0, meridiem: 'am' };
  }
  const m = s.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?=\s|$|[.,!?])/);
  if (!m) {
    return null;
  }
  // A bare number only counts as a time if it has "at", a colon or am/pm.
  const explicit = /\bat\s+\d/.test(s) || m[2] !== undefined || m[3] !== undefined;
  if (!explicit) {
    return null;
  }
  const hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  if (minute > 59 || hour > 24) {
    return null;
  }
  const mer = m[3] ? (m[3][0] === 'a' ? 'am' : 'pm') : null;
  return { hour, minute, meridiem: mer };
}

function resolveHour(c: Clock, day: Date, now: Date): number {
  if (c.hour >= 13 || c.hour === 0) {
    return c.hour % 24;
  }
  if (c.meridiem === 'am') {
    return c.hour === 12 ? 0 : c.hour;
  }
  if (c.meridiem === 'pm') {
    return c.hour === 12 ? 12 : c.hour + 12;
  }
  // No am/pm given.
  if (c.hour === 12) {
    return 12;
  }
  const am = c.hour;
  const pm = c.hour + 12;
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
  if (isToday) {
    const at = (h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, c.minute);
    if (at(am) > now) {
      return am;
    }
    if (at(pm) > now) {
      return pm;
    }
    return am;
  }
  // Future day with explicit date: 7-11 reads as morning, 1-6 as afternoon/evening.
  return c.hour >= 7 ? am : pm;
}

export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  const s = input.toLowerCase().trim();
  if (!s) {
    return null;
  }

  // ISO 8601 date or datetime.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, mo, d, h, mi] = iso;
    const date = new Date(+y, +mo - 1, +d, h ? +h : 9, mi ? +mi : 0);
    return Number.isNaN(date.getTime()) ? null : { date, hasTime: !!h };
  }

  // Relative offsets: "in 2 hours", "in 30 minutes", "in 3 days", "in a week".
  const rel = s.match(/\bin\s+(an?|\d+)\s*(minute|min|hour|hr|day|week)s?\b/);
  if (rel) {
    const n = rel[1].startsWith('a') ? 1 : parseInt(rel[1], 10);
    const unit = rel[2];
    const d = new Date(now);
    if (unit === 'minute' || unit === 'min') {
      d.setMinutes(d.getMinutes() + n);
    } else if (unit === 'hour' || unit === 'hr') {
      d.setHours(d.getHours() + n);
    } else if (unit === 'day') {
      d.setDate(d.getDate() + n);
    } else {
      d.setDate(d.getDate() + 7 * n);
    }
    return { date: d, hasTime: unit !== 'day' && unit !== 'week' };
  }
  if (/^now$/.test(s)) {
    return { date: new Date(now), hasTime: true };
  }

  // "later" / "later today": a couple of hours from now.
  if (/\blater\b/.test(s) && !/\bat\s+\d/.test(s)) {
    const d = new Date(now.getTime() + 2 * 3600000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    // Past midnight means "later" no longer fits today: use tomorrow morning instead.
    return d.getDate() === now.getDate()
      ? { date: d, hasTime: true }
      : { date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0), hasTime: false };
  }

  // Day.
  let day: Date | null = null;
  let dayExplicit = true;
  let defaultHour: number | null = null; // time used when only a day was given
  if (/\bday after tomorrow\b/.test(s)) {
    day = addDays(startOfDay(now), 2);
  } else if (/\btomorrow\b/.test(s)) {
    day = addDays(startOfDay(now), 1);
  } else if (/\bend of (?:the )?(?:day|today)\b|\beod\b/.test(s)) {
    day = startOfDay(now);
    dayExplicit = false;
    defaultHour = 17;
  } else if (/\bend of (?:the )?(?:work )?week\b|\beow\b/.test(s)) {
    day = nextWeekday(now, 5, true);
    defaultHour = 17;
  } else if (/\bnext week\b/.test(s)) {
    day = nextWeekday(now, 1, false);
  } else if (/\b(?:this week|rest of (?:the )?week)\b/.test(s)) {
    day = nextWeekday(now, 5, true);
  } else if (/\bnext weekend\b/.test(s)) {
    day = addDays(nextWeekday(now, 6, true), now.getDay() === 6 ? 7 : now.getDay() === 0 ? 6 : 7);
  } else if (/\bweekend\b/.test(s)) {
    day = now.getDay() === 0 ? startOfDay(now) : nextWeekday(now, 6, true);
  } else if (/\bnext month\b/.test(s)) {
    day = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (/\b(?:end of (?:the )?month|this month)\b/.test(s)) {
    day = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (/\b(today|tonight)\b/.test(s)) {
    day = startOfDay(now);
    dayExplicit = false;
  } else {
    const wd = s.match(new RegExp(`\\b(next\\s+)?(${WEEKDAYS.join('|')})\\b`));
    if (wd) {
      const target = WEEKDAYS.indexOf(wd[2]);
      let diff = (target - now.getDay() + 7) % 7;
      if (diff === 0) {
        diff = 7;
      }
      day = addDays(startOfDay(now), diff);
    } else {
      const md = s.match(new RegExp(`\\b(${MONTHS.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)) ||
        s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join('|')})\\b`));
      if (md) {
        const monthName = MONTHS.includes(md[1]) ? md[1] : md[2];
        const dayNum = parseInt(MONTHS.includes(md[1]) ? md[2] : md[1], 10);
        let cand = new Date(now.getFullYear(), MONTHS.indexOf(monthName), dayNum);
        if (cand < startOfDay(now)) {
          cand = new Date(now.getFullYear() + 1, MONTHS.indexOf(monthName), dayNum);
        }
        day = cand;
      }
    }
  }

  // Time.
  let clock = parseClock(s);
  if (clock && clock.meridiem === null && clock.hour < 12) {
    // "tonight at 8" / "this evening at 6" mean PM; "tomorrow morning at 9" means AM.
    if (/\b(tonight|evening|afternoon|night)\b/.test(s)) {
      clock = { ...clock, meridiem: 'pm' };
    } else if (/\bmorning\b/.test(s)) {
      clock = { ...clock, meridiem: 'am' };
    }
  }
  if (!clock) {
    if (/\btonight\b/.test(s)) {
      clock = { hour: 8, minute: 0, meridiem: 'pm' };
    } else if (/\bmorning\b/.test(s)) {
      clock = { hour: 9, minute: 0, meridiem: 'am' };
    } else if (/\bafternoon\b/.test(s)) {
      clock = { hour: 3, minute: 0, meridiem: 'pm' };
    } else if (/\bevening\b/.test(s)) {
      clock = { hour: 6, minute: 0, meridiem: 'pm' };
    }
  }

  if (!day && !clock) {
    return null;
  }
  if (!day) {
    day = startOfDay(now);
    dayExplicit = false;
  }
  if (!clock) {
    const base = defaultHour ?? 9;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base, 0);
    const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
    if (isToday && at <= now) {
      // Only a day ("today") was given and the default time has passed: use the next
      // whole hour, or tomorrow morning if it is already late.
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
      return next.getHours() <= 21 && next.getDate() === now.getDate()
        ? { date: next, hasTime: false }
        : { date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0), hasTime: false };
    }
    return { date: at, hasTime: false };
  }

  const hour = resolveHour(clock, day, now);
  let date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, clock.minute);
  // "at 7" with no day and the time already passed today -> next day.
  if (!dayExplicit && date <= now && !/\b(today|tonight)\b/.test(s)) {
    date = addDays(date, 1);
  }
  return { date, hasTime: true };
}

export function startOfLocalDay(d: Date): number {
  return startOfDay(d).getTime();
}

export function endOfLocalDay(d: Date): number {
  return startOfDay(d).getTime() + 24 * 3600 * 1000 - 1;
}

/** "tomorrow at 9:00 AM", "today at 7:00 PM", "Mon, Oct 5 at 9:00 AM" */
export function formatWhen(date: Date, now: Date = new Date()): string {
  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);
  const h = date.getHours();
  const m = date.getMinutes();
  const time = `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
  let dayStr: string;
  if (diffDays === 0) {
    dayStr = 'today';
  } else if (diffDays === 1) {
    dayStr = 'tomorrow';
  } else {
    const cap3 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1, 3);
    dayStr = `${cap3(WEEKDAYS[date.getDay()])}, ${cap3(MONTHS[date.getMonth()])} ${date.getDate()}`;
  }
  return `${dayStr} at ${time}`;
}

/** The given weekday (0 = Sunday) on or after today when `includeToday`, otherwise strictly after. */
function nextWeekday(now: Date, target: number, includeToday: boolean): Date {
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) {
    diff = 7;
  }
  return addDays(startOfDay(now), diff);
}

/** A task due on a day without a time is stored as 23:59, which the UI shows as just the day. */
export function dateOnlyDue(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 0, 0).getTime();
}

export function isDateOnlyDue(ms: number): boolean {
  const d = new Date(ms);
  return d.getHours() === 23 && d.getMinutes() === 59;
}

/** Due-date text: "today", "tomorrow", "Fri, Oct 9", or with a time if one was set. */
export function formatDue(ms: number, now: Date = new Date()): string {
  const d = new Date(ms);
  return isDateOnlyDue(ms) ? formatWhen(d, now).replace(/ at .*$/, '') : formatWhen(d, now);
}

export interface DateRange {
  from: number;
  to: number;
  /** Human label: "today", "tomorrow", "this week", "next week", "this weekend", "Fri, Oct 9"... */
  label: string;
  /** Number of calendar days covered. */
  days: number;
}

/**
 * Turns a timeframe phrase into a span of days: "today", "tomorrow", "this week",
 * "next week", "this weekend", "this month", "next month", or a specific day.
 */
export function parseRange(phrase: string, now: Date = new Date()): DateRange | null {
  const s = phrase.toLowerCase();
  const span = (start: Date, end: Date, label: string): DateRange => ({
    from: startOfDay(start).getTime(),
    to: endOfLocalDay(end),
    label,
    days: Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1,
  });
  const today = startOfDay(now);

  if (/\bnext week\b/.test(s)) {
    const mon = nextWeekday(now, 1, false);
    return span(mon, addDays(mon, 6), 'next week');
  }
  if (/\b(?:this week|rest of (?:the )?week|the week|week)\b/.test(s)) {
    const sunday = nextWeekday(now, 0, true);
    return span(today, sunday, 'this week');
  }
  if (/\bnext weekend\b/.test(s)) {
    const sat = addDays(nextWeekday(now, 6, true), now.getDay() === 6 ? 7 : now.getDay() === 0 ? 6 : 7);
    return span(sat, addDays(sat, 1), 'next weekend');
  }
  if (/\bweekend\b/.test(s)) {
    const sat = now.getDay() === 0 ? addDays(today, -1) : nextWeekday(now, 6, true);
    return span(now.getDay() === 0 ? today : sat, addDays(sat, 1), 'this weekend');
  }
  if (/\bnext month\b/.test(s)) {
    return span(new Date(now.getFullYear(), now.getMonth() + 1, 1), new Date(now.getFullYear(), now.getMonth() + 2, 0), 'next month');
  }
  if (/\bthis month\b/.test(s)) {
    return span(today, new Date(now.getFullYear(), now.getMonth() + 1, 0), 'this month');
  }
  const p = parseWhen(phrase, now);
  if (!p) {
    return null;
  }
  const d = startOfDay(p.date);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label =
    diff === 0
      ? 'today'
      : diff === 1
        ? 'tomorrow'
        : `${WEEKDAYS[d.getDay()][0].toUpperCase()}${WEEKDAYS[d.getDay()].slice(1, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return span(d, d, label);
}
