import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api';
import { getRide, rideStage, type Ride } from '@/api/endpoints/rides';
import { keys, refreshAfterRideChange } from '@/features/account/queries';
import { supabase } from '@/lib/supabase';

// Live ride state (docs/spec/04-integration.md §9). `GET /rides/{id}` is the only source of truth; Realtime
// broadcasts are hints that trigger a refetch, and polling covers the gaps when the socket is down.

export type DriverPosition = { lat: number; lng: number; heading: number | null; at: number };

const POLL_MS: Record<string, number> = {
  requested: 4_000,
  searching: 4_000,
  driver_assigned: 8_000,
  driver_arriving: 8_000,
  arrived: 8_000,
  in_progress: 15_000,
};

/** Driver position older than this is shown dimmed with "Updated N s ago". */
export const STALE_AFTER_MS = 15_000;

export function useLiveRide(id: string) {
  const queryClient = useQueryClient();
  const [socketJoined, setSocketJoined] = useState(false);
  const [livePosition, setLivePosition] = useState<DriverPosition | null>(null);
  const previousStage = useRef<string | null>(null);

  const query = useQuery<Ride>({
    queryKey: keys.ride(id),
    queryFn: ({ signal }) => getRide(api(), id, signal),
    staleTime: 0,
    refetchInterval: (q) => {
      const ride = q.state.data;
      if (!ride) return 4_000;
      const interval = POLL_MS[rideStage(ride)];
      if (!interval) return false;
      // With a live socket, polling is only a safety net.
      return socketJoined ? interval * 3 : interval;
    },
    refetchIntervalInBackground: false,
  });

  const refetch = query.refetch;

  // Realtime: private broadcast channel `ride:{id}`.
  useEffect(() => {
    const channel = supabase()
      .channel(`ride:${id}`, { config: { private: true } })
      .on('broadcast', { event: 'status_changed' }, () => void refetch())
      .on('broadcast', { event: 'driver_location' }, ({ payload }) => {
        const p = payload as { lat?: number; lng?: number; heading?: number | null; at?: string };
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
        const at = p.at ? new Date(p.at).getTime() : Date.now();
        // Ignore points older than the one already shown.
        setLivePosition((prev) => (prev && prev.at > at ? prev : { lat: p.lat!, lng: p.lng!, heading: p.heading ?? null, at }));
      })
      .subscribe((status) => {
        setSocketJoined(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void refetch();
      });
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [id, refetch]);

  // Back in the foreground: refresh immediately (the ride may have moved on while away).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void refetch());
    return () => sub.remove();
  }, [refetch]);

  // A stage change updates history, wallet and the active-ride banner elsewhere in the app.
  const stage = query.data ? rideStage(query.data) : null;
  useEffect(() => {
    if (stage && previousStage.current && previousStage.current !== stage) refreshAfterRideChange(queryClient);
    previousStage.current = stage;
  }, [stage, queryClient]);

  // Best known driver position: the live broadcast, or the one in the last ride response.
  const fromRide = query.data?.trip?.driver.location;
  const fromRideAt = fromRide ? new Date(fromRide.updated_at).getTime() : 0;
  const driver: DriverPosition | null =
    livePosition && livePosition.at >= fromRideAt
      ? livePosition
      : fromRide
        ? { lat: fromRide.lat, lng: fromRide.lng, heading: fromRide.heading ?? null, at: fromRideAt }
        : null;

  return { ...query, stage, driver, socketJoined };
}
