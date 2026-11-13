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

## Run the app in an Android emulator

`npx expo run:android` builds a debug development build, installs it on the running emulator and starts Metro.
There is no `android/` folder in the repo: Expo generates it from `app.config.ts` on the first run (prebuild), and it
is regenerated whenever native config or plugins change.

By default the app uses the values in `.env.local`, which point at the live backend
(`https://rider-admin.onrender.com/api/v1`). Use `npm run start:local` only when you want the local backend.

### 1. Prerequisites

Install these on Windows:

- Node.js 22+ and npm
- JDK 17
- Android Studio, with Android SDK, SDK Platform-Tools and Android Emulator
- At least one Android Virtual Device (AVD)

Check them:

```bash
node -v
```

```bash
java -version
```

```bash
adb --version
```

```bash
emulator -list-avds
```

If `emulator -list-avds` prints nothing, create a device in Android Studio (Device Manager) first.
If `adb` or `emulator` is not found, add the SDK's `platform-tools` and `emulator` folders to your `Path`
(the SDK is usually at `C:\Users\<you>\AppData\Local\Android\Sdk`), or set `ANDROID_HOME` to the SDK folder.

### 2. Configuration

Make sure `.env.local` exists with the `EXPO_PUBLIC_*` values (see "First-time setup"). The app reads them when
Metro starts, so restart Metro after changing them.

### 3. Build and run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start an emulator from Android Studio, or from the command line:

   ```bash
   emulator -avd <YOUR_AVD_NAME>
   ```

3. Confirm ADB sees it (it should be listed as `device`):

   ```bash
   adb devices
   ```

4. Build, install and start the app:

   ```bash
   npm run android
   ```

   The first build takes several minutes (Gradle downloads its dependencies). The app installs as
   **Rider (Dev)** with id `bd.rider.passenger.dev`.

5. Later runs: if native code has not changed, you do not need to rebuild. Start Metro and open the installed app:

   ```bash
   npm start
   ```

   then press `a` in the Metro terminal.

### 4. Troubleshooting

- **SDK location not found**: create `android/local.properties` with
  `sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`, or set `ANDROID_HOME`.
- **No emulator detected**: run `adb devices`; start the emulator and wait until it is listed as `device`.
- **Gradle cache problems**: run `cd android; .\gradlew clean`, then `npm run android` again.
- **Metro cache problems**: run `npx expo start --clear`.
- **Native config or a plugin changed**: run `npx expo prebuild --platform android --clean`, then `npm run android`.
- **App cannot reach the backend**: check `EXPO_PUBLIC_API_BASE_URL` in `.env.local` and restart Metro.
  A cold Render instance can take up to a minute to answer the first request.

### 5. Checklist

- `npm install` finishes without errors
- the emulator is running and `adb devices` lists it
- `npm run android` completes without Gradle errors
- **Rider (Dev)** opens on the emulator and loads the JavaScript bundle
- the sign-in screen sends an email code through the live backend

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
