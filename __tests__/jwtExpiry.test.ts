/**
 * Session expiry, decided on the device.
 *
 * The bug: both apps guarded the decode with `typeof atob` and returned "not
 * expired" when it was missing. React Native has no atob — not in Hermes, not
 * in RN's polyfills, not in Expo — so the two-second session poll could never
 * once return true. Neither app ever expired a session by itself; they waited
 * for a screen to make a call that 401'd.
 *
 * These tests run in Node, where atob DOES exist, so the old code would have
 * passed them. They are written against the hand-rolled decoder for that
 * reason: `atob` is deleted below so the test sees what the device sees.
 */
const realAtob = (globalThis as any).atob;

beforeAll(() => {
  // The device has no atob. Neither does this test.
  delete (globalThis as any).atob;
});

afterAll(() => {
  (globalThis as any).atob = realAtob;
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isAccessTokenExpired, JWT_EXPIRY_SKEW_MS } = require('@/contract/src/jwtExpiry');

/** Builds a JWT without any base64 helper, for the same reason. */
function makeToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < json.length; i += 3) {
    const a = json.charCodeAt(i);
    const b = i + 1 < json.length ? json.charCodeAt(i + 1) : NaN;
    const c = i + 2 < json.length ? json.charCodeAt(i + 2) : NaN;
    out += alphabet[a >> 2];
    out += alphabet[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)];
    out += Number.isNaN(b) ? '=' : alphabet[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)];
    out += Number.isNaN(c) ? '=' : alphabet[c & 63];
  }
  const base64url = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${base64url}.signature`;
}

const secondsFromNow = (s: number) => Math.floor(Date.now() / 1000) + s;

describe('isAccessTokenExpired', () => {
  /** The whole point: this returned false forever on a real device. */
  it('detects an expired token without atob', () => {
    expect(isAccessTokenExpired(makeToken({ exp: secondsFromNow(-60) }))).toBe(true);
  });

  it('leaves a live token alone', () => {
    expect(isAccessTokenExpired(makeToken({ exp: secondsFromNow(3600) }))).toBe(false);
  });

  /** Nobody should be mid-request when the token dies. */
  it('expires a token that is inside the skew window', () => {
    expect(isAccessTokenExpired(makeToken({ exp: secondsFromNow(10) }))).toBe(true);
    expect(isAccessTokenExpired(makeToken({ exp: secondsFromNow(JWT_EXPIRY_SKEW_MS / 1000 + 30) }))).toBe(false);
  });

  /**
   * base64url, not base64. A payload containing - or _ decoded as plain base64
   * is nonsense, nonsense fails to parse, and a parse failure reads as "not
   * expired" — an expired session that never ends.
   */
  it('handles a payload whose base64 contains url-safe characters', () => {
    const payload = { exp: secondsFromNow(-60), sub: 'a~b?c>d', note: '<<>>??~~' };
    const token = makeToken(payload);
    expect(token.split('.')[1]).toMatch(/[-_]/);
    expect(isAccessTokenExpired(token)).toBe(true);
  });

  describe('refuses to guess', () => {
    /** Signing someone out because we could not read their token is worse than waiting. */
    it('treats an unreadable token as live', () => {
      expect(isAccessTokenExpired('an-opaque-uuid-token')).toBe(false);
      expect(isAccessTokenExpired('header.!!!not-base64!!!.sig')).toBe(false);
      expect(isAccessTokenExpired('two.parts')).toBe(false);
      expect(isAccessTokenExpired('')).toBe(false);
      expect(isAccessTokenExpired(null as any)).toBe(false);
    });

    it('treats a JWT with no usable exp as live', () => {
      expect(isAccessTokenExpired(makeToken({ sub: 'user-1' }))).toBe(false);
      expect(isAccessTokenExpired(makeToken({ exp: 'soon' }))).toBe(false);
      expect(isAccessTokenExpired(makeToken({ exp: null }))).toBe(false);
    });
  });
});
