import * as Notifications from 'expo-notifications';
import { Platform as RNPlatform } from 'react-native';
import type { NotificationService } from '../types';

const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (RNPlatform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export const androidNotifications: NotificationService = {
  async ensurePermission() {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) {
      return true;
    }
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  },

  async schedule({ key, title, body, at, repeat }) {
    await ensureChannel();
    await Notifications.cancelScheduledNotificationAsync(key).catch(() => undefined);
    const T = Notifications.SchedulableTriggerInputTypes;
    let trigger: Notifications.NotificationTriggerInput;
    if (repeat === 'daily') {
      trigger = { type: T.DAILY, hour: at.getHours(), minute: at.getMinutes(), channelId: CHANNEL_ID };
    } else if (repeat === 'weekly') {
      trigger = {
        type: T.WEEKLY,
        weekday: at.getDay() + 1, // expo: 1 = Sunday
        hour: at.getHours(),
        minute: at.getMinutes(),
        channelId: CHANNEL_ID,
      };
    } else {
      trigger = { type: T.DATE, date: at, channelId: CHANNEL_ID };
    }
    await Notifications.scheduleNotificationAsync({
      identifier: key,
      content: { title, body, sound: true },
      trigger,
    });
  },

  async cancel(key) {
    await Notifications.cancelScheduledNotificationAsync(key).catch(() => undefined);
  },

  async showNow(title, body) {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  },
};
