import { z } from 'zod';

import type { ApiClient } from '../client';

// Account changes, safety and support (docs/spec/04-integration.md §8.2). Shapes follow rider-admin as built:
// api.onboard_passenger, api.update_own_profile, api.request_account_deletion, api.trigger_sos,
// api.list_my_tickets, api.get_my_ticket, api.reply_my_ticket.

export async function onboardPassenger(api: ApiClient, fullName: string, idempotencyKey: string) {
  return (
    await api.request({
      method: 'POST',
      path: '/onboarding/passenger',
      body: { full_name: fullName.trim() },
      idempotencyKey,
      schema: z.object({ id: z.uuid(), role: z.string() }),
    })
  ).data;
}

export async function updateMe(
  api: ApiClient,
  input: { fullName: string; language: 'en' | 'bn'; expectedVersion: number },
  idempotencyKey: string,
) {
  return (
    await api.request({
      method: 'PATCH',
      path: '/me',
      body: { full_name: input.fullName.trim(), preferred_language: input.language, expected_version: input.expectedVersion },
      idempotencyKey,
      schema: z.object({ id: z.uuid(), version: z.number() }),
    })
  ).data;
}

export async function requestAccountDeletion(api: ApiClient, reason: string | undefined, idempotencyKey: string) {
  return (
    await api.request({
      method: 'POST',
      path: '/me/deactivate',
      body: { confirm: true, ...(reason?.trim() ? { reason: reason.trim().slice(0, 500) } : {}) },
      idempotencyKey,
      schema: z.object({ status: z.string(), anonymise_after: z.string().nullable().optional() }),
    })
  ).data;
}

export const sosSchema = z.object({ id: z.uuid(), incident_no: z.coerce.number(), status: z.string(), repeat: z.boolean() });
export type SosResult = z.infer<typeof sosSchema>;

/**
 * SOS is never rate-limited and needs no idempotency key: the server returns the same open incident on repeats.
 * It retries hard (6 attempts) because a panic button must get through.
 */
export async function triggerSos(api: ApiClient, tripId: string, note?: string): Promise<SosResult> {
  return (
    await api.request({
      method: 'POST',
      path: `/trips/${tripId}/sos`,
      body: note?.trim() ? { note: note.trim().slice(0, 2000) } : {},
      schema: sosSchema,
      // Safe to repeat: the backend returns the same open incident instead of creating another.
      retrySafe: true,
      maxAttempts: 6,
      timeoutMs: 8_000,
    })
  ).data;
}

export const TICKET_CATEGORIES = ['payment', 'trip', 'driver', 'safety', 'account', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_STATUSES = ['open', 'in_progress', 'pending_user', 'resolved', 'closed'] as const;

export const ticketSummarySchema = z.object({
  id: z.uuid(),
  ticket_no: z.coerce.number(),
  subject: z.string(),
  category: z.string(),
  status: z.string(),
  trip_id: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

export const ticketSchema = ticketSummarySchema.extend({
  messages: z.array(z.object({ id: z.coerce.number(), author_type: z.string(), body: z.string(), created_at: z.string() })),
});
export type Ticket = z.infer<typeof ticketSchema>;

export async function listTickets(api: ApiClient): Promise<TicketSummary[]> {
  return (await api.request({ path: '/support/tickets', schema: z.array(ticketSummarySchema) })).data;
}

export async function getTicket(api: ApiClient, id: string): Promise<Ticket> {
  return (await api.request({ path: `/support/tickets/${id}`, schema: ticketSchema })).data;
}

export async function createTicket(
  api: ApiClient,
  input: { category: TicketCategory; subject: string; body: string; tripId?: string },
  idempotencyKey: string,
): Promise<Ticket> {
  return (
    await api.request({
      method: 'POST',
      path: '/support/tickets',
      // The backend names this one field in camelCase (gap B15).
      body: { category: input.category, subject: input.subject.trim(), body: input.body.trim(), ...(input.tripId ? { tripId: input.tripId } : {}) },
      idempotencyKey,
      schema: ticketSchema,
    })
  ).data;
}

export async function replyTicket(api: ApiClient, id: string, body: string, idempotencyKey: string): Promise<Ticket> {
  return (
    await api.request({ method: 'POST', path: `/support/tickets/${id}/messages`, body: { body: body.trim() }, idempotencyKey, schema: ticketSchema })
  ).data;
}

export async function registerDevice(api: ApiClient, platform: 'android' | 'ios', token: string) {
  await api.request({ method: 'PUT', path: '/me/devices', body: { platform, token }, schema: z.object({ registered: z.boolean() }) });
}

export async function unregisterDevice(api: ApiClient, token: string) {
  await api.request({ method: 'DELETE', path: '/me/devices', body: { token }, schema: z.object({ registered: z.boolean() }) });
}

// ---- SOS evidence (docs/spec/03-screens.md §7.14) ----------------------------------------------------------------

export const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export const EVIDENCE_MAX_BYTES = 15 * 1024 * 1024;
export const EVIDENCE_BUCKET = 'safety-evidence';

export const evidenceSlotSchema = z.object({ upload_url: z.string(), token: z.string(), path: z.string(), content_type: z.string() });
export type EvidenceSlot = z.infer<typeof evidenceSlotSchema>;

/** Reserves a server-chosen path and returns a short-lived signed upload URL for it. */
export async function startEvidenceUpload(api: ApiClient, incidentId: string, contentType: EvidenceType, idempotencyKey: string) {
  return (
    await api.request({
      method: 'POST',
      path: `/incidents/${incidentId}/evidence/upload-url`,
      body: { content_type: contentType },
      idempotencyKey,
      schema: evidenceSlotSchema,
    })
  ).data;
}

/** The server re-reads the file, checks its real type and records its checksum on the incident. */
export async function completeEvidenceUpload(
  api: ApiClient,
  incidentId: string,
  input: { path: string; contentType: EvidenceType; description?: string },
  idempotencyKey: string,
) {
  return (
    await api.request({
      method: 'POST',
      path: `/incidents/${incidentId}/evidence/complete`,
      body: {
        path: input.path,
        content_type: input.contentType,
        ...(input.description?.trim() ? { description: input.description.trim().slice(0, 500) } : {}),
      },
      idempotencyKey,
      schema: z.unknown(),
    })
  ).data;
}
