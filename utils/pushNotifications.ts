import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '@/services/api';
import { authService } from '@/services/authService';

export const PUSH_TOKEN_STORAGE_KEY = '@ghands:push_token';

export type NotificationsModule = typeof import('expo-notifications');
export type NotificationResponse = import('expo-notifications').NotificationResponse;

let notificationsModule: NotificationsModule | null | undefined;
let notificationHandlerConfigured = false;
let androidChannelsReady = false;
let lastSyncedPushToken: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

export function getNotificationsModule(): NotificationsModule | null {
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  if (notificationsModule !== undefined) {
    return notificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch {
    notificationsModule = null;
  }

  return notificationsModule;
}

export function configureNotificationHandler(Notifications: NotificationsModule): void {
  if (notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function setupAndroidNotificationChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelsReady) return;
  androidChannelsReady = true;

  const channelDefaults = {
    sound: 'default' as const,
    enableVibrate: true,
    showBadge: true,
    lightColor: '#4F6739',
  };

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    ...channelDefaults,
  });

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    description: 'Chat messages from your provider or client',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    ...channelDefaults,
  });

  await Notifications.setNotificationChannelAsync('jobs', {
    name: 'Job updates',
    description: 'Quotes, visits, and job status changes',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    ...channelDefaults,
  });

  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments & wallet',
    description: 'Payments, deposits, and wallet activity',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    ...channelDefaults,
  });

  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Incoming calls',
    description: 'Voice calls from your provider or client',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    ...channelDefaults,
  });
}

function resolveDeviceLabel(): string {
  const model = Device.modelName?.trim();
  const name = Device.deviceName?.trim();
  if (model && name && model !== name) return `${name} (${model})`;
  return model || name || 'Mobile device';
}

export async function acquireExpoPushToken(
  Notifications: NotificationsModule,
): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '82fb8167-b26b-4fcf-84c2-fb858f717a03';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await setupAndroidNotificationChannels(Notifications);
    return token;
  } catch {
    return null;
  }
}

export async function registerPushTokenWithBackend(pushToken: string): Promise<void> {
  await notificationService.registerPushToken({
    pushToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    provider: 'expo',
    deviceLabel: resolveDeviceLabel(),
  });
}

export async function unregisterPushTokenFromBackend(pushToken: string): Promise<void> {
  try {
    await notificationService.unregisterPushToken(pushToken);
  } catch {
    /* best-effort on logout */
  }
}

/** Register device with backend when user is signed in. Returns Expo push token if available. */
export async function syncPushNotifications(force = false): Promise<string | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  configureNotificationHandler(Notifications);

  const isAuthenticated = await authService.isAuthenticated();
  if (!isAuthenticated) return null;

  const pushToken = await acquireExpoPushToken(Notifications);
  if (!pushToken) return null;

  if (!force && lastSyncedPushToken === pushToken) {
    return pushToken;
  }

  try {
    await registerPushTokenWithBackend(pushToken);
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
    lastSyncedPushToken = pushToken;
  } catch {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (stored !== pushToken) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
    }
  }

  return pushToken;
}

export async function unregisterPushOnLogout(): Promise<void> {
  lastSyncedPushToken = null;

  const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (storedToken) {
    await unregisterPushTokenFromBackend(storedToken);
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }

  const Notifications = getNotificationsModule();
  if (Notifications) {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch {
      /* ignore */
    }
  }
}

export async function refreshNotificationBadge(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  const isAuthenticated = await authService.isAuthenticated();
  if (!isAuthenticated) {
    await Notifications.setBadgeCountAsync(0);
    return;
  }

  try {
    const unread = await notificationService.getUnreadCount();
    await Notifications.setBadgeCountAsync(Math.max(0, unread));
  } catch {
    /* ignore badge sync errors */
  }
}

export async function getInitialNotificationResponse(): Promise<NotificationResponse | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;
  return Notifications.getLastNotificationResponseAsync();
}

export function installPushNotificationLifecycle(
  onAppBecomeActive?: () => void,
): () => void {
  if (appStateSubscription) {
    return () => appStateSubscription?.remove();
  }

  const onChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      void syncPushNotifications();
      void refreshNotificationBadge();
      onAppBecomeActive?.();
    }
  };

  appStateSubscription = AppState.addEventListener('change', onChange);
  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}

export function schedulePushSyncAfterAuth(): void {
  void syncPushNotifications(true);
}
