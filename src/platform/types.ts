/** Platform abstractions. Android implements these now; Windows will later. */

export type AlertStyle = 'gentle' | 'alarm';

export interface AlertPrefs {
  /** Play the chime (otherwise just a short vibration). */
  sound: boolean;
  /** 'gentle' follows the phone's notification volume; 'alarm' uses the alarm volume (rings even on silent). */
  style: AlertStyle;
}

export interface NotificationService {
  /** Applies the user's alert preferences. Already scheduled alerts must be re-registered afterwards. */
  setAlertPrefs(prefs: AlertPrefs): void;
  /** Asks for permission if needed. Returns whether notifications can be shown. */
  ensurePermission(): Promise<boolean>;
  schedule(input: {
    key: string;
    title: string;
    body: string;
    at: Date;
    repeat?: 'daily' | 'weekly' | null;
  }): Promise<void>;
  cancel(key: string): Promise<void>;
  showNow(title: string, body: string): Promise<void>;
  /** Opens the system screen where the user can allow exact alarms (alerts on the minute). */
  openExactAlarmSettings(): Promise<void>;
}

export interface DeviceInfo {
  brand: string | null;
  model: string | null;
  os: string;
  osVersion: string | null;
  totalMemoryBytes: number | null;
}

export interface DeviceService {
  getBattery(): Promise<{ level: number | null; charging: boolean }>;
  getDeviceInfo(): DeviceInfo;
  /** Opens a URL (https only; validated by the tool layer). */
  openUrl(url: string): Promise<void>;
  /** Opens an app from the allow-list. Returns false if not installed/supported. */
  openApp(appKey: string): Promise<boolean>;
}

export interface Platform {
  notifications: NotificationService;
  device: DeviceService;
}
