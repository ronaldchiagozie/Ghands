import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { API_BASE_URL } from '@/lib/apiConfig';

const PING_TIMEOUT_MS = 8_000;

type ApiUnreachableListener = () => void;
const apiUnreachableListeners = new Set<ApiUnreachableListener>();
let apiUnreachable = false;

/** Call when authenticated API traffic fails due to connectivity (not auth). */
export function reportApiUnreachable(): void {
  if (apiUnreachable) return;
  apiUnreachable = true;
  apiUnreachableListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* best effort */
    }
  });
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

/** Lightweight reachability check against the API host (any HTTP response = reachable). */
export async function pingBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.status < 500;
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
  return reachable;
}
