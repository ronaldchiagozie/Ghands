import { authService } from '@/services/authService';
import { AuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { isAccessTokenExpired } from '@/utils/jwtExpiry';
import { notifySessionExpired } from '@/utils/sessionExpiredEvents';

let expireInFlight: Promise<void> | null = null;

/** Clear stored tokens and notify listeners (coalesced). Safe to call concurrently. */
export async function expireAuthSession(): Promise<void> {
  if (expireInFlight) {
    await expireInFlight;
    return;
  }

  expireInFlight = (async () => {
    try {
      await authService.clearAuthTokens();
      if (!isInAuthTransition()) {
        notifySessionExpired();
      }
    } finally {
      expireInFlight = null;
    }
  })();

  await expireInFlight;
}

/** Returns a valid access token or clears session and throws AuthError. */
export async function assertValidAuthToken(): Promise<string> {
  const token = await authService.getAuthToken();
  if (!token || isAccessTokenExpired(token)) {
    await expireAuthSession();
    throw new AuthError('Your session has expired. Please sign in again.');
  }
  return token;
}

/** Proactive check for background polling — returns true when session was expired. */
export async function expireAuthSessionIfInvalid(): Promise<boolean> {
  const token = await authService.getAuthToken();
  if (!token || isAccessTokenExpired(token)) {
    await expireAuthSession();
    return true;
  }
  return false;
}
