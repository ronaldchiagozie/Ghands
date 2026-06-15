import type { Router } from 'expo-router';
import { getLoginRouteForStoredRole, isPublicUnauthenticatedRoute } from '@/utils/authPublicRoutes';
import { handleTokenExpiration } from '@/utils/tokenExpirationHandler';

type RouterLike = Pick<Router, 'replace'>;

let redirectInFlight = false;
let lastRedirectAt = 0;
let sessionEndedAt = 0;

const REDIRECT_COOLDOWN_MS = 4000;
const SESSION_END_GRACE_MS = 5000;

function normalizePath(pathname: string): string {
  const p = pathname.trim();
  if (!p || p === '/') return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

/** Call before logout or intentional sign-out so API guards do not spam redirects. */
export function markAuthSessionEnded(): void {
  const now = Date.now();
  sessionEndedAt = now;
  lastRedirectAt = now;
}

/** True while logout / redirect-to-login is in progress or just finished. */
export function isInAuthTransition(): boolean {
  const now = Date.now();
  return (
    redirectInFlight ||
    now - lastRedirectAt < REDIRECT_COOLDOWN_MS ||
    now - sessionEndedAt < SESSION_END_GRACE_MS
  );
}

/**
 * Single entry for forced navigation to login — prevents redirect loops.
 * Returns true when a navigation was performed.
 */
export async function redirectToAuthScreen(
  router: RouterLike,
  options: {
    pathname?: string | null;
    clearSession?: boolean;
  } = {}
): Promise<boolean> {
  const { pathname, clearSession = true } = options;
  const now = Date.now();

  if (pathname && isPublicUnauthenticatedRoute(pathname)) {
    return false;
  }

  if (redirectInFlight) return false;
  if (now - lastRedirectAt < REDIRECT_COOLDOWN_MS) return false;

  redirectInFlight = true;
  markAuthSessionEnded();

  try {
    const route = clearSession ? await handleTokenExpiration() : await getLoginRouteForStoredRole();

    if (pathname && normalizePath(pathname) === normalizePath(route)) {
      redirectInFlight = false;
      return false;
    }

    router.replace(route as never);
    lastRedirectAt = Date.now();
    return true;
  } catch {
    try {
      router.replace('/SelectAccountTypeScreen' as never);
      return true;
    } catch {
      return false;
    }
  } finally {
    setTimeout(() => {
      redirectInFlight = false;
    }, 600);
  }
}
