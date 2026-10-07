import test from 'node:test';
import assert from 'node:assert/strict';
import { dark, light, type Theme } from '../src/theme/palettes.ts';

type RGBA = [number, number, number, number];

function parse(c: string): RGBA {
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error('bad colour ' + c);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
}

/** Alpha-blend `top` over an opaque `bottom`. */
function over(top: string, bottom: string): RGBA {
  const [tr, tg, tb, ta] = parse(top);
  const [br, bg, bb] = parse(bottom);
  return [tr * ta + br * (1 - ta), tg * ta + bg * (1 - ta), tb * ta + bb * (1 - ta), 1];
}

function lum([r, g, b]: RGBA): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: RGBA, b: RGBA): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const rgb = (c: RGBA) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const flat = (c: string, bg: string) => over(c, bg);

// The brightest things the backdrop can put behind a panel or text.
const WORST_DARK = ['#CFE0FF', '#9DBBFF', '#FBB6D0', '#FFD2B8', '#C69DFF', '#FFFFFF'];
const WORST_LIGHT = ['#9DBBFF', '#7C93FF', '#FFB7CF', '#D2B4FF', '#FFFFFF', '#EEF3FF'];

function check(name: string, t: Theme, worst: string[]) {
  test(`${name}: body text is readable on glass over any part of the wave (>= 4.5:1)`, () => {
    for (const bg of worst) {
      const panel = over(t.surface, bg);
      assert.ok(ratio(flat(t.text, rgb(panel)), panel) >= 4.5, `text on panel over ${bg}`);
      assert.ok(ratio(flat(t.textDim, rgb(panel)), panel) >= 4.5, `dim text on panel over ${bg}: ${ratio(flat(t.textDim, rgb(panel)), panel).toFixed(2)}`);
      assert.ok(ratio(parse(t.accent), panel) >= 4.5, `accent on panel over ${bg}: ${ratio(parse(t.accent), panel).toFixed(2)}`);
      assert.ok(ratio(parse(t.danger), panel) >= 4.5, `danger on panel over ${bg}`);
      assert.ok(ratio(parse(t.ok), panel) >= 4.5, `ok on panel over ${bg}`);
    }
  });

  test(`${name}: sheets, tab bar and primary buttons are readable`, () => {
    const sheet = over(t.sheet, t.bg);
    assert.ok(ratio(flat(t.text, rgb(sheet)), sheet) >= 7, 'text on sheet');
    assert.ok(ratio(flat(t.textDim, rgb(sheet)), sheet) >= 4.5, 'dim text on sheet');
    const tab = over(t.tabBar, t.bg);
    assert.ok(ratio(parse(t.accent), tab) >= 4.5, 'active tab icon');
    assert.ok(ratio(flat(t.textDim, rgb(tab)), tab) >= 4.5, 'inactive tab label');
    for (const end of t.gradientAccent) {
      assert.ok(ratio(parse(t.onAccent), parse(end)) >= 4.5, `button text on ${end}: ${ratio(parse(t.onAccent), parse(end)).toFixed(2)}`);
    }
    assert.ok(ratio(parse(t.onLight), parse(t.light)) >= 7, 'hero button text');
  });
}

check('dark', dark, WORST_DARK);
check('light', light, WORST_LIGHT);

/** Worst case colours the backdrop shows, after the wave's own opacity and the veil are applied. */
function backdropWorst(t: Theme): RGBA[] {
  const w = t.wave;
  const baseMid = parse(w.base[1]);
  const layers: [string, number][] = [
    [w.silkA[0], 1],
    [w.silkB[1], 0.85],
    [w.silkC[0], 0.7],
    [w.band[2], 0.85],
    [w.silkA[1], 0.75],
    [w.band[1], 0.7],
  ];
  return layers.map(([c, op]) => {
    const art = over(`rgba(${parse(c).slice(0, 3).join(',')},${Math.min(1, op * w.art)})`, rgb(baseMid));
    return over(`rgba(${parse(w.veil).slice(0, 3).join(',')},${w.veilOpacity})`, rgb(art));
  });
}

for (const [name, t] of [['dark', dark], ['light', light]] as const) {
  test(`${name}: plain text straight on the backdrop is readable over the brightest wave (>= 4.5:1)`, () => {
    for (const bg of backdropWorst(t)) {
      const text = ratio(flat(t.text, rgb(bg)), bg);
      const dim = ratio(flat(t.textDim, rgb(bg)), bg);
      assert.ok(text >= 4.5, `text over ${rgb(bg)}: ${text.toFixed(2)}`);
      assert.ok(dim >= 4.5, `dim text over ${rgb(bg)}: ${dim.toFixed(2)}`);
    }
  });
}
