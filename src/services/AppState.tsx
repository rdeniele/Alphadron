import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { initDatabase } from '../database/db';
import {
  defaultSettings,
  loadSettings,
  saveSetting,
  type AppSettings,
} from '../database/repositories/settingsRepo';

interface Ctx {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const AppCtx = createContext<Ctx>({ settings: defaultSettings, update: async () => undefined });

export function AppStateProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: (settings: AppSettings | null) => React.ReactNode | null;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(loadSettings)
      .then(setSettings)
      .catch(e => setError(String(e?.message ?? e)));
  }, []);

  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      await saveSetting(key, value);
      setSettings(prev => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  if (error) {
    throw new Error(error);
  }
  if (!settings) {
    return <>{fallback(null)}</>;
  }
  return <AppCtx.Provider value={{ settings, update }}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
