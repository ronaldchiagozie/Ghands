/**
 * Whether an access token has expired, decided on the device.
 *
 * Shared because both apps poll this every two seconds to decide whether the
 * session is still alive, and a difference between them is a difference in when
 * someone gets signed out.
 *
 * The decoder is hand-rolled for one reason: React Native has no `atob`. It is
 * not in Hermes, not in React Native's polyfills, and not in Expo's runtime.
 * Both apps' previous versions called it behind a `typeof atob` check and
 * returned "not expired" when it was missing — which it always was. The check
 * ran every two seconds and could never once return true, so neither app ever
 * expired a session on its own; they waited for a screen to make a call that
 * 401'd. In the client app the first screen that reliably does that is the
 * profile tab, which is why sessions appeared to survive until you opened it.
 *
 * The same file already proved the workaround elsewhere in the codebase:
 * `tokenUtils.ts` decodes JWTs with a manual base64 routine for exactly this
 * reason. This one is base64url-correct as well, which that one is not.
 */

/** Treat a token as expired slightly before `exp` so nobody is mid-request when it dies. */
const JWT_EXPIRY_SKEW_MS = 60_000;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decodes one base64url segment to a byte string.
 *
 * JWT segments are base64**url**: `-` and `_` stand in for `+` and `/`, and the
 * padding is dropped. Decoding them as plain base64 — which the provider app was
 * doing — yields nonsense for any token whose payload happens to contain either
 * character, and nonsense fails to parse, which reads as "not expired".
 *
 * Returns null rather than throwing, since a non-JWT token is a normal case.
 */
function decodeBase64UrlSegment(segment: string): string | null {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(normalized)) return null;

  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of normalized) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

/**
 * True when the token is a JWT whose `exp` has passed (within the skew).
 *
 * False for anything it cannot read — an opaque token, a malformed one, a JWT
 * with no `exp`. Those are not evidence of expiry, and signing someone out
 * because we failed to parse their token would be worse than waiting for the
 * server to reject it.
 */
export function isAccessTokenExpired(token: string, skewMs = JWT_EXPIRY_SKEW_MS): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const json = decodeBase64UrlSegment(parts[1]);
    if (!json) return false;

    const payload = JSON.parse(json) as { exp?: unknown };
    const exp = payload?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;

    return exp * 1000 <= Date.now() + skewMs;
  } catch {
    return false;
  }
}

export { JWT_EXPIRY_SKEW_MS };
