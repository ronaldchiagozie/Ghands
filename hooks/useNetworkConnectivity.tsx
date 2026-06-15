import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notifyNetworkRestored, subscribeToNetworkRestore } from '@/utils/networkRestoreEvents';

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

export function deriveOnlineFromNetInfo(state: NetInfoState | null | undefined): boolean {
  if (!state) return true;
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const wasOnlineRef = useRef(true);

  const applyNetState = useCallback((state: NetInfoState) => {
    const online = deriveOnlineFromNetInfo(state);
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

  const recheck = useCallback(async () => {
    const state = await NetInfo.fetch();
    const online = deriveOnlineFromNetInfo(state);
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
