import { isRoleSwitchInProgress } from '@/hooks/useRoleSwitching';
import { isInAuthTransition, redirectToAuthScreen } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';
import { isAuthError } from '@/utils/errors';

/**
 * Auth failure (401 / expired JWT) — clears session once.
 * When `router` is passed, also forces navigation to login (avoids getting stuck
 * on screens that swallow AuthError, e.g. AI chat).
 */
export async function handleAuthErrorRedirect(
  router?: { replace: (href: any) => void },
  pathname?: string | null
): Promise<void> {
  try {
    if (await isRoleSwitchInProgress()) return;
    if (!router && isInAuthTransition()) return;
    await expireAuthSession();
    if (router) {
      await redirectToAuthScreen(router, {
        pathname,
        clearSession: false,
        force: true,
      });
    }
  } catch {
    /* expireAuthSession is coalesced; navigation handled by session-expired listener */
  }
}

/** Returns true when the error was an auth failure and redirect was triggered. */
export async function handleApiAuthFailure(
  error: unknown,
  router?: { replace: (href: any) => void },
  pathname?: string | null
): Promise<boolean> {
  if (!isAuthError(error)) return false;
  await handleAuthErrorRedirect(router, pathname);
  return true;
}

/** Fire-and-forget async work — auth failures redirect instead of uncaught rejections. */
export function runAuthSafe(
  task: () => Promise<void>,
  router?: { replace: (href: any) => void },
  pathname?: string | null,
): void {
  void task().catch(async (error) => {
    await handleApiAuthFailure(error, router, pathname);
  });
}
