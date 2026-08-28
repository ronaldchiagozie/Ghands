import { isAppEntryRoute, isPublicUnauthenticatedRoute } from '@/utils/authPublicRoutes';

describe('signup-flow routes must survive a missing token', () => {
  /**
   * The regression this guards: ProfileCompletionScreen was NOT listed, so the
   * 2-second session poll in useSessionTimeout saw "no token on a protected
   * route", fired notifySessionExpired, and the root layout replaced the screen
   * with /LoginScreen — mid-form, right after signup. From there "Sign up" sent
   * users to /onboarding and back to Choose Your Account Type.
   */
  it.each([
    '/ProfileCompletionScreen',
    '/SignupScreen',
    '/LoginScreen',
    '/ClientTypeSelectionScreen',
    '/OtpScreen',
    '/CreatePINScreen',
    '/onboarding',
  ])('treats %s as reachable without a token', (route) => {
    expect(isPublicUnauthenticatedRoute(route)).toBe(true);
  });

  it.each(['/(tabs)/home', '/WalletScreen', '/OngoingJobDetails', '/ConfirmWalletPaymentScreen'])(
    'still protects %s',
    (route) => {
      expect(isPublicUnauthenticatedRoute(route)).toBe(false);
    },
  );

  it('does not treat the entry route as public', () => {
    expect(isPublicUnauthenticatedRoute('/')).toBe(false);
    expect(isPublicUnauthenticatedRoute('/index')).toBe(false);
  });

  it('normalizes a path without a leading slash', () => {
    expect(isPublicUnauthenticatedRoute('ProfileCompletionScreen')).toBe(true);
  });

  it('matches nested paths under a public prefix', () => {
    expect(isPublicUnauthenticatedRoute('/OtpScreen/verify')).toBe(true);
  });

  it('does not match a route that merely starts with the same letters', () => {
    expect(isPublicUnauthenticatedRoute('/LoginScreenSettings')).toBe(false);
  });
});

describe('isAppEntryRoute', () => {
  it('only the entry route runs cold-start redirects', () => {
    expect(isAppEntryRoute('/')).toBe(true);
    expect(isAppEntryRoute('/index')).toBe(true);
    expect(isAppEntryRoute(null)).toBe(true);
    expect(isAppEntryRoute('/ProfileCompletionScreen')).toBe(false);
  });
});
