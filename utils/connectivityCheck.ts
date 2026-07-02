import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { API_BASE_URL } from '@/lib/apiConfig';
import { notifyNetworkRestored } from '@/utils/networkRestoreEvents';

const PING_TIMEOUT_MS = 10_000;

type ApiUnreachableListener = () => void;
const apiUnreachableListeners = new Set<ApiUnreachableListener>();
let apiUnreachable = false;

/** Call when authenticated API traffic fails due to connectivity (not auth). */
export function reportApiUnreachable(): void {
  void NetInfo.fetch().then((state) => {
    if (!deriveOnlineFromNetInfo(state)) return;
    if (apiUnreachable) return;
    apiUnreachable = true;
    apiUnreachableListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* best effort */
      }
    });
  });
}

/** Call when any API request succeeds — clears a stale "API unreachable" latch. */
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
 * NetInfo-only signal — avoids false offline from `isInternetReachable: false`
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

/** Device link up + backend responds — used for manual "Try again" rechecks. */
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
