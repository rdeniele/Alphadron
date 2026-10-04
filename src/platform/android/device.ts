import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import type { DeviceService } from '../types';

/** Fixed allow-list. The LLM can only name a key; it never supplies a package or intent. */
const APPS: Record<string, { action: string; data?: string }> = {
  settings: { action: 'android.settings.SETTINGS' },
  wifi: { action: 'android.settings.WIFI_SETTINGS' },
  bluetooth: { action: 'android.settings.BLUETOOTH_SETTINGS' },
  alarm: { action: 'android.intent.action.SHOW_ALARMS' },
  dialer: { action: 'android.intent.action.DIAL' },
  camera: { action: 'android.media.action.STILL_IMAGE_CAMERA' },
  browser: { action: 'android.intent.action.VIEW', data: 'https://' },
  maps: { action: 'android.intent.action.VIEW', data: 'geo:0,0' },
  messages: { action: 'android.intent.action.VIEW', data: 'sms:' },
  email: { action: 'android.intent.action.VIEW', data: 'mailto:' },
};

export const SUPPORTED_APPS = Object.keys(APPS);

export const androidDevice: DeviceService = {
  async getBattery() {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return {
      level: level >= 0 ? Math.round(level * 100) : null,
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  },

  getDeviceInfo() {
    return {
      brand: Device.brand,
      model: Device.modelName,
      os: Device.osName ?? 'Android',
      osVersion: Device.osVersion,
      totalMemoryBytes: Device.totalMemory,
    };
  },

  async openUrl(url) {
    await Linking.openURL(url);
  },

  async openApp(appKey) {
    const spec = APPS[appKey];
    if (!spec) {
      return false;
    }
    try {
      await IntentLauncher.startActivityAsync(spec.action, spec.data ? { data: spec.data } : undefined);
      return true;
    } catch {
      return false;
    }
  },
};
