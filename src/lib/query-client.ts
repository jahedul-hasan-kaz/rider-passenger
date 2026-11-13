import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { isApiError, isAuthFailure } from '@/api/errors';

// Server state (docs/spec/01-overview-foundation.md §3). The API client already retries transient failures with
// backoff, so TanStack Query does not stack its own retries on top. Queries refetch when the app returns to the
// foreground or the device comes back online.

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => failureCount < 1 && !isAuthFailure(error) && !(isApiError(error) && error.status >= 400 && error.status < 500),
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

/** Wires TanStack Query to React Native: NetInfo for online state, AppState for "window focus". */
export function bindQueryLifecycle(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
  const onAppState = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
  const subscription = AppState.addEventListener('change', onAppState);
  return () => subscription.remove();
}
