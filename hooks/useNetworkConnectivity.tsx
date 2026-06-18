import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notifyNetworkRestored, subscribeToNetworkRestore } from '@/utils/networkRestoreEvents';
import {
  checkConnectivity,
  deriveOnlineFromNetInfo,
  isApiUnreachable,
  subscribeApiUnreachable,
} from '@/utils/connectivityCheck';

export { deriveOnlineFromNetInfo } from '@/utils/connectivityCheck';

type NetworkContextValue = {
  isOnline: boolean;
  isInitialized: boolean;
  recheck: () => Promise<boolean>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInitialized: false,
  recheck: async () => true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const wasOnlineRef = useRef(true);

  const applyNetState = useCallback((state: NetInfoState) => {
    const linkUp = deriveOnlineFromNetInfo(state);
    const online = linkUp && !isApiUnreachable();
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
      wasOnlineRef.current = false;
      setIsOnline(false);
      setIsInitialized(true);
    });
  }, []);

  const recheck = useCallback(async () => {
    const online = await checkConnectivity();
    if (!wasOnlineRef.current && online) {
      notifyNetworkRestored();
    }
    wasOnlineRef.current = online;
    setIsOnline(online);
    setIsInitialized(true);
    return online;
  }, []);

  const value = useMemo(
    () => ({ isOnline, isInitialized, recheck }),
    [isOnline, isInitialized, recheck]
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
