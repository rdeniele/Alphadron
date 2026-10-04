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
  const res = await getDb().execute('SELECT key, value FROM settings');
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const row of res.rows) {
    try {
      out[String(row.key)] = JSON.parse(String(row.value));
    } catch {
      // ignore corrupt value, keep default
    }
  }
  return out as unknown as AppSettings;
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await getDb().execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    key,
    JSON.stringify(value),
  ]);
}
