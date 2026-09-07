import { authService } from '@/services/authService';

/**
 * Stores the refresh token an auth response now carries.
 *
 * Until the backend added one, `refreshAuthToken` in the API client could never
 * work: it read a refresh token that nothing had ever written, found null, and
 * fell straight through to signing the person out. That was the whole reason a
 * single 401 ended a session with no way back.
 *
 * Called wherever an access token is stored, so login, signup and
 * complete-signup all keep the pair together. A response without one is normal
 * and silent: a deployment that predates the field is not an error, it simply
 * means the old behaviour continues.
 *
 * The envelope is read at every nesting level for the same reason the rest of
 * the app does: this API has returned `data.data`, `data`, and bare objects at
 * different times, and an auth response is the worst place to be strict.
 */
export function readRefreshToken(response: unknown): string | null {
  const source = response as Record<string, any> | null | undefined;
  const candidates = [
    source?.refreshToken,
    source?.data?.refreshToken,
    source?.data?.data?.refreshToken,
  ];

  const found = candidates.find((value) => typeof value === 'string' && value.trim());
  return found ? String(found).trim() : null;
}

export async function captureRefreshToken(response: unknown): Promise<void> {
  const refreshToken = readRefreshToken(response);
  if (!refreshToken) return;

  try {
    await authService.setRefreshToken(refreshToken);
  } catch {
    /* the session still works on the access token alone */
  }
}
