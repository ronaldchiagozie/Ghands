import { QueryClient, QueryClientProvider, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import React from 'react';
import { isAuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';
import {
  deriveOnlineFromNetInfo,
  isApiUnreachable,
  subscribeApiUnreachable,
} from '@/utils/connectivityCheck';
import { subscribeToNetworkRestore } from '@/utils/networkRestoreEvents';

onlineManager.setEventListener((setOnline) => {
  const apply = (state: Parameters<typeof deriveOnlineFromNetInfo>[0]) => {
    setOnline(deriveOnlineFromNetInfo(state) && !isApiUnreachable());
  };

  const unsubNet = NetInfo.addEventListener(apply);
  const unsubApi = subscribeApiUnreachable(() => setOnline(false));
  const unsubRestore = subscribeToNetworkRestore(() => setOnline(true));
  void NetInfo.fetch().then(apply);

  return () => {
    unsubNet();
    unsubApi();
    unsubRestore();
  };
});

function handleQueryAuthError(error: unknown) {
  if (!isAuthError(error)) return;
  if (isInAuthTransition()) return;
  void expireAuthSession();
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleQueryAuthError,
  }),
  mutationCache: new MutationCache({
    onError: handleQueryAuthError,
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 1;
      },
    },
  },
});

/** Clear cached user data after sign-out. */
export function clearAppQueryCache(): void {
  queryClient.clear();
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
