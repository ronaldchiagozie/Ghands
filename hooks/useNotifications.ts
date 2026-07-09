import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  configureNotificationHandler,
  getInitialNotificationResponse,
  getNotificationsModule,
  installPushNotificationLifecycle,
  refreshNotificationBadge,
  syncPushNotifications,
  type NotificationResponse,
} from '@/utils/pushNotifications';
import {
  isIncomingCallNotification,
  resolvePushNotificationRoute,
} from '@/utils/notificationNavigation';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  /** Set when user taps a notification (background, killed app, or action). */
  const [notificationResponse, setNotificationResponse] = useState<NotificationResponse | null>(null);
  const receivedListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);
  const initialHandled = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const Notifications = getNotificationsModule();

    if (!Notifications) {
      return () => {
        isMounted = false;
      };
    }

    configureNotificationHandler(Notifications);

    const bootstrap = async () => {
      const token = await syncPushNotifications(true);
      if (token && isMounted) {
        setExpoPushToken(token);
      }
      await refreshNotificationBadge();

      if (!initialHandled.current) {
        initialHandled.current = true;
        const initial = await getInitialNotificationResponse();
        if (initial && isMounted) {
          setNotificationResponse(initial);
        }
      }
    };

    void bootstrap();

    const uninstallLifecycle = installPushNotificationLifecycle(() => {
      void syncPushNotifications().then((token) => {
        if (token && isMounted) setExpoPushToken(token);
      });
    });

    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      void refreshNotificationBadge();

      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (!data || !isIncomingCallNotification(data)) return;

      const route = resolvePushNotificationRoute(data, 'client');
      if (route?.pathname === '/CallScreen') {
        router.push({
          pathname: route.pathname as any,
          params: route.params,
        } as any);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      setNotificationResponse(response);
      void refreshNotificationBadge();
    });

    return () => {
      isMounted = false;
      uninstallLifecycle();
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return {
    expoPushToken,
    notificationResponse,
  };
}
