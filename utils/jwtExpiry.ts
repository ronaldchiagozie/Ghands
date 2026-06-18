/** Treat token as expired slightly before `exp` so users are not mid-request when it dies. */
const JWT_EXPIRY_SKEW_MS = 60_000;

function decodeJwtPayloadSegment(segment: string): string | null {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }
  return null;
}

/**
 * Client-side JWT expiration check (access token `exp` claim).
 * Non-JWT tokens (e.g. opaque UUID) return false — rely on API 401 for those.
 */
export function isAccessTokenExpired(token: string, skewMs = JWT_EXPIRY_SKEW_MS): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = decodeJwtPayloadSegment(parts[1]);
    if (!json) return false;
    const obj = JSON.parse(json) as { exp?: number };
    if (obj.exp == null || typeof obj.exp !== 'number') return false;
    return obj.exp * 1000 <= Date.now() + skewMs;
  } catch {
    return false;
  }
}

export { JWT_EXPIRY_SKEW_MS };
