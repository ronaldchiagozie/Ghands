import { useRouter, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import useOnboarding from '@/hooks/useOnboarding';
import { authService } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppEntryRoute } from '@/utils/authPublicRoutes';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { isAccessTokenExpired } from '@/utils/jwtExpiry';
import { getRoleLoginRoute, handleTokenExpiration } from '@/utils/tokenExpirationHandler';

const AUTH_ROLE_KEY = '@ghands:user_role';

export default function ClientEntryPoint() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: onboardingLoading, isOnboardingComplete } = useOnboarding();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const checkAuthAndRoute = async () => {
      const currentRoute = pathname || '/';
      const normalizedRoute = currentRoute.startsWith('/') ? currentRoute : `/${currentRoute}`;

      if (!isAppEntryRoute(normalizedRoute)) {
        return;
      }

      const goUnauthenticated = (onboardingComplete: boolean) => {
        hasRedirectedRef.current = true;
        if (onboardingComplete) {
          router.replace('/LoginScreen' as never);
        } else {
          router.replace('/onboarding' as never);
        }
      };

      try {
        await AsyncStorage.setItem(AUTH_ROLE_KEY, 'client');

        const token = await authService.getAuthToken();

        if (token) {
          if (isAccessTokenExpired(token)) {
            hasRedirectedRef.current = true;
            await handleTokenExpiration();
            const loginRoute = await getRoleLoginRoute();
            router.replace(loginRoute as never);
            return;
          }
          hasRedirectedRef.current = true;
          router.replace('/(tabs)/home' as never);
          return;
        }

        if (!onboardingLoading) {
          goUnauthenticated(isOnboardingComplete);
        }
      } catch {
        if (!isAppEntryRoute(normalizedRoute)) {
          return;
        }
        goUnauthenticated(isOnboardingComplete);
      }
    };

    const timer = setTimeout(() => {
      checkAuthAndRoute();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOnboardingComplete, onboardingLoading, router, pathname]);

  return <ScreenBootLoader />;
}
