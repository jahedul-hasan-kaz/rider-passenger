import { z } from 'zod';

import type { ApiClient } from '../client';
import { money } from '../schemas';

// Booking and ride endpoints (docs/spec/04-integration.md §8.2). Shapes follow rider-admin as built:
// api.list_active_categories, api.check_zone, api.create_quote, api.get_ride, api.cancel_preview, api.get_ride_pin,
// api.get_receipt, api.passenger_wallet, api.list_my_rides, api.apply_promo, api.rate_trip.

export type Place = { lat: number; lng: number; label?: string };

const point = z.object({ lat: z.number(), lng: z.number(), label: z.string().nullable().optional() });

// ---- Reference --------------------------------------------------------------------------------------------------

export const categorySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  name_bn: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  passenger_capacity: z.number().int(),
  icon: z.string().nullable().optional(),
  // Live data when a point is sent (gap B11): eligible drivers nearby and the nearest one's ETA.
  available_drivers: z.number().int().nullable().optional(),
  pickup_eta_s: z.number().int().nullable().optional(),
});
export type Category = z.infer<typeof categorySchema>;

export async function listCategories(api: ApiClient, at: Place): Promise<Category[]> {
  return (await api.request({ path: '/categories', query: { lat: at.lat, lng: at.lng }, schema: z.array(categorySchema) })).data;
}

export const zoneCheckSchema = z.object({
  in_service_area: z.boolean(),
  zone: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type ZoneCheck = z.infer<typeof zoneCheckSchema>;

export async function checkZone(api: ApiClient, at: Pick<Place, 'lat' | 'lng'>): Promise<ZoneCheck> {
  return (await api.request({ path: '/zones/check', query: { lat: at.lat, lng: at.lng }, schema: zoneCheckSchema })).data;
}

// ---- Quote ------------------------------------------------------------------------------------------------------

export const breakdownSchema = z.object({
  base_amount: money,
  distance_amount: money,
  time_amount: money,
  surge_amount: money,
  waiting_amount: money.optional(),
  minimum_adjustment: money.optional(),
  rounding_amount: money.optional(),
  booking_fee: money,
  discount_amount: money.optional(),
  total_amount: money,
  surge_multiplier: z.coerce.number().optional(),
});
export type Breakdown = z.infer<typeof breakdownSchema>;

export const quoteSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid(),
  zone: z.object({ id: z.uuid(), name: z.string() }).nullable().optional(),
  estimated_fare: money,
  currency: z.literal('BDT'),
  breakdown: breakdownSchema,
  surge_multiplier: z.coerce.number(),
  distance_m: z.coerce.number(),
  duration_s: z.coerce.number(),
  expires_at: z.string(),
  available_drivers: z.coerce.number().int().nullable().optional(),
  pickup_eta_s: z.coerce.number().int().nullable().optional(),
  route_source: z.string().optional(),
  /** Google encoded polyline of the road route, for drawing only (gap B10). */
  route_polyline: z.string().nullable().optional(),
});
export type Quote = z.infer<typeof quoteSchema>;

export async function createQuote(
  api: ApiClient,
  input: { categoryId: string; pickup: Place; destination: Place },
  idempotencyKey: string,
): Promise<Quote> {
  const body = {
    category_id: input.categoryId,
    pickup: { lat: input.pickup.lat, lng: input.pickup.lng, ...(input.pickup.label ? { label: input.pickup.label.slice(0, 200) } : {}) },
    destination: {
      lat: input.destination.lat,
      lng: input.destination.lng,
      ...(input.destination.label ? { label: input.destination.label.slice(0, 200) } : {}),
    },
  };
  return (await api.request({ method: 'POST', path: '/quotes', body, idempotencyKey, schema: quoteSchema })).data;
}

// ---- Ride -------------------------------------------------------------------------------------------------------

export const REQUEST_STATUSES = [
  'requested',
  'searching',
  'matched',
  'no_driver_found',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'failed',
  'completed',
] as const;
export const TRIP_STATUSES = [
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
  'cancelled_by_passenger',
  'cancelled_by_driver',
  'cancelled_by_admin',
  'failed',
] as const;

// Unknown statuses from a newer backend are kept as strings so the app can show a neutral "Updating…" state.
const requestStatus = z.union([z.enum(REQUEST_STATUSES), z.string()]);
const tripStatus = z.union([z.enum(TRIP_STATUSES), z.string()]);

export const tripSchema = z.object({
  id: z.uuid(),
  status: tripStatus,
  accepted_at: z.string().nullable(),
  arrived_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  final_fare: money.nullable(),
  cancellation_fee: money.nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  pickup_eta_s: z.number().nullable().optional(),
  driver: z.object({
    name: z.string().nullable(),
    phone_masked: z.string().nullable().optional(),
    rating_avg: z.coerce.number().nullable().optional(),
    rating_count: z.number().nullable().optional(),
    vehicle: z.object({
      registration_number: z.string(),
      make: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
    location: z
      .object({ lat: z.number(), lng: z.number(), heading: z.coerce.number().nullable().optional(), updated_at: z.string() })
      .nullable()
      .optional(),
  }),
});
export type Trip = z.infer<typeof tripSchema>;

export const rideSchema = z.object({
  id: z.uuid(),
  status: requestStatus,
  category_id: z.uuid(),
  pickup: point,
  destination: point,
  estimated_fare: money,
  currency: z.literal('BDT'),
  payment_method: z.string(),
  requested_at: z.string(),
  expires_at: z.string().nullable().optional(),
  cancel_reason: z.string().nullable().optional(),
  trip: tripSchema.nullable(),
});
export type Ride = z.infer<typeof rideSchema>;

export async function requestRide(
  api: ApiClient,
  input: { quoteId: string; paymentMethod: string; pickupNote?: string; promoCode?: string },
  idempotencyKey: string,
): Promise<Ride & { promo?: PromoOutcome }> {
  const body = {
    quote_id: input.quoteId,
    payment_method: input.paymentMethod,
    ...(input.pickupNote?.trim() ? { pickup_note: input.pickupNote.trim().slice(0, 300) } : {}),
    ...(input.promoCode?.trim() ? { promo_code: input.promoCode.trim().toUpperCase().slice(0, 20) } : {}),
  };
  return (await api.request({ method: 'POST', path: '/rides', body, idempotencyKey, schema: rideWithPromoSchema })).data;
}

/** The result of a promotion code sent with the request (gap B12). A bad code never blocks the ride. */
export const promoOutcomeSchema = z.object({
  applied: z.boolean(),
  error: z.string().optional(),
  estimated_discount: money.optional(),
});
export type PromoOutcome = z.infer<typeof promoOutcomeSchema>;

export async function getRide(api: ApiClient, id: string, signal?: AbortSignal): Promise<Ride> {
  return (await api.request({ path: `/rides/${id}`, schema: rideSchema, signal })).data;
}

export const cancelPreviewSchema = z.object({ can_cancel: z.boolean(), fee: money, currency: z.literal('BDT') });
export type CancelPreview = z.infer<typeof cancelPreviewSchema>;

export async function getCancelPreview(api: ApiClient, id: string): Promise<CancelPreview> {
  return (await api.request({ path: `/rides/${id}/cancel-preview`, schema: cancelPreviewSchema })).data;
}

export async function cancelRide(api: ApiClient, id: string, reason: string | undefined, idempotencyKey: string): Promise<Ride> {
  return (
    await api.request({
      method: 'POST',
      path: `/rides/${id}/cancel`,
      body: reason ? { reason: reason.slice(0, 300) } : {},
      idempotencyKey,
      schema: rideSchema,
    })
  ).data;
}

export const pinSchema = z.object({ required: z.boolean(), pin: z.string().nullable(), locked: z.boolean() });
export type RidePin = z.infer<typeof pinSchema>;

export async function getRidePin(api: ApiClient, id: string): Promise<RidePin> {
  return (await api.request({ path: `/rides/${id}/pin`, schema: pinSchema })).data;
}

export async function renewRidePin(api: ApiClient, id: string, idempotencyKey: string): Promise<RidePin> {
  return (await api.request({ method: 'POST', path: `/rides/${id}/pin/renew`, body: {}, idempotencyKey, schema: pinSchema })).data;
}

export const promoResultSchema = z.object({
  code: z.string(),
  name: z.string().nullable().optional(),
  estimated_discount: money,
  estimated_fare: money,
});
export type PromoResult = z.infer<typeof promoResultSchema>;

export async function applyPromo(api: ApiClient, rideId: string, code: string, idempotencyKey: string): Promise<PromoResult> {
  return (
    await api.request({ method: 'POST', path: `/rides/${rideId}/promo`, body: { code: code.trim() }, idempotencyKey, schema: promoResultSchema })
  ).data;
}

// ---- After the ride ---------------------------------------------------------------------------------------------

export const historyRowSchema = z.object({
  id: z.uuid(),
  status: requestStatus,
  requested_at: z.string(),
  pickup_label: z.string().nullable(),
  destination_label: z.string().nullable(),
  estimated_fare: money,
  final_fare: money.nullable(),
  trip_status: tripStatus.nullable(),
});
export type HistoryRow = z.infer<typeof historyRowSchema>;

export async function listRides(api: ApiClient, cursor?: string | null, limit = 20) {
  const res = await api.request({ path: '/rides', query: { limit, cursor: cursor ?? undefined }, schema: z.array(historyRowSchema) });
  return { rows: res.data, nextCursor: res.meta.next_cursor ?? null };
}

export const receiptSchema = z.object({
  trip_id: z.uuid(),
  status: z.string(),
  completed_at: z.string().nullable(),
  currency: z.literal('BDT'),
  estimated_fare: money,
  final_fare: money.nullable(),
  payment_method: z.string(),
  distance_m: z.number().nullable(),
  duration_s: z.number().nullable(),
  pickup_label: z.string().nullable(),
  destination_label: z.string().nullable(),
  breakdown: z
    .object({
      base: money,
      distance: money,
      time: money,
      surge: money,
      waiting: money,
      minimum_adjustment: money,
      rounding: money,
      booking_fee: money,
      discount: money,
      total: money,
    })
    .partial()
    .nullable(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export async function getReceipt(api: ApiClient, tripId: string): Promise<Receipt> {
  return (await api.request({ path: `/trips/${tripId}/receipt`, schema: receiptSchema })).data;
}

export async function rateTrip(api: ApiClient, tripId: string, score: number, comment: string | undefined, idempotencyKey: string) {
  return (
    await api.request({
      method: 'POST',
      path: `/trips/${tripId}/rate`,
      body: { score, ...(comment?.trim() ? { comment: comment.trim().slice(0, 1000) } : {}) },
      idempotencyKey,
      schema: z.object({ id: z.uuid(), trip_id: z.uuid(), score: z.number() }),
    })
  ).data;
}

export const walletSchema = z.object({
  balance: money,
  currency: z.literal('BDT'),
  outstanding_fee: money,
  credit: money,
});
export type Wallet = z.infer<typeof walletSchema>;

export async function getWallet(api: ApiClient): Promise<Wallet> {
  return (await api.request({ path: '/wallet', schema: walletSchema })).data;
}

// ---- Status helpers ---------------------------------------------------------------------------------------------

const ACTIVE_TRIP = new Set(['driver_assigned', 'driver_arriving', 'arrived', 'in_progress']);

/** The ride still needs the passenger's attention: searching, or a trip that has not ended. */
export function isRideActive(ride: Pick<Ride, 'status' | 'trip'> | Pick<HistoryRow, 'status' | 'trip_status'>): boolean {
  if (ride.status === 'requested' || ride.status === 'searching') return true;
  const tripStatus = 'trip' in ride ? ride.trip?.status : ride.trip_status;
  return ride.status === 'matched' && tripStatus !== undefined && tripStatus !== null && ACTIVE_TRIP.has(tripStatus);
}

/** The single status the ride screen renders from: the trip's when there is one, otherwise the request's. */
export function rideStage(ride: Ride): string {
  return ride.trip?.status ?? ride.status;
}

export const rideWithPromoSchema = rideSchema.extend({ promo: promoOutcomeSchema.optional() });
