import { authService } from '@/services/api';
import { extractUserIdFromToken } from '@/utils/tokenUtils';

/**
 * The signed-in user's id, from storage or from the token behind it.
 *
 * The stored id can be missing when storage was cleared or migrated under a
 * session that is otherwise perfectly valid, and the token still carries it -
 * so falling back to the token is the difference between "please sign in
 * again" and simply carrying on. What it finds is written back, so the next
 * caller reads it straight from storage.
 *
 * Returns null when there is genuinely nothing to go on. Callers decide what
 * to say about that, because the right words depend on what they were doing.
 */
export async function resolveUserId(): Promise<number | null> {
  const stored = await authService.getUserId();
  if (stored) return stored;

  const token = await authService.getAuthToken();
  if (!token) return null;

  const extracted = extractUserIdFromToken(token);
  if (!extracted) return null;

  await authService.setUserId(extracted);
  return extracted;
}
