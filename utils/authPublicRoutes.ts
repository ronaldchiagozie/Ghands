/**
 * Routes where missing auth token should NOT trigger a forced redirect.
 * Keep in sync with app/index.tsx entry logic where possible.
 */
const PUBLIC_UNAUTHENTICATED_PREFIXES = [
  '/LoginScreen',
  '/ProviderSignInScreen',
  '/SignupScreen',
  '/CompanySignupScreen',
  '/ProviderSignUpScreen',
  '/ProviderSignupScreen',
  '/SelectAccountTypeScreen',
  '/ClientTypeSelectionScreen',
  '/ProviderTypeSelectionScreen',
  '/IndividualProviderComingSoonScreen',
  '/ResetPassword',
  '/ProviderResetPasswordScreen',
  '/OtpScreen',
  '/ProviderOtpScreen',
  '/PasswordConfirmation',
  '/CreatePINScreen',
  '/provider-onboarding',
  '/onboarding',
  '/ProviderSplashScreen',
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
 */
export async function getLoginRouteForStoredRole(): Promise<string> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const role = await AsyncStorage.getItem('@ghands:user_role');
  if (role === 'provider') return '/ProviderSignInScreen';
  if (role === 'client') return '/LoginScreen';
  return '/SelectAccountTypeScreen';
}
