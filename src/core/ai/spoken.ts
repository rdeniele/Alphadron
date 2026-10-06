/**
 * Normalises how people SAY things (as transcribed by speech recognition) into the
 * form the command parser understands: "nine a.m." -> "9 am", "in half an hour" ->
 * "in 30 minutes", "Alpha Dex, ..." -> "...". Pure; applied to typed text too (harmless).
 */

const NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

const UNITS = 'one|two|three|four|five|six|seven|eight|nine';
const TEENS = 'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = 'twenty|thirty|forty|fifty|sixty';
const HOUR_WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
const NUM_PHRASE = `(?:(?:${TENS})(?:[\\s-]+(?:${UNITS}))?|${TEENS}|${UNITS})`;
const MIN_WORD = '(?:fifteen|(?:twenty|thirty|forty|fifty)(?:[\\s-]+five)?|ten|five)';
const SUFFIX = "(?:o['’]?clock|am|pm)";

function phraseToNumber(p: string): number {
  return p
    .toLowerCase()
    .split(/[\s-]+/)
    .reduce((sum, w) => sum + (NUM[w] ?? 0), 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

function clock(hourWord: string, ohUnit: string | undefined, minWord: string | undefined, suffix: string | undefined): string {
  const h = NUM[hourWord.toLowerCase()];
  const min = ohUnit ? NUM[ohUnit.toLowerCase()] : minWord ? phraseToNumber(minWord) : null;
  const sfx = suffix && /^(am|pm)$/i.test(suffix) ? ` ${suffix.toLowerCase()}` : '';
  return `${h}${min !== null && min !== undefined ? ':' + pad(min) : ''}${sfx}`;
}

export function normalizeSpoken(input: string): string {
  let s = input.trim();

  // Wake name (speech recognition spells it many ways).
  s = s.replace(
    /^(?:(?:hey|hi|ok|okay)[,\s]+)?(?:alpha[\s-]?(?:dex|decks|deks|dec|dax|dexx)|alphadex|alphadron|alpha\s+dron)\b[,.!?:\s]*/i,
    '',
  );

  // a.m. / p.m. -> am / pm
  s = s.replace(/\b([ap])\.\s?m\b\.?/gi, '$1m');

  // Fractions of an hour.
  s = s
    .replace(/\b(?:in\s+)?an\s+hour\s+and\s+a\s+half\b/gi, 'in 90 minutes')
    .replace(/\bin\s+(?:a\s+)?(?:half(?:\s+an)?\s+hour|half\s+hour)\b/gi, 'in 30 minutes')
    .replace(/\bin\s+(?:a\s+)?quarter\s+(?:of\s+an\s+hour|hour)\b/gi, 'in 15 minutes');

  // "half past nine", "quarter past nine", "quarter to ten"
  s = s
    .replace(new RegExp(`\\bhalf\\s+past\\s+(${HOUR_WORD})\\b`, 'gi'), (_m, h: string) => `at ${NUM[h.toLowerCase()]}:30`)
    .replace(new RegExp(`\\bquarter\\s+past\\s+(${HOUR_WORD})\\b`, 'gi'), (_m, h: string) => `at ${NUM[h.toLowerCase()]}:15`)
    .replace(new RegExp(`\\bquarter\\s+to\\s+(${HOUR_WORD})\\b`, 'gi'), (_m, h: string) => {
      const n = NUM[h.toLowerCase()];
      return `at ${n === 1 ? 12 : n - 1}:45`;
    });

  // Durations: "in two hours", "in thirty minutes", "in twenty five days"
  s = s.replace(
    new RegExp(`\\bin\\s+(${NUM_PHRASE})\\s+(minutes?|mins?|hours?|hrs?|days?|weeks?)\\b`, 'gi'),
    (_m, n: string, unit: string) => `in ${phraseToNumber(n)} ${unit.toLowerCase()}`,
  );

  // "at nine", "at nine thirty", "at nine oh five", "at nine o'clock", "at seven pm"
  s = s.replace(
    new RegExp(
      `\\b(at|@)\\s+(${HOUR_WORD})(?:\\s+(?:oh\\s+(${UNITS})|(${MIN_WORD})))?(?:\\s*(${SUFFIX}))?\\b(?!\\s+(?:hours?|hrs?|minutes?|mins?|days?|weeks?|times?|people|items?))`,
      'gi',
    ),
    (_m, _at: string, h: string, oh: string | undefined, mw: string | undefined, sfx: string | undefined) =>
      `at ${clock(h, oh, mw, sfx)}`,
  );

  // "nine am", "seven thirty pm", "ten o'clock" (no preposition, but an am/pm or o'clock marker)
  s = s.replace(
    new RegExp(`\\b(${HOUR_WORD})(?:\\s+(?:oh\\s+(${UNITS})|(${MIN_WORD})))?\\s*(${SUFFIX})\\b`, 'gi'),
    (_m, h: string, oh: string | undefined, mw: string | undefined, sfx: string) => clock(h, oh, mw, sfx),
  );

  // Leftover digit + o'clock
  s = s.replace(/\b(\d{1,2})\s*o['’]?clock\b/gi, '$1');

  return s.replace(/\s+/g, ' ').trim();
}
