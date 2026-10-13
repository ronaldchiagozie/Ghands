import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notifyNetworkRestored, subscribeToNetworkRestore } from '@/utils/networkRestoreEvents';
import {
  checkConnectivity,
  clearApiUnreachable,
  deriveOnlineFromNetInfo,
  setDeviceOnline,
  isApiUnreachable,
  pingBackend,
  subscribeApiUnreachable,
  type OfflineReason,
} from '@/utils/connectivityCheck';

/** How often to ask the server again while it is the thing that is down. */
const SERVER_RECHECK_MS = 15_000;

export { deriveOnlineFromNetInfo } from '@/utils/connectivityCheck';

type NetworkContextValue = {
  isOnline: boolean;
  isInitialized: boolean;
  /** Which of the two problems it is, so the screen can say the true one. */
  offlineReason: OfflineReason | null;
  recheck: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInitialized: false,
  offlineReason: null,
  recheck: async () => true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [offlineReason, setOfflineReason] = useState<OfflineReason | null>(null);
  const wasOnlineRef = useRef(true);

  const applyNetState = useCallback((state: NetInfoState) => {
    const linkUp = deriveOnlineFromNetInfo(state);
    /**
     * Publish the device's own link state for code that has no hooks.
     * The API client words its errors from this: with the link up, a failed
     * request is the server not answering, not the customer's network.
     */
    setDeviceOnline(linkUp);
    const online = linkUp && !isApiUnreachable();
    setOfflineReason(online ? null : linkUp ? 'server' : 'device');
    if (wasOnlineRef.current && !online) {
      /* offline transition */
    }
    if (!wasOnlineRef.current && online) {
      notifyNetworkRestored();
    }
    wasOnlineRef.current = online;
    setIsOnline(online);
    setIsInitialized(true);
    /**
     * The link is up but an earlier failure left the server marked unreachable.
     * Ask it now rather than waiting: if it answers, the latch clears and the
     * app comes back without anybody tapping anything.
     */
    if (linkUp && isApiUnreachable()) {
      void checkConnectivity();
    }
  }, []);

  /**
   * While the server is the thing that is down, keep asking it. Nothing else
   * would: screens stop loading behind the offline page, so no request succeeds
   * to clear the latch, and the app waited on a tap to find out it was fine.
   */
  useEffect(() => {
    if (offlineReason !== 'server') return;
    const timer = setInterval(() => {
      void pingBackend().then((reachable) => {
        if (reachable) clearApiUnreachable();
      });
    }, SERVER_RECHECK_MS);
    return () => clearInterval(timer);
  }, [offlineReason]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(applyNetState);
    void NetInfo.fetch().then(applyNetState);
    return unsubscribe;
  }, [applyNetState]);

  useEffect(() => {
    return subscribeApiUnreachable(() => {
      /** This latch only fires with the device link up, so it is always the server. */
      wasOnlineRef.current = false;
      setOfflineReason('server');
      setIsOnline(false);
      setIsInitialized(true);
    });
  }, []);

  useEffect(() => {
    return subscribeToNetworkRestore(() => {
      void NetInfo.fetch().then((state) => {
        if (deriveOnlineFromNetInfo(state) && !isApiUnreachable()) {
          wasOnlineRef.current = true;
          setOfflineReason(null);
          setIsOnline(true);
          setIsInitialized(true);
        }
      });
    });
  }, []);

  const recheck = useCallback(async () => {
    const online = await checkConnectivity();
    const state = await NetInfo.fetch();
    setOfflineReason(online ? null : deriveOnlineFromNetInfo(state) ? 'server' : 'device');
    if (!wasOnlineRef.current && online) {
      notifyNetworkRestored();
    }
    wasOnlineRef.current = online;
    setIsOnline(online);
    setIsInitialized(true);
    return online;
  }, []);

  const value = useMemo(
    () => ({ isOnline, isInitialized, offlineReason, recheck }),
    [isOnline, isInitialized, offlineReason, recheck]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkConnectivity(): NetworkContextValue {
  return useContext(NetworkContext);
}

export function useIsOnline(): boolean {
  return useContext(NetworkContext).isOnline;
}

export function useOnNetworkRestore(callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return subscribeToNetworkRestore(() => {
      callbackRef.current();
    });
  }, []);
}
