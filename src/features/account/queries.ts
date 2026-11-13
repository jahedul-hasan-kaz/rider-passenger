import { useQuery, type QueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { getClientConfig, getMe, type ClientConfig, type Me } from '@/api/endpoints/account';
import { getCurrentRide } from '@/api/endpoints/me';
import { getWallet } from '@/api/endpoints/rides';
import { useSession } from '@/features/auth/session-store';

// Server state shared by many screens. Query keys live here so invalidation stays consistent.

export const keys = {
  me: ['me'] as const,
  config: ['config'] as const,
  wallet: ['wallet'] as const,
  activeRide: ['rides', 'active'] as const,
  history: ['rides', 'history'] as const,
  ride: (id: string) => ['ride', id] as const,
  receipt: (tripId: string) => ['receipt', tripId] as const,
  categories: (lat: number, lng: number) => ['categories', lat.toFixed(3), lng.toFixed(3)] as const,
  zone: (lat: number, lng: number) => ['zone', lat.toFixed(3), lng.toFixed(3)] as const,
  tickets: ['tickets'] as const,
  ticket: (id: string) => ['ticket', id] as const,
};

export function useMe() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery<Me>({ queryKey: keys.me, queryFn: () => getMe(api()), enabled: signedIn, staleTime: 60_000 });
}

export function useClientConfig() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery<ClientConfig>({ queryKey: keys.config, queryFn: () => getClientConfig(api()), enabled: signedIn, staleTime: 5 * 60_000 });
}

export function useWallet(enabled = true) {
  return useQuery({ queryKey: keys.wallet, queryFn: () => getWallet(api()), enabled, staleTime: 60_000 });
}

/** The ride that still needs the passenger, if any (docs/spec/04-integration.md §9.3): `GET /rides/current`. */
export function useActiveRide(enabled = true) {
  return useQuery({ queryKey: keys.activeRide, enabled, staleTime: 10_000, queryFn: () => getCurrentRide(api()) });
}

export function setting<K extends keyof NonNullable<ClientConfig['settings']>>(
  config: ClientConfig | undefined,
  key: K,
  fallback: NonNullable<NonNullable<ClientConfig['settings']>[K]>,
): NonNullable<NonNullable<ClientConfig['settings']>[K]> {
  return (config?.settings?.[key] ?? fallback) as NonNullable<NonNullable<ClientConfig['settings']>[K]>;
}

export function refreshAfterRideChange(client: QueryClient, rideId?: string) {
  void client.invalidateQueries({ queryKey: keys.activeRide });
  void client.invalidateQueries({ queryKey: keys.history });
  void client.invalidateQueries({ queryKey: keys.wallet });
  if (rideId) void client.invalidateQueries({ queryKey: keys.ride(rideId) });
}
