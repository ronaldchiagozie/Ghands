import { authService } from '@/services/authService';
import { AuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { notifySessionExpired } from '@/utils/sessionExpiredEvents';

let expireInFlight: Promise<void> | null = null;
let invalidTokenGate: Promise<never> | null = null;

/** After login - allow assertValidAuthToken to read the new JWT again. */
export function resetAuthSessionGate(): void {
  invalidTokenGate = null;
}

function getOrCreateInvalidTokenGate(): Promise<never> {
  if (!invalidTokenGate) {
    const authError = new AuthError('Your session has expired. Please sign in again.');
    invalidTokenGate = expireAuthSession()
      .then(() => {
        throw authError;
      })
      .catch((error) => {
        if (error instanceof AuthError) throw error;
        throw authError;
      }) as Promise<never>;
  }
  return invalidTokenGate;
}

/** Clear stored tokens and notify listeners (coalesced). Safe to call concurrently. */
export async function expireAuthSession(): Promise<void> {
  if (expireInFlight) {
    await expireInFlight;
    return;
  }

  expireInFlight = (async () => {
    try {
      const { unregisterPushOnLogout } = await import('@/utils/pushNotifications');
      await unregisterPushOnLogout();
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

/**
 * Returns the stored token, or ends the session when there is not one.
 *
 * A token that looks expired to us is returned anyway. Our clock is not the
 * server's: a device with the wrong date, a token the server still honours, or
 * a grace period we know nothing about all end with somebody thrown out of a
 * working session. The server answers this with a 401 and the API client acts
 * on that, which is the only authoritative reading.
 *
 * This mattered the moment the expiry check started working. It had been
 * returning false for the life of the app, because React Native has no atob and
 * the decoder gave up without one.
 */
export async function assertValidAuthToken(): Promise<string> {
  const token = await authService.getAuthToken();
  if (!token) {
    return getOrCreateInvalidTokenGate();
  }
  return token;
}

/** Proactive check for background polling - returns true when session was expired. */
export async function expireAuthSessionIfInvalid(): Promise<boolean> {
  const token = await authService.getAuthToken();
  /** No token is unambiguous. A locally computed expiry is not; see above. */
  if (!token) {
    await getOrCreateInvalidTokenGate().catch(() => {
      /* gate always rejects - callers await expireAuthSession side effects */
    });
    // The gate memoises expireAuthSession(), so its single notify fires only the
    // first time a token is found expired. If that one emission lands during an
    // auth transition it is dropped, and no later poll can ever re-emit it -
    // leaving the user stranded on any screen without its own AuthError handler.
    // Re-announce every tick instead; notifySessionExpired already coalesces.
    notifySessionExpired();
    return true;
  }
  return false;
}
