import { z } from 'zod';

import type { ApiClient } from '../client';
import { rideSchema, type Ride } from './rides';

// Endpoints rider-admin added for the passenger app (gaps B4–B7, B9, B10, B13). Shapes follow rider-admin as built:
// api.list_saved_places, api.list_trusted_contacts, api.get_notification_preferences, api.current_ride,
// api.create_trip_share, /places/search and /places/reverse.

// ---- Current ride (B9) ------------------------------------------------------------------------------------------

export async function getCurrentRide(api: ApiClient): Promise<Ride | null> {
  return (await api.request({ path: '/rides/current', schema: rideSchema.nullable() })).data;
}

// ---- Consent (B13) ----------------------------------------------------------------------------------------------

export async function recordConsent(api: ApiClient, termsVersion: string, idempotencyKey: string) {
  await api.request({
    method: 'POST',
    path: '/me/consent',
    body: { terms_version: termsVersion },
    idempotencyKey,
    schema: z.object({ terms_version: z.string() }),
  });
}

// ---- Notification preferences (B4) ------------------------------------------------------------------------------

export const notificationPrefsSchema = z.object({ ride: z.boolean(), support: z.boolean(), offers: z.boolean(), safety: z.boolean().optional() });
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export async function getNotificationPrefs(api: ApiClient): Promise<NotificationPrefs> {
  return (await api.request({ path: '/me/notification-preferences', schema: notificationPrefsSchema })).data;
}

export async function setNotificationPrefs(api: ApiClient, prefs: Omit<NotificationPrefs, 'safety'>): Promise<NotificationPrefs> {
  return (
    await api.request({
      method: 'PUT',
      path: '/me/notification-preferences',
      body: { ride: prefs.ride, support: prefs.support, offers: prefs.offers },
      schema: notificationPrefsSchema,
      // PUT replaces the whole value, so repeating it is harmless.
      retrySafe: true,
    })
  ).data;
}

// ---- Saved places (B6) ------------------------------------------------------------------------------------------

export const serverPlaceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['home', 'office', 'other']),
  name: z.string().nullable(),
  label: z.string(),
  subtitle: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  driver_note: z.string().nullable(),
  suggest_mornings: z.boolean(),
});
export type ServerPlace = z.infer<typeof serverPlaceSchema>;

export async function listPlaces(api: ApiClient): Promise<ServerPlace[]> {
  return (await api.request({ path: '/me/places', schema: z.array(serverPlaceSchema) })).data;
}

export async function savePlace(
  api: ApiClient,
  place: { kind: 'home' | 'office' | 'other'; name?: string; label: string; subtitle?: string; lat: number; lng: number; driverNote?: string; suggestMornings?: boolean },
  idempotencyKey: string,
): Promise<ServerPlace> {
  return (
    await api.request({
      method: 'POST',
      path: '/me/places',
      body: {
        kind: place.kind,
        ...(place.kind === 'other' && place.name ? { name: place.name.slice(0, 40) } : {}),
        label: place.label.slice(0, 200),
        ...(place.subtitle ? { subtitle: place.subtitle.slice(0, 200) } : {}),
        lat: place.lat,
        lng: place.lng,
        ...(place.driverNote ? { driver_note: place.driverNote.slice(0, 300) } : {}),
        suggest_mornings: place.suggestMornings ?? false,
      },
      idempotencyKey,
      schema: serverPlaceSchema,
    })
  ).data;
}

export async function removePlace(api: ApiClient, id: string): Promise<void> {
  await api.request({ method: 'DELETE', path: `/me/places/${id}`, schema: z.object({ removed: z.boolean() }), retrySafe: true });
}

// ---- Trusted contacts (B7) --------------------------------------------------------------------------------------

export const contactSchema = z.object({ id: z.uuid(), name: z.string(), phone: z.string() });
export type Contact = z.infer<typeof contactSchema>;

export async function listContacts(api: ApiClient): Promise<Contact[]> {
  return (await api.request({ path: '/me/contacts', schema: z.array(contactSchema) })).data;
}

export async function addContact(api: ApiClient, name: string, phone: string, idempotencyKey: string): Promise<Contact> {
  return (await api.request({ method: 'POST', path: '/me/contacts', body: { name: name.trim(), phone }, idempotencyKey, schema: contactSchema })).data;
}

export async function removeContact(api: ApiClient, id: string): Promise<void> {
  await api.request({ method: 'DELETE', path: `/me/contacts/${id}`, schema: z.object({ removed: z.boolean() }), retrySafe: true });
}

// ---- Trip sharing (B5) ------------------------------------------------------------------------------------------

export async function createTripShare(api: ApiClient, tripId: string, idempotencyKey: string): Promise<string> {
  return (
    await api.request({ method: 'POST', path: `/trips/${tripId}/share`, body: {}, idempotencyKey, schema: z.object({ url: z.url(), trip_id: z.uuid() }) })
  ).data.url;
}

// ---- Places (B10) -----------------------------------------------------------------------------------------------

const placesAnswerSchema = z.object({
  source: z.enum(['google', 'none']).or(z.string()),
  results: z.array(z.object({ title: z.string(), subtitle: z.string().nullable(), lat: z.number(), lng: z.number() })),
});
export type PlacesAnswer = z.infer<typeof placesAnswerSchema>;

export async function searchPlacesRemote(
  api: ApiClient,
  query: string,
  near: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<PlacesAnswer> {
  return (
    await api.request({
      path: '/places/search',
      query: { q: query.trim().slice(0, 100), lat: near?.lat, lng: near?.lng },
      schema: placesAnswerSchema,
      signal,
      maxAttempts: 1,
      timeoutMs: 5_000,
    })
  ).data;
}

export async function reversePlaceRemote(api: ApiClient, at: { lat: number; lng: number }): Promise<PlacesAnswer> {
  return (await api.request({ path: '/places/reverse', query: { lat: at.lat, lng: at.lng }, schema: placesAnswerSchema, maxAttempts: 1, timeoutMs: 5_000 })).data;
}
