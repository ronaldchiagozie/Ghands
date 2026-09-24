import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Router } from 'expo-router';
import { authService } from '@/services/authService';
import { clearAppQueryCache } from '@/providers/QueryProvider';
import { markAuthSessionEnded } from '@/utils/authNavigationGuard';
import { resetAuthSessionGate } from '@/utils/enforceAuthSession';
import { CLIENT_ACCOUNT_TYPE_KEY } from '@/utils/clientAccountType';
import { ONBOARDING_STORAGE_KEY } from '@/hooks/useOnboarding';

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
 * Testing-only: signs out and clears the "onboarding seen" flag together, so
 * the very next launch replays the marketing carousel and account-type
 * picker instead of landing on the login screen. Mirrors logoutUser step for
 * step - same push unregister, token clear, cache clear, session-gate reset
 * - because skipping any of those would leave the app in a state that a real
 * sign-out never produces, and this needs to look exactly like one to the
 * rest of the app right up until the last line, where it goes to the
 * carousel instead of login.
 */
export async function resetOnboardingForTesting(router: Pick<Router, 'replace'>): Promise<void> {
  markAuthSessionEnded();

  try {
    const { unregisterPushOnLogout } = await import('@/utils/pushNotifications');
    await Promise.race([
      unregisterPushOnLogout(),
      new Promise<void>((resolve) => setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS)),
    ]);
  } catch {
    /* never block on push cleanup */
  }

  await authService.clearAuthTokens();
  resetAuthSessionGate();
  await AsyncStorage.multiRemove([...PROVIDER_CACHE_KEYS, ONBOARDING_STORAGE_KEY]);
  clearAppQueryCache();

  /** Re-arm the grace window before navigating - see logoutUser for why. */
  markAuthSessionEnded();

  router.replace('/onboarding' as never);
}
