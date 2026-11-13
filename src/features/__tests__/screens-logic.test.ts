import '@/i18n';

import { isRideActive, rideSchema, rideStage, type Ride } from '@/api/endpoints/rides';
import { quoteLines, receiptLines } from '@/features/booking/fare-lines';
import { distanceM, roughTrip } from '@/features/location/location';
import { highlight, localMatches } from '@/features/places/search';
import en from '@/i18n/en.json';
import bn from '@/i18n/bn.json';

const baseRide = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'matched',
  category_id: '22222222-2222-4222-8222-222222222222',
  pickup: { lat: 23.79, lng: 90.41, label: 'Road 11, Banani' },
  destination: { lat: 23.75, lng: 90.37, label: 'Dhanmondi 27' },
  estimated_fare: 190,
  currency: 'BDT',
  payment_method: 'cash',
  requested_at: '2026-11-12T08:00:00Z',
  expires_at: null,
  cancel_reason: null,
  trip: {
    id: '33333333-3333-4333-8333-333333333333',
    status: 'driver_arriving',
    accepted_at: '2026-11-12T08:01:00Z',
    arrived_at: null,
    started_at: null,
    completed_at: null,
    final_fare: null,
    cancellation_fee: 0,
    cancellation_reason: null,
    pickup_eta_s: 240,
    driver: {
      name: 'Karim',
      phone_masked: '+88017•••••45',
      rating_avg: 4.82,
      rating_count: 120,
      vehicle: { registration_number: 'DHAKA METRO-HA 12-3456', make: 'Honda', model: 'CB Hornet', color: 'Red' },
      location: { lat: 23.78, lng: 90.4, heading: 90, updated_at: '2026-11-12T08:02:00Z' },
    },
  },
};

describe('ride contract and stage', () => {
  it('parses the as-built get_ride shape, normalising money', () => {
    const ride = rideSchema.parse(baseRide);
    expect(ride.estimated_fare).toBe('190.00');
    expect(ride.trip?.cancellation_fee).toBe('0.00');
    expect(rideStage(ride)).toBe('driver_arriving');
  });

  it('keeps an unknown status from a newer backend instead of failing', () => {
    const ride = rideSchema.parse({ ...baseRide, trip: { ...baseRide.trip, status: 'driver_waving' } });
    expect(rideStage(ride)).toBe('driver_waving');
  });

  it.each([
    ['searching', null, true],
    ['matched', 'arrived', true],
    ['matched', 'in_progress', true],
    ['matched', 'completed', false],
    ['no_driver_found', null, false],
    ['cancelled_by_passenger', null, false],
  ])('%s / trip %s → active %s', (status, tripStatus, active) => {
    expect(isRideActive({ status, trip_status: tripStatus })).toBe(active);
  });

  it('uses the request status before a trip exists', () => {
    expect(rideStage({ ...rideSchema.parse(baseRide), status: 'searching', trip: null } as Ride)).toBe('searching');
  });
});

describe('fare lines', () => {
  it('shows only components that apply and ends with the server total', () => {
    const lines = quoteLines({
      base_amount: '40.00',
      distance_amount: '124.00',
      time_amount: '22.00',
      surge_amount: '0.00',
      booking_fee: '14.00',
      discount_amount: '0.00',
      total_amount: '200.00',
    });
    expect(lines.map((l) => l.amount)).toEqual(['40.00', '124.00', '22.00', '14.00', '200.00']);
    expect(lines.at(-1)?.kind).toBe('total');
  });

  it('receipt total prefers the final fare', () => {
    const lines = receiptLines({
      trip_id: baseRide.trip.id,
      status: 'completed',
      completed_at: null,
      currency: 'BDT',
      estimated_fare: '190.00',
      final_fare: '205.00',
      payment_method: 'cash',
      distance_m: 6200,
      duration_s: 1320,
      pickup_label: null,
      destination_label: null,
      breakdown: { base: '40.00', waiting: '15.00', discount: '10.00', total: '205.00' },
    });
    expect(lines.find((l) => l.kind === 'discount')?.amount).toBe('10.00');
    expect(lines.at(-1)).toMatchObject({ amount: '205.00', kind: 'total' });
  });
});

describe('places', () => {
  const saved = [{ id: '1', kind: 'office' as const, lat: 23.79, lng: 90.41, label: 'House 42, Road 11, Banani' }];
  const recent = [{ lat: 23.75, lng: 90.37, label: 'Dhanmondi 27, Road 16', usedAt: 1 }];

  it('matches saved and recent places offline', () => {
    expect(localMatches('dhanm', saved, recent).map((r) => r.title)).toEqual(['Dhanmondi 27, Road 16']);
    expect(localMatches('office', saved, recent)[0]?.source).toBe('saved');
    expect(localMatches('d', saved, recent)).toEqual([]);
  });

  it('splits a title around the typed text for bolding', () => {
    expect(highlight('Dhanmondi 27', 'dhanm')).toEqual(['', 'Dhanm', 'ondi 27']);
    expect(highlight('Gulshan', 'xyz')).toEqual(['Gulshan', '', '']);
  });

  it('estimates distance roughly (search rows only)', () => {
    const d = distanceM({ lat: 23.7808, lng: 90.4074 }, { lat: 23.7465, lng: 90.3760 });
    expect(d).toBeGreaterThan(4_500);
    expect(d).toBeLessThan(5_200);
    expect(roughTrip({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }).meters).toBe(0);
  });
});

// Keys built at runtime (`t(\`ride.reasons.${r}\`)`) are invisible to the static check in scripts/check-i18n.mjs.
describe('dynamic translation keys exist in both languages', () => {
  const lookup = (table: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], table);
  const dynamic = [
    ...['rateLimited', 'smsDown', 'signupClosed', 'wrongCode', 'codeExpired', 'wrongPassword', 'invalidEmail', 'cancelled', 'network', 'unknown'].map((k) => `auth.errors.${k}`),
    ...['role', 'suspended', 'deactivated'].flatMap((k) => [`blocked.${k}.title`, `blocked.${k}.body`]),
    ...['blocked', 'services', 'precise'].flatMap((k) => [`location.${k}.title`, `location.${k}.body`]),
    ...['cash', 'bkash', 'nagad', 'card'].map((k) => `confirm.methods.${k}`),
    ...['home', 'office', 'other'].map((k) => `places.${k}`),
    ...['changedPlans', 'driverFar', 'wrongPickup', 'other'].map((k) => `ride.reasons.${k}`),
    ...['ride', 'support', 'offers'].flatMap((k) => [`settings.notify.${k}`, `settings.notify.${k}Body`]),
    ...['payment', 'trip', 'driver', 'safety', 'account', 'other'].map((k) => `support.categories.${k}`),
    ...['fare', 'cancel', 'lost', 'cash', 'account'].flatMap((k) => [`support.faq.${k}.q`, `support.faq.${k}.a`]),
    ...['open', 'in_progress', 'pending_user', 'resolved', 'closed'].map((k) => `support.status.${k}`),
    ...[0, 1, 2].flatMap((k) => [`welcome.pages.${k}.title`, `welcome.pages.${k}.body`]),
    'location.steps.2ios',
    'location.steps.2android',
    'location.steps.3precise',
    ...['added', 'denied', 'tooLarge', 'failed'].map((k) => `sos.photo.${k}`),
  ];
  it.each(dynamic)('%s', (key) => {
    expect(typeof lookup(en, key)).toBe('string');
    expect(typeof lookup(bn, key)).toBe('string');
  });
});
