import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  onAccent: string;
  danger: string;
  ok: string;
}

const dark: Theme = {
  dark: true,
  bg: '#0B0F14',
  surface: '#141A22',
  border: '#222B36',
  text: '#E8EDF2',
  textDim: '#8A97A6',
  accent: '#5CE1E6',
  onAccent: '#06141A',
  danger: '#FF6B6B',
  ok: '#5BD694',
};

const light: Theme = {
  dark: false,
  bg: '#F6F8FA',
  surface: '#FFFFFF',
  border: '#DDE3EA',
  text: '#10151B',
  textDim: '#5B6773',
  accent: '#0A8F96',
  onAccent: '#FFFFFF',
  danger: '#D63C3C',
  ok: '#1E9E5A',
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
