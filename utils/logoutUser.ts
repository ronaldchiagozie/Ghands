import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Router } from 'expo-router';
import { authService } from '@/services/authService';
import { clearAppQueryCache } from '@/providers/QueryProvider';
import { markAuthSessionEnded } from '@/utils/authNavigationGuard';
import { getLoginRouteForStoredRole } from '@/utils/authPublicRoutes';
import { resetAuthSessionGate } from '@/utils/enforceAuthSession';
import { CLIENT_ACCOUNT_TYPE_KEY } from '@/utils/clientAccountType';

const PROVIDER_CACHE_KEYS = [
  '@ghands:business_name',
  '@ghands:company_name',
  '@ghands:provider_id',
  '@ghands:provider_name',
  '@ghands:provider_email',
  '@ghands:company_email',
  '@ghands:company_phone',
  '@ghands:profile_complete',
  CLIENT_ACCOUNT_TYPE_KEY,
] as const;

const PUSH_UNREGISTER_TIMEOUT_MS = 2500;

/**
 * Signs the user out: best-effort push unregister, clear tokens/cache, go to login.
 * Safe to call when the session is already expired.
 */
export async function logoutUser(router: Pick<Router, 'replace'>): Promise<void> {
  markAuthSessionEnded();

  try {
    const { unregisterPushOnLogout } = await import('@/utils/pushNotifications');
    await Promise.race([
      unregisterPushOnLogout(),
      new Promise<void>((resolve) => setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    /* never block sign-out on push cleanup */
  }

  await authService.clearAuthTokens();
  resetAuthSessionGate();
  await AsyncStorage.multiRemove([...PROVIDER_CACHE_KEYS]);
  clearAppQueryCache();

  /**
   * Re-arm the grace window before navigating.
   *
   * markAuthSessionEnded() at the top of this function opens a 3.5s window in
   * which the session poll stands down. Unregistering the push token can take up
   * to 2.5s of that, and the cache clears take more — so on a slow device the
   * window could expire between the token being cleared and this navigation.
   * The 2s poll would then see "no token on a protected route", redirect to
   * login itself, and the replace below would land on top of it: two
   * navigations, and a visible double render.
   */
  markAuthSessionEnded();

  const loginRoute = await getLoginRouteForStoredRole();
  router.replace(loginRoute as never);
}
