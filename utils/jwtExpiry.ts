/**
 * Re-exported from the shared contract so this app and the provider app agree
 * on when a session has ended. See contract/src/jwtExpiry.ts for why the base64
 * decoding is hand-rolled.
 */
export { isAccessTokenExpired, JWT_EXPIRY_SKEW_MS } from '@/contract/src/jwtExpiry';
