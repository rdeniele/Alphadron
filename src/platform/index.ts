import type { Platform } from './types';
import { androidNotifications } from './android/notifications';
import { androidDevice } from './android/device';

// Only Android is implemented. A Windows implementation would be selected here.
export const platform: Platform = {
  notifications: androidNotifications,
  device: androidDevice,
};

export type { Platform } from './types';
