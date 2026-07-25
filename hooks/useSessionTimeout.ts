import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { authService } from '@/services/authService';
import { isPublicUnauthenticatedRoute } from '@/utils/authPublicRoutes';
import { isRoleSwitchInProgress } from '@/hooks/useRoleSwitching';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSessionIfInvalid } from '@/utils/enforceAuthSession';
import { notifySessionExpired } from '@/utils/sessionExpiredEvents';

/** How often to re-check JWT expiry while the app is open */
const SESSION_POLL_MS = 2_000;
/** Delay only the first cold-start check so SecureStore can hydrate */
const SESSION_BOOT_DELAY_MS = 200;

/**
 * Proactive session validation — clears invalid tokens and emits ONE session-expired
 * event. Navigation is handled only by the root layout listener (redirectToAuthScreen).
 */
export function useSessionTimeout(_router: unknown, pathname?: string | null) {
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const enforceAuth = async () => {
      try {
        if (await isRoleSwitchInProgress()) return;
        if (isInAuthTransition()) return;

        const path = pathnameRef.current;
        if (path && isPublicUnauthenticatedRoute(path)) return;

        const expired = await expireAuthSessionIfInvalid();
        if (expired) return;

        const token = await authService.getAuthToken();
        if (!token) {
          notifySessionExpired();
        }
      } catch {
        /* ignore */
      }
    };

    const bootTimer = setTimeout(() => {
      void enforceAuth();
    }, SESSION_BOOT_DELAY_MS);

    void enforceAuth();

    const pollId = setInterval(() => {
      void enforceAuth();
    }, SESSION_POLL_MS);

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void enforceAuth();
    });

    return () => {
      clearTimeout(bootTimer);
      clearInterval(pollId);
      appStateSub.remove();
    };
  }, [pathname]);
}
