import { isInAuthTransition } from '@/utils/authNavigationGuard';

type SessionExpiredListener = () => void | Promise<void>;

const listeners = new Set<SessionExpiredListener>();
let notifyQueued = false;
let lastNotifyAt = 0;

const NOTIFY_COOLDOWN_MS = 3000;

export function subscribeToSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Coalesce burst 401 / missing-token events into one redirect wave. */
export function notifySessionExpired(): void {
  const now = Date.now();
  if (isInAuthTransition() || notifyQueued) return;
  if (now - lastNotifyAt < NOTIFY_COOLDOWN_MS) return;

  notifyQueued = true;
  lastNotifyAt = now;

  listeners.forEach((listener) => {
    Promise.resolve(listener()).catch(() => {
      /* best effort: auth guards will retry on route/app-state changes */
    });
  });

  setTimeout(() => {
    notifyQueued = false;
  }, NOTIFY_COOLDOWN_MS);
}
