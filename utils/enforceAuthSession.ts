import { authService } from '@/services/authService';
import { AuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { isAccessTokenExpired } from '@/utils/jwtExpiry';
import { notifySessionExpired } from '@/utils/sessionExpiredEvents';

let expireInFlight: Promise<void> | null = null;
let invalidTokenGate: Promise<never> | null = null;

/** After login — allow assertValidAuthToken to read the new JWT again. */
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

/** Returns a valid access token or clears session and throws AuthError. */
export async function assertValidAuthToken(): Promise<string> {
  const token = await authService.getAuthToken();
  if (!token || isAccessTokenExpired(token)) {
    return getOrCreateInvalidTokenGate();
  }
  return token;
}

/** Proactive check for background polling — returns true when session was expired. */
export async function expireAuthSessionIfInvalid(): Promise<boolean> {
  const token = await authService.getAuthToken();
  if (!token || isAccessTokenExpired(token)) {
    await getOrCreateInvalidTokenGate().catch(() => {
      /* gate always rejects — callers await expireAuthSession side effects */
    });
    // The gate memoises expireAuthSession(), so its single notify fires only the
    // first time a token is found expired. If that one emission lands during an
    // auth transition it is dropped, and no later poll can ever re-emit it —
    // leaving the user stranded on any screen without its own AuthError handler.
    // Re-announce every tick instead; notifySessionExpired already coalesces.
    notifySessionExpired();
    return true;
  }
  return false;
}
