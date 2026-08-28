/**
 * Single source of truth for API base URL across the app.
 */
const DEFAULT_API_BASE_URL = 'https://bamibuildit-backend-v1-euv6.onrender.com';

/**
 * Endpoints are all written as `/api/...`, so a trailing slash on the base would
 * produce `//api/...`. Strip it here so a stray slash in .env or an EAS variable
 * cannot break every request. Kept identical to the provider app's apiConfig.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, '');

/** Bank transfer details for wallet top-up (set in EAS env for production). */
export function getBankTransferAccount(): { number: string; name: string } | null {
  const number = process.env.EXPO_PUBLIC_BANK_ACCOUNT_NUMBER?.trim();
  const name = process.env.EXPO_PUBLIC_BANK_ACCOUNT_NAME?.trim();
  if (!number || !name) return null;
  return { number, name };
}
