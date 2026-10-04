import { getDb } from '../db';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  memoryEnabled: boolean;
  onboardingDone: boolean;
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  memoryEnabled: true,
  onboardingDone: false,
};

export async function loadSettings(): Promise<AppSettings> {
  const rows = await getDb().getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  );
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      // ignore corrupt value, keep default
    }
  }
  return out as unknown as AppSettings;
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await getDb().runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    JSON.stringify(value),
  );
}
