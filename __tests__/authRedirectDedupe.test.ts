/**
 * One expired session, one trip to the login screen.
 *
 * What went wrong: `force: true` skipped every guard in redirectToAuthScreen,
 * and both callers on the expiry path passed it — the root layout's
 * session-expired listener, and every screen's AuthError handler. So the dedupe
 * was disabled on precisely the path it was written for. Tab screens stay
 * mounted, so an expired token 401'd several fetches at once and each one
 * navigated: the login screen appeared three times in a row.
 */
jest.mock('@/utils/authPublicRoutes', () => ({
  getLoginRouteForStoredRole: jest.fn(async () => '/LoginScreen'),
  isPublicUnauthenticatedRoute: jest.fn(() => false),
}));
jest.mock('@/utils/tokenExpirationHandler', () => ({
  handleTokenExpiration: jest.fn(async () => '/LoginScreen'),
}));

describe('redirectToAuthScreen', () => {
  let redirectToAuthScreen: any;
  let router: { replace: jest.Mock };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Module-level redirect state must start clean for each case.
    redirectToAuthScreen = require('@/utils/authNavigationGuard').redirectToAuthScreen;
    router = { replace: jest.fn() };
  });

  /** The reported bug, in one assertion. */
  it('navigates once when several screens report the same expiry', async () => {
    await Promise.all([
      redirectToAuthScreen(router, { pathname: '/(tabs)/profile', clearSession: false }),
      redirectToAuthScreen(router, { pathname: '/(tabs)/home', clearSession: false }),
      redirectToAuthScreen(router, { pathname: '/(tabs)/jobs', clearSession: false }),
    ]);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/LoginScreen');
  });

  /**
   * The specific regression. force is for skipping the cooldown, never for
   * skipping the in-flight check — concurrent navigations are always a bug.
   */
  it('still navigates once when the callers force', async () => {
    await Promise.all([
      redirectToAuthScreen(router, { pathname: '/(tabs)/profile', clearSession: false, force: true }),
      redirectToAuthScreen(router, { pathname: '/(tabs)/home', clearSession: false, force: true }),
      redirectToAuthScreen(router, { pathname: '/(tabs)/jobs', clearSession: false, force: true }),
    ]);

    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when the screen is already the login screen', async () => {
    await redirectToAuthScreen(router, { pathname: '/LoginScreen', clearSession: false });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('leaves a public route alone', async () => {
    const publicRoutes = require('@/utils/authPublicRoutes');
    publicRoutes.isPublicUnauthenticatedRoute.mockReturnValue(true);

    await redirectToAuthScreen(router, { pathname: '/OnboardingScreen', clearSession: false });
    expect(router.replace).not.toHaveBeenCalled();
  });

  /** A second, later expiry must still be able to redirect. */
  it('is not a permanent lock', async () => {
    await redirectToAuthScreen(router, { pathname: '/(tabs)/profile', clearSession: false });
    expect(router.replace).toHaveBeenCalledTimes(1);

    jest.resetModules();
    const fresh = require('@/utils/authNavigationGuard').redirectToAuthScreen;
    const laterRouter = { replace: jest.fn() };
    await fresh(laterRouter, { pathname: '/(tabs)/profile', clearSession: false });
    expect(laterRouter.replace).toHaveBeenCalledTimes(1);
  });
});
