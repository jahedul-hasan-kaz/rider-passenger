# Passenger App — Product & Technical Specification

**Status:** Draft v1.0 · 2026-11-12
**App:** `[APP NAME]` passenger app (ride-hailing, Bangladesh, Dhaka pilot)
**Stack:** React Native + Expo · Expo Push Notifications · secrets in Expo (EAS) environment variables
**Scope:** the passenger mobile app only. No code in this document.

**Sources**

| Source | Used for |
|---|---|
| *Ride-Sharing Platform Blueprint* (20 pp.) | Business rules, passenger screens (§4.1), shared principles (§4.3), security rules (§8.1) |
| 8 UI mockups (welcome → phone → code → location → home → plan ride → save place) | Visual direction and the onboarding/booking flow. Inspiration, not pixel contracts |
| `C:\Workspace\rider-admin` (Next.js + Supabase backend, as built) | The real API contract: `docs/spec/04-business-logic.md`, `docs/spec/05-api.md`, `src/app/api/v1/*`, `src/lib/schemas/api.ts`, `supabase/migrations/*` |

Where the as-built backend differs from its own spec, this document follows the **code**. Everything the app needs that the backend does not yet provide is collected in [§14 Backend gaps](05-quality-delivery.md#14-backend-gaps-work-needed-in-rider-admin).

**Document map** (section numbers run continuously across the five files, so "§14, gap B6" always means the same place)

| File | Sections |
|---|---|
| [01-overview-foundation.md](01-overview-foundation.md) | §1 Product principles · §2 Scope · §3 Technology · §4 Environments & secrets |
| [02-design-system.md](02-design-system.md) | §5 Design system |
| [03-screens.md](03-screens.md) | §6 Navigation map · §7 Screens |
| [04-integration.md](04-integration.md) | §8 API integration · §9 Realtime & trip state · §10 Push notifications · §11 Location & maps |
| [05-quality-delivery.md](05-quality-delivery.md) | §12 Resilience, security, quality · §13 Milestones · §14 Backend gaps · §15 Decisions to lock |

---

## 1. Product principles

1. **Price and pickup time before commitment.** The passenger never taps "Request" without seeing the fare and ETA.
2. **The server is the only source of truth.** Fares, trip states and money come from the backend. The app displays; it never computes a fare or moves a state on its own.
3. **One primary action per screen.** A single full-width button at thumb height; everything else is secondary.
4. **Never a dead end.** Every error, empty state and permission refusal says what happened and offers the next step.
5. **Built for Dhaka conditions.** Patchy 3G, GPS drift between buildings, cash payments, mid-range Android phones, Bengali and English.
6. **Safety is always one tap away** from the moment a driver is assigned until the trip ends.
7. **Ask for permissions in context,** with the reason, at the moment they are needed.

## 2. Scope

**In v1**

- Phone sign-in (6-digit code), optional Google sign-in, name capture, language choice
- Location gate, service-area check
- Vehicle choice → destination → fare quote → request → live matching → live trip → cash payment → receipt → rating
- Cancellation with fee preview, pickup PIN (feature flag), promo codes (feature flag)
- Ride history and receipts, wallet (credit / fee owed)
- SOS, trip sharing, support tickets
- Profile, language, notification preferences, account deletion
- Push notifications (Expo), realtime trip updates (Supabase Realtime)
- Saved places (Home, Office, Other)

**Not in v1:** digital payments (bKash/Nagad/card — flag `digital_payments` is off), scheduled rides, multi-stop rides, in-app chat, tipping, referral programme, driver features (separate app).

## 3. Technology

| Concern | Choice | Why |
|---|---|---|
| Runtime | Expo (current stable SDK, New Architecture), TypeScript strict | Asked for; EAS handles build, update and secrets |
| Build | **Development builds** via EAS Build (not Expo Go) | Native map SDK and remote push need a dev build |
| Navigation | Expo Router (file-based, typed routes, deep links) | Deep links from push and share links come for free |
| Server state | TanStack Query | Caching, retry, background refetch, offline persistence |
| Local state | Zustand (small stores: booking draft, session, UI prefs) | Minimal; booking draft survives navigation |
| Forms / validation | React Hook Form + Zod | Zod schemas mirror `src/lib/schemas/api.ts` in the backend |
| Auth + realtime | `@supabase/supabase-js` (Auth and Realtime **only**) | The app never reads or writes tables directly; all data goes through `/api/v1` |
| HTTP | One typed fetch client (envelope, errors, idempotency, request id) | See §8 |
| Maps | MapLibre React Native, same style URL as the admin (OpenFreeMap default) | No per-load map fees; consistent with admin; style swappable by env |
| Location | `expo-location` (foreground only) | Passengers never need background location |
| Push | `expo-notifications` + Expo Push Service | Asked for |
| Motion | Reanimated + Gesture Handler, `@gorhom/bottom-sheet` | 60 fps sheets and map-linked transitions |
| Lists / images | FlashList, `expo-image` | Smooth history on low-end Android |
| i18n | `i18next` + `expo-localization`, ICU plurals | English + Bengali from day one |
| Secure storage | `expo-secure-store` (+ encrypted MMKV for the session blob) | SecureStore has a ~2 KB value limit; the Supabase session exceeds it, so SecureStore holds the encryption key and MMKV holds the encrypted session |
| Monitoring | Sentry (`sentry-expo` successor), PII scrubbing | Matches the backend's Sentry + request-id correlation |
| OTA updates | EAS Update with channels per environment | Fix copy/JS bugs without a store release |

### 3.1 Project structure (target)

Expo SDK 58 keeps routes under `src/app/`, so the route folders below live there (as built).

```
src/app/                  Expo Router routes
  (auth)/                 welcome, phone, code
  (gate)/                 location, out-of-area, account-blocked
  (app)/                  home, plan, pin-on-map, confirm, ride/[id], history, receipt/[tripId],
                          wallet, support, safety, profile, settings
src/
  api/                    client, endpoint functions, Zod response schemas, error map
  features/<name>/        screens' components, hooks, stores (auth, booking, ride, places, support…)
  ui/                     design-system primitives (Button, Sheet, Field, Card, Chip, Toast…)
  theme/                  tokens, typography, light/dark
  i18n/                   en.json, bn.json
  lib/                    money, dates, geo, haptics, analytics, logger
app.config.ts             variants + env wiring
eas.json                  build / update profiles
```

## 4. Environments & secrets (Expo)

**Rule: nothing secret ships in the app.** Anything bundled into a mobile binary can be extracted. The app holds only publishable values; every real secret lives on the server or in EAS.

| Variable | Kind | Where it lives | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Public | EAS env (plain text), per environment | Admin deployment origin, e.g. `https://…/api/v1` |
| `EXPO_PUBLIC_SUPABASE_URL` | Public | EAS env (plain text) | |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | EAS env (plain text) | Publishable key only. **Never** the secret/service-role key (blueprint §8.1) |
| `EXPO_PUBLIC_MAP_STYLE_URL` | Public | EAS env (plain text) | MapLibre style JSON |
| `EXPO_PUBLIC_APP_ENV` | Public | EAS env | `development` / `staging` / `production` |
| `EXPO_PUBLIC_SENTRY_DSN` | Public | EAS env | DSNs are not secret |
| `SENTRY_AUTH_TOKEN` | **Secret** | EAS env, visibility *secret* | Build-time only (source-map upload) |
| Google OAuth client IDs | Public | EAS env | Client IDs only; no client secret in the app |
| FCM V1 service-account key, APNs key | **Secret** | EAS **credentials** (expo.dev → Credentials) | Used by Expo Push Service; never in the repo |
| Android keystore, iOS certs/profiles | **Secret** | EAS credentials (managed) | |
| Expo access token (push security) | **Secret** | Backend env in `rider-admin` only | See §10 |

- Three EAS environments: **development**, **preview** (staging), **production**, each with its own Supabase project/API origin, bundle id suffix (`.dev`, `.staging`) and app icon badge so builds can sit side by side.
- Local development pulls values with `eas env:pull` into an untracked `.env.local`. `.env*` is git-ignored; a committed `.env.example` lists names only.
- A CI check fails the build if any `EXPO_PUBLIC_*` name contains `SECRET`, `SERVICE`, `PRIVATE` or `TOKEN` (mirrors the backend's `scripts/check-public-env.mjs`).
- Feature flags and tunables are **not** env vars: they come from `GET /config` at start-up (§8.4).

