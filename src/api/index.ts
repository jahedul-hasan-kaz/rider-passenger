import { randomUUID } from 'expo-crypto';

import { currentLanguage } from '@/i18n';
import { env } from '@/lib/env';
import { reportContractFailure } from '@/lib/monitoring';
import { currentAccessToken, refreshAccessToken, supabase } from '@/lib/supabase';

import { createApiClient, type ApiClient } from './client';
import { createIntents, type Intents } from './idempotency';

// The app-wide API client and intent keys, wired to the real session, language and monitoring.

let client: ApiClient | undefined;
let intentKeys: Intents | undefined;

export function api(): ApiClient {
  client ??= createApiClient({
    baseUrl: env().EXPO_PUBLIC_API_BASE_URL,
    getAccessToken: currentAccessToken,
    refreshSession: refreshAccessToken,
    onSessionLost: () => void supabase().auth.signOut({ scope: 'local' }),
    getLanguage: currentLanguage,
    onContractError: reportContractFailure,
    newId: randomUUID,
  });
  return client;
}

export function intents(): Intents {
  intentKeys ??= createIntents(randomUUID);
  return intentKeys;
}

export { ApiError, isApiError, isApiErrorCode } from './errors';
