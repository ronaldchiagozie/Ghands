import { type Router } from 'expo-router';
import { authService } from '@/services/authService';
import { clearAppQueryCache } from '@/providers/QueryProvider';
import { markAuthSessionEnded } from '@/utils/authNavigationGuard';
import { resetAuthSessionGate } from '@/utils/enforceAuthSession';
import { clearAllAppStorage } from '@/utils/accountStorage';
import { invalidateWalletBalanceCache } from '@/hooks/useWalletBalance';
import { resetStackTo } from '@/utils/navigation';

const PUSH_UNREGISTER_TIMEOUT_MS = 2500;

/**
 * Testing-only: returns the app to a fresh install - signed out, nothing
 * saved - and opens the marketing carousel and account-type picker.
 *
 * Mirrors logoutUser step for step - same push unregister, token clear,
 * cache clear, session-gate reset - because skipping any of those would leave
 * the app in a state that a real sign-out never produces, and this needs to
 * look exactly like one to the rest of the app right up until the last line,
 * where it goes to the carousel instead of login.
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
  /**
   * Everything, not a list: a demo has to start exactly as a new install does.
   * Clearing a handful of keys left the last account's id, booking draft,
   * signup progress and home tour flag behind, so a "fresh" run was not.
   */
  await clearAllAppStorage();
  clearAppQueryCache();
  invalidateWalletBalanceCache();

  /** Re-arm the grace window before navigating - see logoutUser for why. */
  markAuthSessionEnded();

  resetStackTo(router, '/onboarding');
}
