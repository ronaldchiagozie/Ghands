import { authService } from '@/services/authService';

/** Login route for this client app (does not clear tokens). */
export async function getRoleLoginRoute(): Promise<string> {
  return '/LoginScreen';
}

/**
 * Clears auth tokens and returns the client login route.
 */
export async function handleTokenExpiration(): Promise<string> {
  try {
    const route = await getRoleLoginRoute();
    await authService.clearAuthTokens();
    return route;
  } catch {
    return '/LoginScreen';
  }
}

type RouterLike = { replace: (href: any) => void };

/** Clear session and navigate to client login. */
export async function logoutExpiredSession(
  router: RouterLike,
  pathname?: string | null
): Promise<void> {
  const { redirectToAuthScreen } = await import('@/utils/authNavigationGuard');
  await redirectToAuthScreen(router, { pathname, clearSession: true });
}

/**
 * Missing or expired token on a protected screen → role login (or account picker if unknown).
 */
export async function redirectUnauthenticated(
  router: RouterLike,
  pathname?: string | null
): Promise<void> {
  const { redirectToAuthScreen } = await import('@/utils/authNavigationGuard');
  const token = await authService.getAuthToken();
  await redirectToAuthScreen(router, {
    pathname,
    clearSession: Boolean(token),
  });
}

/**
 * Checks if error is a token expiration error (401)
 */
export function isTokenExpirationError(error: any): boolean {
  const status = error?.status || error?.response?.status;
  const message = (error?.message || error?.details?.data?.error || '').toLowerCase();

  return (
    status === 401 ||
    message.includes('unauthorized') ||
    message.includes('invalid token') ||
    message.includes('token expired') ||
    message.includes('not authenticated') ||
    message.includes('no authorization token') ||
    message.includes('authentication required')
  );
}
