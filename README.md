# Rider — passenger app

React Native + Expo (SDK 58) passenger app for the ride-hailing platform. The backend and admin panel live in
`rider-admin`; this app talks to its `/api/v1` REST API and uses Supabase only for sign-in and realtime.

Specification: [docs/spec](docs/spec/01-overview-foundation.md).

## Status

| Milestone | Scope | State |
|---|---|---|
| P0 Foundation | Project, EAS environments, API client, storage, i18n, monitoring, CI | Done |
| P0 Design system | Tokens, light/dark themes, Inter + Hind Siliguri, 20 primitives, dev gallery at `/dev/gallery` (spec 02) | Done |
| Screens (spec 03) | All passenger screens §7.1–7.16: sign-in, location gate, booking, live ride, receipts, wallet, safety, support, profile, settings | Built; signed-in screens not yet run against the backend |
| Push (spec 04 §10) | Channels, permission after first request, token registration, tap routing via a deep-link allow-list | Built; rider-admin sends through Expo once `NOTIFY_PUSH_PROVIDER=expo` and an EAS project id are set |
| Hardening (spec 05 §12) | Encrypted 24 h offline cache, PIN screenshot guard, privacy-safe funnel events, SOS photo evidence, Maestro flows in `.maestro/` | Built; Maestro flows not yet run |

## First-time setup

1. Node 22+ and npm. Install: `npm install`.
2. Get the public configuration. Either pull it from EAS:
   ```bash
   npx eas-cli@latest env:pull --environment development
   ```
   or copy `.env.example` to `.env.local` and fill in the `EXPO_PUBLIC_*` values (local admin API, Supabase URL and
   publishable key). Never put a secret behind an `EXPO_PUBLIC_` name; CI blocks it.
3. Build a **development client** once (Expo Go cannot run this app — it uses native modules such as MMKV and Sentry):
   ```bash
   npx eas-cli@latest build --profile development --platform android
   ```
   or locally with Android Studio installed: `npm run android`.
4. Start Metro: `npm start`, then open the development build.
5. Signing in: by default the app signs in with a 6-digit code sent by **email** (locally the emails land in Mailpit,
   http://127.0.0.1:54324). Phone (SMS) codes are off until you have an SMS gateway; set
   `EXPO_PUBLIC_PHONE_SIGN_IN=true` to offer them, with email as the fallback. Setup:
   `../rider-admin/docs/integrations/sign-in.md`.

### Run against the local backend

With Docker running, start the local stack and admin API in `../rider-admin`:

```bash
pnpm db:start
```

```bash
pnpm with-local next dev -p 3005
```

Then start this app with the local values (no `.env` file is changed):

```bash
npm run start:local
```

The admin answers CORS for `localhost` origins only when it runs in `local` mode, so the web preview works too.

An Android emulator reaches a local `rider-admin` at `http://10.0.2.2:3000/api/v1`.

## Environments

| EAS environment | Build profile | `EXPO_PUBLIC_APP_ENV` | App id |
|---|---|---|---|
| development | `development` | development | `bd.rider.passenger.dev` |
| preview | `preview` | staging | `bd.rider.passenger.staging` |
| production | `production` | production | `bd.rider.passenger` |

App name, ids and scheme are placeholders until decision D1 is made (`app.config.ts`).

Secrets: signing credentials and push keys (FCM V1, APNs) are uploaded to **EAS credentials**; `SENTRY_AUTH_TOKEN`
is an EAS environment variable with *secret* visibility. Nothing secret is committed or bundled.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Metro dev server |
| `npm run check` | Everything CI runs: typecheck, lint, env check, i18n check, tests |
| `npm test` | Unit tests (Jest, `jest-expo`) |
| `npm run doctor` | Expo dependency and config diagnostics |
| `npx expo start --web` | Browser preview of the UI (development only; no secure storage on web) |

## Layout

```
src/app/        Expo Router routes (every file is a screen)
src/api/        API client, error model, idempotency intents, endpoint functions + response schemas
src/features/   Feature state and components (auth, booking, ride, …)
src/i18n/       en.json, bn.json and helpers
src/theme/      tokens (colours, spacing, radius, type), fonts, light/dark ThemeProvider
src/ui/         design-system primitives — screens import from `@/ui` only
src/lib/        env, storage, supabase, monitoring, query client, scrubbing
scripts/        CI guards (public env, i18n)
```
