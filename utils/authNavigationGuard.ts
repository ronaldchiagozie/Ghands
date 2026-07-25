import type { Router } from 'expo-router';
import { getLoginRouteForStoredRole, isPublicUnauthenticatedRoute } from '@/utils/authPublicRoutes';
import { handleTokenExpiration } from '@/utils/tokenExpirationHandler';

type RouterLike = Pick<Router, 'replace'>;

let redirectInFlight = false;
let lastRedirectAt = 0;
let sessionEndedAt = 0;
let lastRedirectRoute: string | null = null;

const REDIRECT_COOLDOWN_MS = 3000;
const SESSION_END_GRACE_MS = 3500;
const REDIRECT_IN_FLIGHT_MS = 2500;

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
    /** Intentional sign-out — bypass cooldown but still dedupe in-flight. */
    force?: boolean;
  } = {}
): Promise<boolean> {
  const { pathname, clearSession = true, force = false } = options;
  const now = Date.now();

  if (pathname && isPublicUnauthenticatedRoute(pathname)) {
    return false;
  }

  if (redirectInFlight && !force) return false;
  if (!force && now - lastRedirectAt < REDIRECT_COOLDOWN_MS) return false;

  redirectInFlight = true;
  markAuthSessionEnded();

  try {
    const route = clearSession ? await handleTokenExpiration() : await getLoginRouteForStoredRole();
    const normalizedRoute = normalizePath(route);

    if (pathname && normalizePath(pathname) === normalizedRoute) {
      return false;
    }

    if (lastRedirectRoute === normalizedRoute && !force && now - lastRedirectAt < REDIRECT_COOLDOWN_MS) {
      return false;
    }

    router.replace(route as never);
    lastRedirectRoute = normalizedRoute;
    lastRedirectAt = Date.now();
    return true;
  } catch {
    try {
      router.replace('/SelectAccountTypeScreen' as never);
      lastRedirectRoute = '/SelectAccountTypeScreen';
      lastRedirectAt = Date.now();
      return true;
    } catch {
      return false;
    }
  } finally {
    setTimeout(() => {
      redirectInFlight = false;
    }, REDIRECT_IN_FLIGHT_MS);
  }
}
