import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { API_BASE_URL } from '@/lib/apiConfig';
import { notifyNetworkRestored } from '@/utils/networkRestoreEvents';

const PING_TIMEOUT_MS = 10_000;

type ApiUnreachableListener = () => void;
const apiUnreachableListeners = new Set<ApiUnreachableListener>();
let apiUnreachable = false;

/**
 * Why the app thinks it cannot talk to the server.
 *
 * These are different situations and they need different words. The device
 * being offline is something the person can act on; our server not answering is
 * not, and telling them to check a connection that is working is worse than
 * saying nothing.
 */
export type OfflineReason = 'device' | 'server';

/**
 * Call when authenticated API traffic fails due to connectivity (not auth).
 *
 * Note what this deliberately does not do: if the device link is down it returns
 * without latching, because NetInfo already covers that. So this latch always
 * means "the device has a connection and our server did not answer" - which is
 * exactly the case that was being shown as "You're offline. Check your
 * connection", to somebody whose connection was fine.
 */
export function reportApiUnreachable(): void {
  void (async () => {
    const state = await NetInfo.fetch();
    if (!deriveOnlineFromNetInfo(state)) return;
    if (apiUnreachable) return;

    /**
     * Confirm before taking over the screen.
     *
     * One failed request is not proof the server is unreachable. The backend
     * sleeps when idle and its first request after that can time out while it
     * wakes - which is most cold starts - and that was enough to throw a
     * full-screen "no connection" over an app that was about to work fine.
     *
     * A single cheap request settles it: any HTTP reply at all, including a 404
     * or a 500, means we can reach them and the original failure was a one-off
     * worth retrying quietly rather than announcing.
     */
    const reachable = await pingBackend();
    if (reachable) return;

    if (apiUnreachable) return;
    apiUnreachable = true;
    apiUnreachableListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* best effort */
      }
    });
  })();
}

/** Call when any API request succeeds - clears a stale "API unreachable" latch. */
export function clearApiUnreachable(): void {
  if (!apiUnreachable) return;
  apiUnreachable = false;
  notifyNetworkRestored();
}

export function subscribeApiUnreachable(listener: ApiUnreachableListener): () => void {
  apiUnreachableListeners.add(listener);
  return () => {
    apiUnreachableListeners.delete(listener);
  };
}

export function isApiUnreachable(): boolean {
  return apiUnreachable;
}

/**
 * NetInfo-only signal - avoids false offline from `isInternetReachable: false`
 * when the device is connected but NetInfo hasn't confirmed reachability yet.
 */
export function deriveOnlineFromNetInfo(state: NetInfoState | null | undefined): boolean {
  if (!state) return true;
  return state.isConnected !== false;
}

/**
 * Lightweight reachability check against the API host.
 * Any HTTP response (including 4xx/5xx) means the server is reachable.
 */
export async function pingBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      return typeof response.status === 'number';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** Device link up + backend responds - used for manual "Try again" rechecks. */
export async function checkConnectivity(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!deriveOnlineFromNetInfo(state)) {
    apiUnreachable = true;
    return false;
  }
  const reachable = await pingBackend();
  apiUnreachable = !reachable;
  if (reachable) {
    notifyNetworkRestored();
  }
  return reachable;
}
