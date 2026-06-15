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
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';
import { redirectToAuthScreen } from '@/utils/authNavigationGuard';
import { subscribeToSessionExpired } from '@/utils/sessionExpiredEvents';
import { installAuthRejectionHandler } from '@/utils/installAuthRejectionHandler';
import { useNotifications } from '@/hooks/useNotifications';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { UserLocationProvider } from '@/hooks/useUserLocation';
import { NetworkProvider } from '@/hooks/useNetworkConnectivity';
import GlobalOfflineOverlay from '@/components/GlobalOfflineOverlay';
import { Colors } from '@/lib/designSystem';
import { Platform, StatusBar, View } from 'react-native';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { isRoleSwitchInProgress } from '@/hooks/useRoleSwitching';

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    // WebRTC native module — must not load on web (module throws if NativeModules.WebRTC is null)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-webrtc').registerGlobals();
  } catch {
    /* optional: old Expo Go without native webrtc */
  }
}

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
  const { notification } = useNotifications();
  
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
      await redirectToAuthScreen(router, {
        pathname: pathnameRef.current,
        clearSession: true,
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

    const uninstallRejectionHandler = installAuthRejectionHandler();

    return () => {
      performance.measure('app_init', 'app_init_start');
      uninstallRejectionHandler();
      if (ErrorUtilsGlobal && originalHandler) {
        ErrorUtilsGlobal.setGlobalHandler(originalHandler);
      }
    };
  }, [router]);

 
  useEffect(() => {
    if (!notification) return;

    const data = notification.request.content.data as Record<string, unknown> | undefined;
    if (!data) return;

    const typeRaw = data.type;
    const typeNorm =
      typeof typeRaw === 'string' ? typeRaw.toLowerCase() : String(typeRaw ?? '').toLowerCase();
    const requestId = data.requestId;

    // Chat / message pushes → messages screen (not job timeline)
    if (
      requestId != null &&
      requestId !== '' &&
      (typeNorm === 'message' ||
        typeNorm === 'chat_new' ||
        typeNorm === 'new_message' ||
        typeNorm === 'chat_message')
    ) {
      const meta =
        data.metadata && typeof data.metadata === 'object'
          ? (data.metadata as Record<string, unknown>)
          : null;
      const providerNameFromMeta =
        meta && typeof meta.providerName === 'string' ? meta.providerName : undefined;
      router.push({
        pathname: '/ChatScreen' as any,
        params: {
          requestId: String(requestId),
          ...(data.providerId != null && data.providerId !== '' && { providerId: String(data.providerId) }),
          ...(data.clientId != null && data.clientId !== '' && { clientId: String(data.clientId) }),
          ...(typeof data.providerName === 'string'
            ? { providerName: data.providerName }
            : providerNameFromMeta != null
              ? { providerName: providerNameFromMeta }
              : {}),
        },
      } as any);
      return;
    }

    if (data.requestId != null && data.requestId !== '') {
      if (
        typeNorm === 'quotation_accepted' ||
        typeNorm === 'quotation_sent' ||
        typeNorm === 'request_accepted' ||
        typeNorm === 'work_order_issued' ||
        typeNorm === 'work_order_created'
      ) {
        const screen = '/OngoingJobDetails';

        const quoteTab =
          typeNorm === 'quotation_sent' || typeNorm === 'quotation_accepted' ? 'quotations' : 'updates';
        router.push({
          pathname: screen as any,
          params: { requestId: String(data.requestId), tab: quoteTab },
        } as any);
      }
    } else if (typeNorm === 'deposit_success') {
      router.push('/WalletScreen' as any);
    }
  }, [notification, router]);

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
              <StatusBar barStyle="dark-content" backgroundColor={Colors.backgroundLight} translucent={false} />
              <TabletRootFrame>
                <Stack screenOptions={{ headerShown: false }} />
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
