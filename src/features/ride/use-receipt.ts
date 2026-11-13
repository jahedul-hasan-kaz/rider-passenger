import { useQuery } from '@tanstack/react-query';

import { api } from '@/api';
import { getReceipt, getRide } from '@/api/endpoints/rides';
import { keys } from '@/features/account/queries';

/** Ride + its receipt, addressed by ride (request) id — history rows only carry the request id. */
export function useRideReceipt(rideId: string) {
  const ride = useQuery({ queryKey: keys.ride(rideId), queryFn: () => getRide(api(), rideId), staleTime: 30_000 });
  const tripId = ride.data?.trip?.status === 'completed' ? ride.data.trip.id : null;
  const receipt = useQuery({
    queryKey: tripId ? keys.receipt(tripId) : ['receipt', 'none'],
    queryFn: () => getReceipt(api(), tripId!),
    enabled: !!tripId,
    staleTime: Infinity,
  });
  return { ride, receipt, tripId };
}
