import type { Query } from '@tanstack/react-query';
import type { PersistedClient, Persister, PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';

import { secureStorage } from './storage';

// Offline cache (docs/spec/04-integration.md §12.1): history, receipts, tickets and reference data stay readable
// without a connection for up to 24 hours. Stored in the encrypted store, which sign-out wipes.
// Live state (the ride in progress, quotes, the current position) is never restored from disk.

const KEY = 'query-cache.v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WRITE_THROTTLE_MS = 1000;

/** First segment of the query keys that may be persisted (see features/account/queries.ts). */
const PERSISTED = new Set(['me', 'config', 'wallet', 'receipt', 'tickets', 'ticket', 'categories']);

export function shouldPersist(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  if (query.state.status !== 'success') return false;
  const [root, second] = query.queryKey as unknown[];
  // History yes; "is there an active ride?" no — a stale answer would reopen a finished ride.
  if (root === 'rides') return second === 'history';
  return typeof root === 'string' && PERSISTED.has(root);
}

export function securePersister(): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PersistedClient | null = null;
  return {
    persistClient: (client) => {
      pending = client;
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        const toWrite = pending;
        pending = null;
        if (toWrite) (await secureStorage()).set(KEY, JSON.stringify(toWrite));
      }, WRITE_THROTTLE_MS);
    },
    restoreClient: async () => {
      const raw = (await secureStorage()).getString(KEY);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as PersistedClient;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      (await secureStorage()).remove(KEY);
    },
  };
}

export function persistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: securePersister(),
    maxAge: MAX_AGE_MS,
    // A new app version may change response shapes: start with an empty cache.
    buster: Constants.expoConfig?.version ?? 'dev',
    dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
  };
}
