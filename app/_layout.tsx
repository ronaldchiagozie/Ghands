import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter, usePathname } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabletRootFrame from '@/components/TabletRootFrame';
import '@/lib/nativewindSetup';
import '../global.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthErrorBoundary } from '@/components/AuthErrorBoundary';
import { analytics } from '@/services/analytics';
import { performance } from '@/services/performance';
import { crashReporting } from '@/services/crashReporting';
import { isAuthError } from '@/utils/errors';
import { isInAuthTransition, redirectToAuthScreen } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';
import { subscribeToSessionExpired } from '@/utils/sessionExpiredEvents';
import { resolvePushNotificationRoute } from '@/utils/notificationNavigation';
import { installAuthRejectionHandler } from '@/utils/installAuthRejectionHandler';
import { useNotifications } from '@/hooks/useNotifications';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { UserLocationProvider } from '@/hooks/useUserLocation';
import { NetworkProvider } from '@/hooks/useNetworkConnectivity';
import GlobalOfflineOverlay from '@/components/GlobalOfflineOverlay';
import AppStatusBar from '@/components/AppStatusBar';
import { installStatusBarRestore, applyDefaultStatusBar, applyHandyAiStatusBar, isHandyAiRoute } from '@/utils/statusBar';
import { registerWebRtcGlobalsIfAvailable } from '@/utils/webrtcAvailability';
import { installTypographyDefaults } from '@/lib/typographyDefaults';
import { Platform, View } from 'react-native';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { isRoleSwitchInProgress } from '@/hooks/useRoleSwitching';

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  registerWebRtcGlobalsIfAvailable();
}

installTypographyDefaults();

// ErrorUtils is a global in React Native, not exported from react-native
declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  /** No token on protected routes, or JWT expired → login (same as 401 handling) */
  useSessionTimeout(router, pathname);
  const { notificationResponse } = useNotifications();
  const lastHandledNotificationId = useRef<string | null>(null);
  
  const [fontsLoaded] = useFonts({
    'Outfit-Regular': require('../assets/fonts/Outfit/static/Outfit-Regular.ttf'),
    'Outfit-Medium': require('../assets/fonts/Outfit/static/Outfit-Medium.ttf'),
    'Outfit-SemiBold': require('../assets/fonts/Outfit/static/Outfit-SemiBold.ttf'),
    'Outfit-Bold': require('../assets/fonts/Outfit/static/Outfit-Bold.ttf'),
    'Outfit-ExtraBold': require('../assets/fonts/Outfit/static/Outfit-ExtraBold.ttf'),
    
    'Poppins-Regular': require('../assets/fonts/Poppins/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins/Poppins-Bold.ttf'),
    'Poppins-ExtraBold': require('../assets/fonts/Poppins/Poppins-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        /* iOS: avoid unhandled rejection if native splash wasn't registered */
      });
    }
  }, [fontsLoaded]);

  useEffect(() => {
    return installStatusBarRestore(() => pathnameRef.current);
  }, []);

  useEffect(() => {
    if (isHandyAiRoute(pathname)) {
      applyHandyAiStatusBar();
    } else {
      applyDefaultStatusBar();
    }
  }, [pathname]);

  useEffect(() => {
    const configureAndroidNav = async () => {
      if (Platform.OS !== 'android') return;
      try {
        await NavigationBar.setBackgroundColorAsync('#000000');
        await NavigationBar.setButtonStyleAsync('light');
      } catch (error) {
        console.warn('Navigation bar config failed', error);
        crashReporting.captureException(error as Error, { context: 'android_nav_config' });
      }
    };

    configureAndroidNav();
  }, []);

  useEffect(() => {
    const redirectOnSessionExpired = async () => {
      if (await isRoleSwitchInProgress()) return;
      if (isInAuthTransition()) return;
      await redirectToAuthScreen(router, {
        pathname: pathnameRef.current,
        clearSession: false,
        force: true,
      });
    };

    return subscribeToSessionExpired(redirectOnSessionExpired);
  }, [router]);

  useEffect(() => {
    // Initialize analytics and performance monitoring
    performance.mark('app_init_start');
    
    // Track app launch
    analytics.track('app_launched', {
      timestamp: new Date().toISOString(),
    });

    const redirectOnAuthError = async () => {
      if (await isRoleSwitchInProgress()) return;
      if (isInAuthTransition()) return;
      await expireAuthSession();
      await redirectToAuthScreen(router, {
        pathname: pathnameRef.current,
        clearSession: false,
        force: true,
      });
    };

    // Global error handler for AuthError (catches sync errors that React error boundaries can't)
    const ErrorUtilsGlobal = (global as any).ErrorUtils;
    const originalHandler = ErrorUtilsGlobal?.getGlobalHandler?.();
    if (ErrorUtilsGlobal) {
      ErrorUtilsGlobal.setGlobalHandler(async (error: Error, isFatal?: boolean) => {
        if (isAuthError(error)) {
          await redirectOnAuthError();
          return;
        }
        originalHandler?.(error, isFatal);
      });
    }

    const uninstallRejectionHandler = installAuthRejectionHandler(router);

    return () => {
      performance.measure('app_init', 'app_init_start');
      uninstallRejectionHandler();
      if (ErrorUtilsGlobal && originalHandler) {
        ErrorUtilsGlobal.setGlobalHandler(originalHandler);
      }
    };
  }, [router]);

 
  useEffect(() => {
    if (!notificationResponse) return;

    const notificationId = notificationResponse.notification.request.identifier;
    if (lastHandledNotificationId.current === notificationId) return;
    lastHandledNotificationId.current = notificationId;

    const data = notificationResponse.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    if (!data) return;

    const route = resolvePushNotificationRoute(data, 'client');
    if (route) {
      router.push({
        pathname: route.pathname as any,
        params: route.params,
      } as any);
    }
  }, [notificationResponse, router]);

  // Note: AuthError handling is now done by AuthErrorBoundary component
  // ApiClient throws AuthError, AuthErrorBoundary catches it and handles navigation + toast

  if (!fontsLoaded) {
    return <ScreenBootLoader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryProvider>
            <NetworkProvider>
            <View style={{ flex: 1 }}>
            <UserLocationProvider>
            <AuthErrorBoundary router={router}>
              <AppStatusBar />
              <TabletRootFrame>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen
                    name="(tabs)"
                    options={{
                      /** Tabs are the app shell — back swipe must not reveal booking screens below. */
                      gestureEnabled: false,
                    }}
                  />
                </Stack>
              </TabletRootFrame>
            </AuthErrorBoundary>
            </UserLocationProvider>
            <GlobalOfflineOverlay />
            </View>
            </NetworkProvider>
          </QueryProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
