import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/authService';
import { extractUserIdFromToken } from '@/utils/tokenUtils';
import { getSecureItem, setSecureItem } from '@/utils/secureStorage';

const CLIENT_DEV_TOKEN_KEY = '@ghands:dev_client_token';
const PROVIDER_DEV_TOKEN_KEY = '@ghands:dev_provider_token';
const AUTH_ROLE_KEY = '@ghands:user_role';

/**
 * Dev-only: keep the last client and provider tokens so both can be logged
 * after switching accounts (the app only stores one active token at a time).
 */
export async function cacheDevAuthTokenForRole(
  role: 'client' | 'provider',
  token: string
): Promise<void> {
  if (!__DEV__ || !token?.trim()) return;
  const key = role === 'client' ? CLIENT_DEV_TOKEN_KEY : PROVIDER_DEV_TOKEN_KEY;
  await setSecureItem(key, token.trim());
}

/**
 * Enough of a token to tell two of them apart, and no more.
 *
 * This log printed whole bearer tokens. It is __DEV__ only, so nothing reaches
 * production — but Metro output gets screenshotted, pasted into chats and
 * attached to bug reports, and a full token in any of those is a working
 * credential in somebody else's hands. Nothing about comparing tokens across a
 * role switch needs more than the ends.
 */
function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (trimmed.length <= 12) return '***';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)} (${trimmed.length} chars)`;
}

export async function logDevAuthTokens(context?: string): Promise<void> {
  if (!__DEV__) return;

  const label = context ? `[AuthTokens:${context}]` : '[AuthTokens]';

  try {
    const [activeToken, activeRole, userId, companyId] = await Promise.all([
      authService.getAuthToken(),
      AsyncStorage.getItem(AUTH_ROLE_KEY),
      authService.getUserId(),
      authService.getCompanyId(),
    ]);

    if (activeToken && (activeRole === 'client' || activeRole === 'provider')) {
      await cacheDevAuthTokenForRole(activeRole, activeToken);
    }

    const [clientToken, providerToken] = await Promise.all([
      getSecureItem(CLIENT_DEV_TOKEN_KEY),
      getSecureItem(PROVIDER_DEV_TOKEN_KEY),
    ]);

    console.log(label, {
      activeRole,
      activeUserId: userId,
      activeCompanyId: companyId,
      activeTokenUserId: activeToken ? extractUserIdFromToken(activeToken) : null,
      activeToken: maskToken(activeToken),
      clientToken: maskToken(clientToken),
      providerToken: maskToken(providerToken),
      /** UUID-shaped tokens carry no exp, so expiry is only knowable from a 401. */
      activeTokenLooksLikeJwt: activeToken ? activeToken.split('.').length === 3 : null,
      clientTokenUserId: clientToken ? extractUserIdFromToken(clientToken) : null,
      providerTokenUserId: providerToken ? extractUserIdFromToken(providerToken) : null,
    });
  } catch (error) {
    console.log(label, { error: String(error) });
  }
}
