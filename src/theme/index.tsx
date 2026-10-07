import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Theme } from './palettes';

export type { Theme } from './palettes';

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
