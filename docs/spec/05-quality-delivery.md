# Passenger App Spec — 05 · Quality & delivery

[01 Overview & foundation](01-overview-foundation.md) · [02 Design system](02-design-system.md) · [03 Screens](03-screens.md) · [04 Integration](04-integration.md) · [05 Quality & delivery](05-quality-delivery.md)

---

## 12. Resilience, security, quality

### 12.1 Poor connectivity (blueprint §4.3)
- Global offline bar; cached Home, saved places, history and receipts stay readable.
- Every in-flight action shows what is happening and can be safely retried (idempotency). No silent failures, no duplicate rides.
- Request timeouts: 10 s reads, 15 s writes; SOS retries indefinitely with backoff and shows "Sending… / Sent".
- TanStack Query cache persisted (encrypted) with a 24 h max age; ride state is never served stale without a visible "Updating…" indicator.

### 12.2 Security
- Session tokens in encrypted storage; nothing sensitive in AsyncStorage or logs.
- No secret keys in the bundle (§4). No direct database access from the app.
- Deep links are validated (known routes, UUID params) before navigation; share-link tokens are never logged.
- Screens showing the pickup PIN are excluded from app-switcher snapshots.
- Root/jailbreak is detected and reported (not blocked) for fraud signals.
- Sentry scrubs `phone`, `email`, `token`, `authorization`, coordinates and addresses.
- TLS only; certificate pinning is deferred (operational risk with OTA) and revisited before digital payments.

### 12.3 Performance budgets
| Metric | Budget (mid-range Android, e.g. 4 GB RAM) |
|---|---|
| Cold start → interactive | ≤ 2.5 s |
| Tap → visual response | ≤ 100 ms |
| Scroll and sheet animation | 60 fps, no dropped frames > 5% |
| Quote shown after destination chosen | ≤ 1.5 s on 4G |
| Android download size | ≤ 35 MB |
| Crash-free sessions | ≥ 99.5% |

### 12.4 Localisation
English and Bengali for every string, including errors, push copy and store listings. A CI check fails on missing keys (as in `rider-admin/scripts/check-i18n.mjs`). Dates, plurals and currency through ICU. Layouts are tested with Bengali at 130% font scale.

### 12.5 Analytics (privacy-respecting)
Funnel events only, no raw location or contact data: `onboarding_step_completed`, `location_permission_result`, `category_selected`, `destination_selected(source)`, `quote_shown`, `quote_changed`, `ride_requested`, `match_time`, `ride_cancelled(stage, fee)`, `no_driver_found`, `trip_completed`, `rating_submitted`, `sos_triggered`, `push_permission_result`. These map to the blueprint KPIs (request-to-match, time to match, passenger cancellation, fare-estimate variance, repeat rate).

### 12.6 Testing
| Layer | What |
|---|---|
| Unit | Money/date formatting, phone normalisation, ride state reducer, API error mapping, Zod schemas |
| Component | Each design-system primitive in light/dark, en/bn, 130% font |
| Integration | API client against a mocked server: idempotent retry, token refresh, 429, envelope errors |
| End-to-end (Maestro) | Sign-in → book → cancel; book → complete → rate; location denied; no driver found; offline during request; kill and reopen mid-trip |
| Contract | Response schemas run against the staging backend in CI |
| Manual matrix | Low-end Android (Android 9+), recent iPhone, slow network profile, GPS drift, Bengali, screen reader |

Demo accounts already seeded by the backend on staging (`customer@…` passenger, `rider@…` driver) are used for end-to-end runs; the paired driver side is driven through the API until the driver app exists.

## 13. Delivery milestones

| # | Milestone | Exit criteria |
|---|---|---|
| P0 | Foundation: project, EAS environments, design tokens + primitives, API client, i18n, Sentry, CI | Dev build installs; env pulled from EAS; lint/type/test green |
| P1 | Onboarding: welcome, phone/code, name, location gate, out-of-area | New user becomes `passenger`; denied location recoverable; both languages |
| P2 | Booking: home, plan ride, pin on map, saved places, confirm with quote | Quote shown ≤ 1.5 s; expiry and price-change handled |
| P3 | Ride lifecycle: searching → complete, realtime + polling, cancel, PIN, recovery after kill | E2E ride passes with network drops and app restarts; no duplicate requests |
| P4 | After the ride: receipt, rating, history, wallet | Receipt matches admin trip detail to the taka |
| P5 | Push, safety, support, settings, account deletion | Push taps deep-link correctly from killed state; SOS reaches the admin safety queue |
| P6 | Hardening: accessibility audit, performance budgets, store assets, privacy labels, closed pilot build | Budgets in §12.3 met; pilot checklist signed off |

P1 and P5 depend on backend gaps B1–B3; the rest can proceed against the current backend with email/password demo accounts.

## 14. Backend gaps (work needed in `rider-admin`)

Found by reading the as-built code. None block starting the app; B1–B3 block launch.

| # | Gap | Evidence | Needed |
|---|---|---|---|
| **B1** | Passenger sign-up is off | `supabase/config.toml`: `[auth] enable_signup = false`, `[auth.sms] enable_signup = false`, no Google provider | Enable phone OTP with a Bangladesh SMS gateway (the notifications doc already notes Twilio's limits there), CAPTCHA on OTP request, optional Google provider. New auth users must get role `user` |
| **B2** | No Expo push adapter | `src/server/services/notify.ts` supports only `log` and a generic `webhook` relay | Add provider `expo`: send to Expo Push API in batches, read receipts, delete tokens reported `DeviceNotRegistered` |
| **B3** | No ride pushes to passengers | `private.enqueue_notification` is only called for admins; ride transitions broadcast on Realtime only | Queue the §10.2 messages on trip transitions, in the passenger's language, with `type` + ids as data |
| B4 | No notification preferences | — | Per-user category opt-outs honoured by the outbox |
| B5 | Trip sharing not exposed | `trips.share_token_hash` column exists; no `/trips/{id}/share` route or public tracking page | Share endpoint + public read-only tracking page |
| B6 | No saved places | No table or route | CRUD for saved places (label, point, address, note) |
| B7 | No trusted contacts | — | CRUD + optional SMS on SOS |
| B8 | No masked calling | Only `phone_masked` is returned | Call-bridge provider, or a policy decision to reveal the driver's number during an active trip |
| B9 | No "current ride" lookup | Passenger has no equivalent of `/driver/trips/current` | `GET /rides/current` |
| B10 | No place search / geocoding / route geometry | Quotes return distance and duration only | `/places/search`, `/places/reverse`, and a `polyline` on the quote |
| B11 | Category list lacks live data | `list_active_categories` returns static fields; the mockups show ETA, nearby count | Add `pickup_eta_s`, `available_drivers`, optional "from" fare per category |
| B12 | Promo applies only after the ride is created | `rideSchema` has no `promo_code`; `/promotions/validate` is not built | Accept a code on the quote (preview discount) or on `POST /rides` |
| B13 | Consent not recorded | `onboard_passenger` takes only `full_name` | Store terms/privacy version + timestamp |
| B14 | Rating tags, ticket attachments | `rateSchema` has no `tags`; no `/support/attachments/upload-url` | Optional, post-pilot |
| B15 | Contract drift | Spec says money is a decimal string and names `/trips/{id}/rating`, `fare_finalised`; code returns JSON numbers, `/trips/{id}/rate`, and `final_fare` on `status_changed`; ticket body uses `tripId` (camelCase) | Align the spec or the code; publish an OpenAPI file the app can generate types from |

## 15. Decisions to lock

| # | Decision | Recommendation |
|---|---|---|
| D1 | App name, bundle ids, deep-link scheme | Needed before the first EAS build |
| D2 | SMS gateway for OTP | A local gateway with a registered sender ID; start the contract early (takes days) |
| D3 | Google sign-in in v1? | Keep as secondary; still collect a phone number afterwards (drivers need to reach passengers) |
| D4 | Is location a hard gate? | Yes for booking (as in the mockups); allow manual pin when GPS fails |
| D5 | Map and place provider | MapLibre + OpenFreeMap tiles; Barikoi for search/geocoding/routing |
| D6 | Calling the driver | Masked bridge if budget allows; otherwise reveal the number only during an active trip |
| D7 | Fare shown per search result (as in the mockup) | Defer; show distance/time in results and the fare on Confirm, to stay inside the quote rate limit |
| D8 | Bengali digits for fares | Latin digits by default in both languages |
| D9 | Minimum OS versions | Android 9+, iOS 16+ |
| D10 | Emergency number shown after SOS | 999 |
