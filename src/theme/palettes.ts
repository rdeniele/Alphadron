import { DARK_WAVE, LIGHT_WAVE, type WaveColors } from '../components/backdropSvg';

export interface Theme {
  dark: boolean;
  /** Solid base colour (behind the backdrop, and for text on top of text-coloured chips). */
  bg: string;
  /** Glass panel fill. Deliberately dark and fairly solid so text on it is always easy to read. */
  surface: string;
  /** Slightly stronger glass for inputs and pressed states. */
  surfaceStrong: string;
  /** Hairline edge that makes a panel read as glass. */
  border: string;
  text: string;
  textDim: string;
  /** Flat accent for icons and small text. */
  accent: string;
  /** Text/icon colour on top of the action gradient. */
  onAccent: string;
  danger: string;
  ok: string;
  /** Action gradient (primary buttons, FAB, mic, selected chips), left to right. */
  gradientAccent: [string, string];
  /** Glow colour under action buttons. */
  glow: string;
  /** Pure white pill for the single most important call to action on a screen. */
  light: string;
  onLight: string;
  /** Bottom sheets and modals. */
  sheet: string;
  /** Tab bar. */
  tabBar: string;
  /** Soft ring/line colour. */
  ring: string;
  wave: WaveColors;
}

// Identity: deep navy, a luminous aurora wave (periwinkle, lavender, peach), crisp white type,
// and one confident blue for actions. Text colours are chosen for strong contrast on the glass.
export const dark: Theme = {
  dark: true,
  bg: '#040918',
  surface: 'rgba(8, 16, 46, 0.80)',
  surfaceStrong: 'rgba(255, 255, 255, 0.14)',
  border: 'rgba(176, 200, 255, 0.24)',
  text: '#FFFFFF',
  textDim: 'rgba(226, 234, 255, 0.92)',
  accent: '#A5C4FF',
  onAccent: '#FFFFFF',
  danger: '#FF8FA3',
  ok: '#6EE7B7',
  gradientAccent: ['#2F6BEA', '#5B63F0'],
  glow: '#4D7CFF',
  light: '#FFFFFF',
  onLight: '#08122E',
  sheet: 'rgba(8, 15, 42, 0.98)',
  tabBar: 'rgba(5, 10, 30, 0.95)',
  ring: 'rgba(255, 255, 255, 0.34)',
  wave: DARK_WAVE,
};

export const light: Theme = {
  dark: false,
  bg: '#EEF3FF',
  surface: 'rgba(255, 255, 255, 0.90)',
  surfaceStrong: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(70, 90, 200, 0.22)',
  text: '#0A1230',
  textDim: 'rgba(10, 18, 48, 0.68)',
  accent: '#2457D6',
  onAccent: '#FFFFFF',
  danger: '#B01F30',
  ok: '#07704A',
  gradientAccent: ['#2F6BEA', '#5B63F0'],
  glow: '#4D7CFF',
  light: '#0A1230',
  onLight: '#FFFFFF',
  sheet: 'rgba(255, 255, 255, 0.99)',
  tabBar: 'rgba(255, 255, 255, 0.96)',
  ring: 'rgba(70, 90, 200, 0.3)',
  wave: LIGHT_WAVE,
};

