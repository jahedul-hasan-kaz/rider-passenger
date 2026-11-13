import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { env } from './env';
import { authStorage } from './storage';

// Supabase is used for Auth and Realtime only (docs/spec/01-overview-foundation.md §3). The app never reads or writes
// tables directly: every piece of data goes through the rider-admin `/api/v1` REST API.

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  client ??= createClient(env().EXPO_PUBLIC_SUPABASE_URL, env().EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // PKCE so the Google sign-in code can be exchanged safely after the browser hands it back.
      flowType: 'pkce',
    },
  });
  return client;
}

/**
 * Access tokens last 15 minutes (rider-admin `jwt_expiry = 900`). Refresh only while the app is in the foreground;
 * on return, Supabase refreshes immediately if the token expired in the background.
 */
export function bindAuthRefreshToAppState(): () => void {
  const apply = (state: AppStateStatus | string | null | undefined) => {
    if (state === 'active') void supabase().auth.startAutoRefresh();
    else void supabase().auth.stopAutoRefresh();
  };
  apply(AppState.currentState);
  const subscription = AppState.addEventListener('change', apply);
  return () => subscription.remove();
}

export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase().auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
