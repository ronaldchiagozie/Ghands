import { usePathname } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { resolveSignupResume } from '@/utils/signupProgress';
import { useEffect, useRef } from 'react';
import useOnboarding from '@/hooks/useOnboarding';
import { authService } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppEntryRoute } from '@/utils/authPublicRoutes';
import { ScreenBootLoader } from '@/components/ScreenBootLoader';
import { getRoleLoginRoute, handleTokenExpiration } from '@/utils/tokenExpirationHandler';

const AUTH_ROLE_KEY = '@ghands:user_role';

export default function ClientEntryPoint() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: onboardingLoading, isOnboardingComplete } = useOnboarding();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const checkAuthAndRoute = async () => {
      /**
       * The ref was set in four places and checked in none. This effect re-runs
       * when the onboarding flag resolves, and `pathname` does not update until
       * the navigation commits - so it could redirect a second time on top of
       * the first, which renders the destination twice.
       */
      if (hasRedirectedRef.current) {
        return;
      }

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
          /**
           * A token is a token. This used to send anyone whose token looked
           * expired to us straight to the login screen at launch, and clear
           * their session on the way, before a single request had been made.
           *
           * Our clock is not the server's. If the token really is dead the first
           * authenticated call comes back 401 and the session ends then, on the
           * server's word rather than the handset's. Being wrong here means
           * greeting somebody with a login screen for an account they never left.
           */
          hasRedirectedRef.current = true;

          /**
           * A half-finished signup still lands on Home - people are allowed to
           * look around before committing details. This only records how far
           * they got, so Home can surface what is outstanding and booking can
           * ask for it at the point it is actually needed.
           */
          void resolveSignupResume();
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
