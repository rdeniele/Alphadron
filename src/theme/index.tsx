import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

type Pair = [string, string];

export interface Theme {
  dark: boolean;
  /** Solid base colour (behind the gradient, and for text on top of text-coloured chips). */
  bg: string;
  /** Frosted glass panel fill. */
  surface: string;
  /** Slightly stronger glass for inputs and pressed states. */
  surfaceStrong: string;
  /** Hairline edge that makes a panel read as glass. */
  border: string;
  text: string;
  textDim: string;
  /** Flat accent for icons and small text. */
  accent: string;
  /** Text/icon colour on top of the accent gradient. */
  onAccent: string;
  danger: string;
  ok: string;
  /** Background wash, top to bottom. */
  gradientBg: [string, string, string];
  /** Action gradient (buttons, FAB, mic, selected chips), left to right. */
  gradientAccent: Pair;
  orbWarm: Pair;
  orbCool: Pair;
  ring: string;
  /** Bottom sheets and modals. */
  sheet: string;
  /** Tab bar. */
  tabBar: string;
}

// Identity: the mascot's electric blue + violet, with the reference's warm orange-to-pink for actions.
const dark: Theme = {
  dark: true,
  bg: '#0C0B2B',
  surface: 'rgba(22, 14, 64, 0.58)',
  surfaceStrong: 'rgba(255, 255, 255, 0.14)',
  border: 'rgba(255, 255, 255, 0.20)',
  text: '#F7F4FF',
  textDim: 'rgba(233, 226, 255, 0.68)',
  accent: '#FFA25E',
  onAccent: '#1A0B3B',
  danger: '#FF7A8A',
  ok: '#5EE6A8',
  gradientBg: ['#0A0927', '#1B0F4D', '#35146E'],
  gradientAccent: ['#FFB347', '#FF4D8D'],
  orbWarm: ['#FFB347', '#FF4D8D'],
  orbCool: ['#5BB5FF', '#9B6BFF'],
  ring: 'rgba(255, 255, 255, 0.32)',
  sheet: 'rgba(24, 14, 66, 0.97)',
  tabBar: 'rgba(12, 8, 40, 0.94)',
};

const light: Theme = {
  dark: false,
  bg: '#F6F1FF',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceStrong: 'rgba(255, 255, 255, 0.92)',
  border: 'rgba(110, 80, 200, 0.20)',
  text: '#1B1240',
  textDim: 'rgba(27, 18, 64, 0.64)',
  accent: '#C2410C',
  onAccent: '#1A0B3B',
  danger: '#C62839',
  ok: '#0E8F5B',
  gradientBg: ['#F8F4FF', '#EEE6FF', '#FFE9F3'],
  gradientAccent: ['#FFB04A', '#FF5C93'],
  orbWarm: ['#FFC980', '#FF86B3'],
  orbCool: ['#9AD2FF', '#BBA3FF'],
  ring: 'rgba(110, 80, 200, 0.28)',
  sheet: 'rgba(255, 255, 255, 0.98)',
  tabBar: 'rgba(255, 255, 255, 0.94)',
};

export type ThemeMode = 'system' | 'light' | 'dark';

const Ctx = createContext<Theme>(dark);

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const theme = useMemo(() => {
    const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
    return isDark ? dark : light;
  }, [mode, system]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
