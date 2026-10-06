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

  // Day.
  let day: Date | null = null;
  let dayExplicit = true;
  if (/\bday after tomorrow\b/.test(s)) {
    day = addDays(startOfDay(now), 2);
  } else if (/\btomorrow\b/.test(s)) {
    day = addDays(startOfDay(now), 1);
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
    return { date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0), hasTime: false };
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
    dayStr = `${WEEKDAYS[date.getDay()].slice(0, 3)}, ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  }
  return `${dayStr} at ${time}`;
}
