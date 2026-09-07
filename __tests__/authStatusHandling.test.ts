/**
 * Which HTTP statuses are allowed to end a session.
 *
 * A 403 used to. That is wrong on its own terms - it means "you are signed in
 * and not allowed to do this", not "your session is invalid" - and it became a
 * trap when the backend started returning 403 PROVIDER_NOT_VERIFIED on gated
 * endpoints. An unverified provider opening the jobs tab or the profile tab was
 * signed out on the spot, so they could never stay in long enough to finish
 * verifying, and the toggle they happened to be touching got the blame.
 */

/** The rule the client applies after retries are exhausted. */
function endsSession(statusCode: number, retriedAfterRefresh: boolean, isNetworkErr = false) {
  if (isNetworkErr) return false;
  return statusCode === 401 && retriedAfterRefresh;
}

describe('what signs a user out', () => {
  it('ends the session on a 401 once a refresh has been tried', () => {
    expect(endsSession(401, true)).toBe(true);
  });

  it('does not end it on a 401 before the refresh attempt', () => {
    expect(endsSession(401, false)).toBe(false);
  });

  /** The reported bug. */
  it('never ends the session on a 403', () => {
    expect(endsSession(403, true)).toBe(false);
    expect(endsSession(403, false)).toBe(false);
  });

  it('leaves ordinary failures alone', () => {
    for (const status of [400, 404, 409, 422, 500, 502, 503]) {
      expect(endsSession(status, true)).toBe(false);
    }
  });

  /** A dropped connection is not evidence that a session ended. */
  it('never ends the session on a network error', () => {
    expect(endsSession(401, true, true)).toBe(false);
  });
});
