import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { runGuardedNavigation } from '@/utils/navigationGuard';

/**
 * expo-router's router, with every move through the debounce.
 *
 * Imported as `useRouter` everywhere, so the call sites read exactly as
 * they did - there are over a hundred of them and rewriting each one would
 * have been a hundred chances to change behaviour by accident. Swapping
 * what `useRouter` means covers all of them at once and leaves the bodies
 * untouched.
 *
 * Only the four calls that actually move are wrapped. `setParams` updates
 * the screen you are already on, and the `can*` predicates answer
 * questions; debouncing either would break things that are not navigation.
 *
 * The object is memoised on the underlying router so screens holding it in
 * a dependency array do not re-run on every render.
 */
export function useGuardedRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();

  return useMemo(() => {
    const guarded = Object.create(router) as ReturnType<typeof useRouter>;

    guarded.push = ((...args: Parameters<typeof router.push>) =>
      runGuardedNavigation(() => router.push(...args))) as typeof router.push;

    guarded.replace = ((...args: Parameters<typeof router.replace>) =>
      runGuardedNavigation(() => router.replace(...args))) as typeof router.replace;

    guarded.back = (() => runGuardedNavigation(() => router.back())) as typeof router.back;

    if (typeof router.dismissTo === 'function') {
      guarded.dismissTo = ((...args: Parameters<typeof router.dismissTo>) =>
        runGuardedNavigation(() => router.dismissTo(...args))) as typeof router.dismissTo;
    }

    return guarded;
  }, [router]);
}

export default useGuardedRouter;
