import { isAuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';

let installed = false;

/**
 * Catches AuthError promise rejections that React error boundaries cannot reach.
 * Clears session once; root layout listener performs navigation.
 */
export function installAuthRejectionHandler(): () => void {
  if (installed) {
    return () => {};
  }
  installed = true;

  const handleAuth = (error: unknown) => {
    if (!isAuthError(error)) return;
    void (async () => {
      if (isInAuthTransition()) return;
      await expireAuthSession();
    })();
  };

  let previousUnhandled: ((event: unknown) => void) | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rejectionTracking = require('promise/setimmediate/rejection-tracking');
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, error: unknown) => {
        handleAuth(error);
      },
    });
  } catch {
    /* rejection tracking optional in some runtimes */
  }

  if (typeof global !== 'undefined') {
    previousUnhandled = (global as { onunhandledrejection?: (event: unknown) => void })
      .onunhandledrejection;
    (global as { onunhandledrejection?: (event: unknown) => void }).onunhandledrejection = (
      event: unknown
    ) => {
      const reason =
        event && typeof event === 'object' && 'reason' in event
          ? (event as { reason?: unknown }).reason
          : event;
      if (isAuthError(reason)) {
        if (event && typeof event === 'object' && 'preventDefault' in event) {
          (event as { preventDefault?: () => void }).preventDefault?.();
        }
        handleAuth(reason);
        return;
      }
      previousUnhandled?.(event);
    };
  }

  return () => {
    installed = false;
    if (typeof global !== 'undefined') {
      (global as { onunhandledrejection?: (event: unknown) => void }).onunhandledrejection =
        previousUnhandled;
    }
  };
}
