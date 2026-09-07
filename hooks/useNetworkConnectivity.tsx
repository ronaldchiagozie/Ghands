import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notifyNetworkRestored, subscribeToNetworkRestore } from '@/utils/networkRestoreEvents';
import {
  checkConnectivity,
  deriveOnlineFromNetInfo,
  isApiUnreachable,
  subscribeApiUnreachable,
  type OfflineReason,
} from '@/utils/connectivityCheck';

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
  }, []);

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
