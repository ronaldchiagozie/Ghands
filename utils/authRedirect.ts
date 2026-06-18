import { isRoleSwitchInProgress } from '@/hooks/useRoleSwitching';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';

/**
 * Auth failure (401 / expired JWT) — clears session once.
 * Root layout session-expired listener performs the single redirect.
 */
export async function handleAuthErrorRedirect(
  _router?: { replace: (href: any) => void },
  _pathname?: string | null
): Promise<void> {
  try {
    if (await isRoleSwitchInProgress()) return;
    if (isInAuthTransition()) return;
    await expireAuthSession();
  } catch {
    /* expireAuthSession is coalesced; navigation handled by session-expired listener */
  }
}
