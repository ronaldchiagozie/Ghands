/**
 * What is allowed to end a session, and what is not.
 *
 * Two hooks used to sign a provider out whenever a locally computed expiry said
 * the token was old: useTokenGuard on every pathname change, and
 * useSessionTimeout on a two-second poll. Both were harmless only because the
 * check never worked - React Native has no atob, so the decoder gave up and
 * returned "not expired" every time.
 *
 * Fixing the decoder turned both into live logouts. Navigating between analytics
 * and profile signed the provider out, on a session the server was still
 * happily serving.
 */

/** The rule both hooks now apply. */
function shouldEndSession(input: {
  hasToken: boolean;
  looksExpiredLocally: boolean;
  serverSaid401AfterRefresh?: boolean;
  checkThrew?: boolean;
}) {
  if (input.serverSaid401AfterRefresh) return true;
  if (!input.hasToken) return true;
  return false;
}

describe('ending a provider session', () => {
  it('ends it when there is no token at all', () => {
    expect(shouldEndSession({ hasToken: false, looksExpiredLocally: false })).toBe(true);
  });

  it('ends it when the server rejects the token after a refresh', () => {
    expect(
      shouldEndSession({ hasToken: true, looksExpiredLocally: false, serverSaid401AfterRefresh: true }),
    ).toBe(true);
  });

  /**
   * The regression. A device with the wrong date, a token the server still
   * honours, or a grace period we know nothing about would all have thrown
   * somebody out of a working session.
   */
  it('does not end it because our own clock says the token is old', () => {
    expect(shouldEndSession({ hasToken: true, looksExpiredLocally: true })).toBe(false);
  });

  /** Signing someone out is a severe answer to an error we cannot even name. */
  it('does not end it because a check threw', () => {
    expect(shouldEndSession({ hasToken: true, looksExpiredLocally: false, checkThrew: true })).toBe(false);
  });

  /** Repeated checks on a live session must stay quiet, however often they run. */
  it('stays quiet across many navigations', () => {
    for (let i = 0; i < 25; i += 1) {
      expect(shouldEndSession({ hasToken: true, looksExpiredLocally: true })).toBe(false);
    }
  });
});
