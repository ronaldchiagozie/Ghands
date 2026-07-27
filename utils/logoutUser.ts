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

  const loginRoute = await getLoginRouteForStoredRole();
  router.replace(loginRoute as never);
}
