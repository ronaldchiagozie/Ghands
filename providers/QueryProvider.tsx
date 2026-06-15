import { QueryClient, QueryClientProvider, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import React from 'react';
import { isAuthError } from '@/utils/errors';
import { isInAuthTransition } from '@/utils/authNavigationGuard';
import { expireAuthSession } from '@/utils/enforceAuthSession';
import { deriveOnlineFromNetInfo } from '@/hooks/useNetworkConnectivity';

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(deriveOnlineFromNetInfo(state));
  });
});

function handleQueryAuthError(error: unknown) {
  if (!isAuthError(error)) return;
  if (isInAuthTransition()) return;
  void expireAuthSession();
}

// Create a client with sensible defaults
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
