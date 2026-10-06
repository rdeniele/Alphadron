import { getDb } from '../db';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  memoryEnabled: boolean;
  onboardingDone: boolean;
  /** Which Android microphone source to record from ('auto' finds one that works). */
  micSource: 'auto' | 'mic' | 'voice' | 'camcorder' | 'communication' | 'unprocessed';
  /** Read assistant replies aloud even when the question was typed. */
  speakReplies: boolean;
  /** Play a chime when something is due. */
  alertSound: boolean;
  /** 'gentle' = notification volume, 'alarm' = alarm volume (rings on silent). */
  alertStyle: 'gentle' | 'alarm';
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  memoryEnabled: true,
  onboardingDone: false,
  micSource: 'auto',
  speakReplies: false,
  alertSound: true,
  alertStyle: 'gentle',
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

export async function getPreference(key: string): Promise<string | null> {
  const r = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM preferences WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setPreference(key: string, value: string) {
  if (!value.trim()) {
    await getDb().runAsync('DELETE FROM preferences WHERE key = ?', key);
    return;
  }
  await getDb().runAsync('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', key, value.trim());
}
