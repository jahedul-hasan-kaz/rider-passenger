# Passenger App Spec — 04 · Integration

[01 Overview & foundation](01-overview-foundation.md) · [02 Design system](02-design-system.md) · [03 Screens](03-screens.md) · [04 Integration](04-integration.md) · [05 Quality & delivery](05-quality-delivery.md)

---

## 8. API integration

### 8.1 Conventions (from `rider-admin/docs/spec/05-api.md` and `src/server/http/handler.ts`)

| Topic | App behaviour |
|---|---|
| Auth | `Authorization: Bearer <Supabase access token>` on every call. Token lifetime is 15 min with rotating refresh tokens; the client refreshes before expiry and once on `401 SESSION_EXPIRED`, then signs out if that fails |
| Envelope | Success `{data, meta:{request_id, next_cursor}}`; error `{error:{code, message, details}, meta}`. The client unwraps it and throws a typed `ApiError(code, details, requestId)` |
| Validation | Bodies are strict on the server (unknown keys rejected, 64 KB max). The app validates with the same Zod rules before sending and parses every response with Zod so contract drift is caught in Sentry, not by users |
| Idempotency | `Idempotency-Key` (UUID v4) on every mutating call (`POST /quotes`, `/rides`, `/rides/{id}/cancel`, `/promo`, `/pin/renew`, `/trips/{id}/rate`, `/support/*`, `/onboarding/passenger`, `/me/deactivate`, `PATCH /me`). **One key per user intent**, stored until the call settles, reused on every retry. `Idempotent-Replayed: true` is treated as success. SOS and `/me/devices` take no key |
| Retries | GETs: 3 attempts with jittered backoff. Mutations: retried only with the same idempotency key, on network errors and 5xx. `IDEMPOTENCY_KEY_REUSED` "still being processed" → wait and retry |
| Rate limits | `429` → respect `Retry-After`, show a calm message, never auto-hammer. Budgets: read 120/min, write 30/min, **quote 20/min** (so quotes are requested on selection, not per keystroke) |
| Request id | The app generates `X-Request-Id` per call; it is attached to Sentry breadcrumbs and shown as a short code on error screens for support |
| Money | Treated as decimal text for display only. The parser accepts string or number; **no arithmetic on fares in the app** — every total comes from the server |
| Time | ISO-8601 UTC from the API, displayed in `Asia/Dhaka` |
| Pagination | Opaque `cursor`, `limit` ≤ 50 for rides |

### 8.2 Endpoints used by the app

| Area | Calls |
|---|---|
| Account | `GET /me` · `PATCH /me` · `POST /onboarding/passenger` · `POST /me/deactivate` · `PUT/DELETE /me/devices` |
| Start-up | `GET /config` · `GET /zones/check` · `GET /categories` |
| Booking | `POST /quotes` · `POST /rides` · `POST /rides/{id}/promo` |
| Ride | `GET /rides/{id}` · `GET /rides/{id}/cancel-preview` · `POST /rides/{id}/cancel` · `GET /rides/{id}/pin` · `POST /rides/{id}/pin/renew` |
| After | `GET /rides` · `GET /trips/{id}/receipt` · `POST /trips/{id}/rate` · `GET /wallet` |
| Safety | `POST /trips/{id}/sos` · `POST /incidents/{id}/evidence/upload-url` · `…/complete` |
| Support | `GET/POST /support/tickets` · `GET /support/tickets/{id}` · `POST /support/tickets/{id}/messages` |

### 8.3 Error code → user experience

| Code | What the passenger sees |
|---|---|
| `VALIDATION_FAILED` | Field-level messages from `details` |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | Silent refresh; if it fails, "Please sign in again" |
| `ACCOUNT_SUSPENDED` | Blocked screen with reason and Support |
| `ROLE_NOT_ALLOWED` | "This account can't book rides" (driver/admin account) |
| `NOT_FOUND` | "We couldn't find that ride" → Home |
| `ACTIVE_REQUEST_EXISTS` | Opens the existing ride |
| `QUOTE_EXPIRED` | Automatic re-quote, price change highlighted |
| `INVALID_STATE_TRANSITION` | Refetch the ride and show its real state |
| `OUT_OF_SERVICE_AREA` / `PRICING_UNAVAILABLE` | Out-of-area screen / "This ride type isn't available here right now" |
| `PROMO_INVALID` | Inline on the promo field |
| `RATE_LIMITED` | "Too many attempts. Try again in N s" |
| `INTERNAL` / `UPSTREAM_UNAVAILABLE` / network | "Something went wrong on our side" + Retry + reference code |

Server messages are localised (en/bn) by the backend; the app sends `Accept-Language` and keeps its own fallback copy per code.

### 8.4 Start-up sequence
Restore session → in parallel `GET /me`, `GET /config` (cached, refreshed in background) → route by role/status → check for an active ride (§9.3) → location gate → Home. Cold start to interactive Home in ≤ 2.5 s on a mid-range Android with a warm cache.

## 9. Realtime & trip state

### 9.1 Channel
Private Supabase Realtime **broadcast** channel `ride:{request_id}` (authorised server-side by `private.can_receive_topic`). The realtime client is given the current access token and re-authorised on every token refresh.

| Event | Payload (as built) | App reaction |
|---|---|---|
| `status_changed` | `request_id`, and any of `status`, `trip_id`, `trip_status`, `final_fare` | Treat as a **hint**: refetch `GET /rides/{id}` and render from that |
| `driver_location` | `lat`, `lng`, `heading`, `at` (≤ 1 every 3 s) | Animate the driver marker; ignore points older than the last one shown |

### 9.2 Reliability rules
- `GET /rides/{id}` is always the source of truth; broadcasts can be missed.
- Refetch on: subscribe success, reconnect, app returning to foreground, push received, and every user action on the ride.
- Fallback polling when the socket is not joined: every 4 s while `searching`, 8 s while a driver is on the way, 15 s in trip.
- The local state machine accepts only forward transitions it knows; an unknown status renders a generic "Updating your ride…" and is reported to Sentry.

### 9.3 Recovering an active ride
On launch and on foreground, the app checks its stored active request id, then `GET /rides?limit=1` — a newest ride in `searching`, or `matched` with a non-terminal trip, reopens the Ride screen. (A dedicated `GET /rides/current` is requested in §14, gap B9.)

## 10. Push notifications (Expo)

### 10.1 Flow
1. **Permission in context:** asked right after the first ride request with a one-line reason ("Know the moment your driver arrives"). Never on first launch. If declined, a quiet row in Settings explains how to turn it on; the app still works through realtime.
2. **Token:** get the Expo push token (EAS `projectId`) → `PUT /me/devices {platform: "android" | "ios", token}` after sign-in, on every app start (tokens can rotate) and when the token-refresh listener fires.
3. **Sign-out / account deletion:** `DELETE /me/devices {token}` first, so the next person on that phone gets nothing.
4. **Delivery (backend):** `rider-admin` already queues push in `notification_outbox` and delivers through a provider adapter. It needs an **Expo adapter** and **passenger-facing events** (§14, gaps B2–B3).

### 10.2 Message catalogue (passenger)

| Type | When | Channel (Android) | Tap opens |
|---|---|---|---|
| `ride.driver_assigned` | Driver accepted | Ride updates (high) | Ride screen |
| `ride.driver_arrived` | Driver at pickup | Ride updates (high, sound) | Ride screen |
| `ride.started` | Trip began | Ride updates | Ride screen |
| `ride.completed` | Trip ended, fare final | Ride updates | Trip complete / receipt |
| `ride.cancelled` | Cancelled by driver or admin | Ride updates (high) | Ride screen (rebook) |
| `ride.no_driver` | Search expired | Ride updates | Ride screen (try again) |
| `support.reply` | Support answered a ticket | Support | Ticket thread |
| `safety.update` | Incident acknowledged | Safety (max) | Safety sheet |
| `promo.offer` | Marketing | Offers (**opt-in, off by default**) | Home |

- **Payload contract:** `title`, `body` (localised by the backend to the user's `preferred_language`), and `data: {type, ride_id?, trip_id?, ticket_id?, url}`. `url` is an app deep link (`[scheme]://ride/{id}`), routed by Expo Router. No personal data (names, phone numbers, addresses) in the notification text beyond first name and plate.
- **Foreground:** no system banner for ride events — the in-app sheet already updates; show a subtle toast instead. Background/killed: system notification; tapping cold-starts straight into the target screen.
- Every push triggers a ride refetch; a push is never trusted as state.

### 10.3 Preferences
Settings → Notifications: Ride updates (always on while a ride is active), Support, Safety (cannot be turned off), Offers. Stored per account when gap B4 lands; on-device until then.

### 10.4 Credentials
FCM V1 service-account key and APNs key are uploaded to **EAS credentials**. If "Enhanced push security" is enabled in the Expo project, the Expo access token is stored as a secret in the **backend** environment only.

## 11. Location & maps

- Foreground permission only. High accuracy while Home/Confirm/Ride screens are visible; updates paused in the background.
- Pickup defaults to the current position snapped to the reverse-geocoded address; the passenger can always drag the pin. Accuracy > 50 m shows a non-blocking "Check your pickup point".
- Coordinates are validated client-side (lat −90..90, lng −180..180) and labels trimmed to 200 chars, matching the backend schema.
- Map: MapLibre with light/dark styles, gestures never trapped by the bottom sheet, attribution visible, markers: mint ring (pickup), coral square (destination), vehicle icon per category (driver).
- Place search, reverse geocoding and the route polyline go **through the backend** (§14, gap B10) so provider keys stay server-side and can be swapped (Barikoi has the best Bangladesh address data).
- Location is never logged to analytics or Sentry in raw form.

