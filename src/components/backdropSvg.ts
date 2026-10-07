/**
 * Builds the aurora-wave backdrop as an SVG string (a 400 x 800 canvas, scaled to fill the screen).
 * Pure, so it can be previewed outside the app. The art lives on the right and bottom edges and a
 * soft veil sits over it, so text and panels in the middle of the screen always stay readable.
 */

export interface WaveColors {
  base: [string, string, string];
  /** Luminous core of the main silk ribbon. */
  silkA: [string, string];
  /** Violet ribbon beside it. */
  silkB: [string, string];
  /** Peach-rose edge ribbon. */
  silkC: [string, string];
  /** The sweeping lower band, left to right. */
  band: [string, string, string];
  floor: [string, string];
  line: string;
  lineOpacity: number;
  /** Veil laid over the art; higher means calmer. */
  veil: string;
  veilOpacity: number;
  /** Overall strength of the coloured wave art (0 to 1). */
  art: number;
}

const grad = (id: string, stops: [string, number, number][], x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([c, o, off]) => `<stop offset="${off}" stop-color="${c}" stop-opacity="${Math.min(1, o)}"/>`)
    .join('')}</linearGradient>`;

const SILK_EDGE = 'M 420 540 C 330 500 280 380 296 250 C 312 120 372 60 340 -20';

export function backdropSvg(c: WaveColors): string {
  const a = c.art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
<defs>
${grad('base', [[c.base[0], 1, 0], [c.base[1], 1, 0.55], [c.base[2], 1, 1]], 0, 1)}
${grad('silkA', [[c.silkA[0], 1 * a, 0], [c.silkA[1], 0.75 * a, 1]], 0.3, 1)}
${grad('silkB', [[c.silkB[0], 0.8 * a, 0], [c.silkB[1], 0.85 * a, 1]], 0.6, 1)}
${grad('silkC', [[c.silkC[0], 0.7 * a, 0], [c.silkC[1], 0.6 * a, 1]], 0.7, 1)}
${grad('band', [[c.band[0], 0.5 * a, 0], [c.band[1], 0.7 * a, 0.5], [c.band[2], 0.85 * a, 1]], 1, 0.15)}
${grad('floor', [[c.floor[0], 0.6 * a, 0], [c.floor[1], 0.96, 1]], 0, 1)}
</defs>
<rect width="400" height="800" fill="url(#base)"/>
<path d="M 282 -20 C 318 50 280 120 262 240 C 236 390 300 540 420 600 L 420 628 C 288 562 212 396 238 238 C 256 118 292 42 262 -20 Z" fill="url(#silkC)"/>
<path d="M 340 -20 C 372 60 312 120 296 250 C 280 380 330 500 420 540 L 420 604 C 300 544 236 390 262 240 C 280 120 318 50 282 -20 Z" fill="url(#silkB)"/>
<path d="M 420 -20 L 420 540 C 330 500 280 380 296 250 C 312 120 372 60 340 -20 Z" fill="url(#silkA)"/>
<path d="M 420 470 C 300 440 180 520 -20 604 L -20 668 C 140 612 300 566 420 548 Z" fill="url(#band)"/>
<path d="M -20 640 C 120 598 260 654 420 612 L 420 820 L -20 820 Z" fill="url(#floor)"/>
<g fill="none" stroke="${c.line}" stroke-linecap="round">
<path d="${SILK_EDGE}" stroke-width="12" stroke-opacity="${c.lineOpacity * 0.1}"/>
<path d="${SILK_EDGE}" stroke-width="6" stroke-opacity="${c.lineOpacity * 0.2}"/>
<path d="${SILK_EDGE}" stroke-width="1.8" stroke-opacity="${c.lineOpacity}"/>
<path d="M -20 566 C 140 524 262 604 420 546" stroke-width="1.2" stroke-opacity="${c.lineOpacity * 0.85}"/>
<path d="M -20 594 C 150 562 272 634 420 574" stroke-width="1" stroke-opacity="${c.lineOpacity * 0.65}"/>
<path d="M -20 622 C 160 602 282 662 420 602" stroke-width="1" stroke-opacity="${c.lineOpacity * 0.5}"/>
<path d="M -20 650 C 170 640 290 690 420 632" stroke-width="1" stroke-opacity="${c.lineOpacity * 0.35}"/>
<path d="M -20 678 C 180 676 300 716 420 662" stroke-width="1" stroke-opacity="${c.lineOpacity * 0.22}"/>
</g>
<rect width="400" height="800" fill="${c.veil}" fill-opacity="${c.veilOpacity}"/>
</svg>`;
}

export const DARK_WAVE: WaveColors = {
  base: ['#030717', '#06102B', '#0A1A47'],
  silkA: ['#8AA6FF', '#3C5CEE'],
  silkB: ['#6A66F5', '#A98AF0'],
  silkC: ['#E593B4', '#EEB39A'],
  band: ['#4E60F0', '#9C86F0', '#DD98B4'],
  floor: ['#252C7C', '#091031'],
  line: '#FFFFFF',
  lineOpacity: 0.7,
  veil: '#030717',
  veilOpacity: 0.46,
  art: 1,
};

export const LIGHT_WAVE: WaveColors = {
  base: ['#EEF3FF', '#E6EDFF', '#F4ECFF'],
  silkA: ['#9DBBFF', '#7C93FF'],
  silkB: ['#9C8CFF', '#D2B4FF'],
  silkC: ['#FFB7CF', '#FFD3B8'],
  band: ['#C9B3FF', '#FFC2D6', '#FFD9BD'],
  floor: ['#D9E1FF', '#F1F4FF'],
  line: '#5B6CF0',
  lineOpacity: 0.5,
  veil: '#FFFFFF',
  veilOpacity: 0.46,
  art: 1,
};
