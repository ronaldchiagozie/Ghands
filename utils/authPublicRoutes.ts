/**
 * Routes where missing auth token should NOT trigger a forced redirect.
 * Keep in sync with app/index.tsx entry logic where possible.
 * Provider auth screens live in the separate provider app — do not list them here.
 */
const PUBLIC_UNAUTHENTICATED_PREFIXES = [
  '/LoginScreen',
  '/SignupScreen',
  '/CompanySignupScreen',
  '/SelectAccountTypeScreen',
  '/ClientTypeSelectionScreen',
  '/ResetPassword',
  '/OtpScreen',
  '/PasswordConfirmation',
  '/CreatePINScreen',
  '/onboarding',
  '/LocationPermissionScreen',
  /** Expo root / entry */
  '/index',
];

function normalizePath(pathname: string): string {
  const p = pathname.trim();
  if (!p || p === '/') return '/';
  return p.startsWith('/') ? p : `/${p}`;
}

/** True when the app entry route is active — only these should run cold-start redirects. */
export function isAppEntryRoute(pathname: string | null | undefined): boolean {
  if (pathname == null || pathname === '') return true;
  const p = normalizePath(pathname);
  return p === '/' || p === '/index';
}

/**
 * True if user may view this path without a stored access token (login/signup/onboarding).
 * Does NOT include `/` or `/index` — those are entry routes only (see isAppEntryRoute).
 */
export function isPublicUnauthenticatedRoute(pathname: string | null | undefined): boolean {
  if (pathname == null || pathname === '') return false;
  const p = normalizePath(pathname);
  if (p === '/' || p === '/index') return false;

  return PUBLIC_UNAUTHENTICATED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}

/**
 * Where to send the user when token is missing but we know last role (no storage clear).
 * This is the client app — always client login.
 */
export async function getLoginRouteForStoredRole(): Promise<string> {
  return '/LoginScreen';
}
