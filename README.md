# SafeHer – Women Safety Android App

SafeHer is a personal-safety app: a hold-to-activate SOS that records **real GPS** data, a **power-button quick trigger**, one-tap call/SMS shortcuts for the emergency number and your trusted circle, live tracking on a map, SOS history, and practice drills.

It prioritises **honest behaviour over simulation**: it never claims a call connected or an SMS was sent (it only opens your phone's dialer/SMS app), and it never invents GPS, battery, network or audio data.

## Features

- **SOS**: press-and-hold (3/5/10 s) from the home screen or the always-visible nav button. The SOS record is saved immediately; real GPS fixes attach as they arrive and are buffered if the server is unreachable.
- **Power-button trigger** (Android): press the power button 3–6 times quickly to start an SOS, even from the lock screen. See [docs/POWER_BUTTON_TRIGGER.md](docs/POWER_BUTTON_TRIGGER.md) for how it works and its limits.
- **My circle**: trusted contacts with one-tap call and "share my location" SMS shortcuts.
- **Live location**: Leaflet + OpenStreetMap map with accuracy circle, battery, network and saved-point count.
- **History**: every SOS and drill with its recorded route, plus an activity log. Paginated.
- **Drills**: practice the full flow; nobody is contacted.
- **Readiness check**: the home screen scores location permission, circle, network and battery from real device state.
- **Accounts**: Firebase Email/Password and Google; profile, blood group, language.
- **Emergency card** (Android, native screen): a second Activity built from XML layouts that reads an on-device SQLite copy of your profile and circle, so it opens with no network (long-press the app icon, or Profile).
- **Evidence**: photos, short video and audio you choose to upload, plus download/share. **Safe route**: walking directions and nearby police, hospitals and pharmacies. **Card scanner**: on-device OCR and photo labelling.
- **Insights**: a content-based tip recommender and a battery-drain forecast (linear regression on real readings), with opt-in smart alerts.
- **Safety assistant**: Gemini behind a server proxy (needs `GEMINI_API_KEY`), with a built-in fixed-text guide when it is unavailable.

How each feature maps to the course tasks, and what is and is not verified: [docs/FEATURE_MAP.md](docs/FEATURE_MAP.md).

## Architecture

```
Android app (Capacitor WebView + native SosTrigger plugin/service)
   │  loads the running Next.js server (server.url)
   ▼
Next.js app  ──►  /api/* route handlers
                     │  verify Firebase ID token (Firebase Admin) → uid
                     ▼
                  SQLite (data/safeher.db, better-sqlite3, WAL)
```

- **Firebase is identity only.** Passwords are never stored in SQLite. There is no Firestore/Realtime Database.
- Every protected API route verifies the `Authorization: Bearer <ID token>` **server-side** and takes the uid from the verified token. A uid sent by a client is never trusted, and all queries are scoped by that uid.
- The Android app is a WebView on your Next.js server (dynamic app, **not** statically exported). The server address comes from `NEXT_PUBLIC_API_BASE_URL`; nothing is hardcoded.
- Hardening: per-client rate limiting, request-size limits, strict input validation, security headers, `no-store` on API responses, public `/api/health` for monitoring.

## Requirements

- Node 20+ and npm
- Android Studio (includes JDK 21 and the Android SDK). The Gradle build pins JDK 21, so a newer system JDK is fine.
- A Firebase project with Authentication enabled (Email/Password, optionally Google)

## Setup

```bash
npm install
cp .env.local.example .env.local      # then fill in your Firebase values
npm run db:init                       # creates/migrates data/safeher.db (safe to re-run; data is preserved)
npm run dev -- -H 0.0.0.0
```

## Run on Android (emulator or phone)

1. Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`:
   - Android emulator: `http://10.0.2.2:3000`
   - Real phone on the same Wi-Fi: `http://<your-computer-LAN-IP>:3000`
2. Start the server: `npm run dev -- -H 0.0.0.0`
3. Sync and open Android Studio:
   ```bash
   npx cap sync android
   npx cap open android
   ```
4. Press **Run**. The app loads from your dev server, so UI changes appear without rebuilding the APK. Re-run `npx cap sync android` after changing the server address or a Capacitor plugin. Native (Java) changes need a rebuild.

Command-line build: `cd android && ./gradlew assembleDebug` (APK in `android/app/build/outputs/apk/debug/`).

### Google sign-in on Android

Google blocks OAuth inside embedded WebViews, so the app uses the native Google account picker:

1. Firebase Console → Project settings → add an **Android app** with package `com.safeher.app` and your debug/release **SHA-1** (`cd android && ./gradlew signingReport`).
2. Download `google-services.json` into `android/app/` (git-ignored).
3. Rebuild. Until then the Google button explains it isn't set up for this build and email/password works normally.

## Production

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): environment, Docker, HTTPS, health checks, backups (`npm run db:backup`), scaling notes, and the signed Android release build.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run db:init` / `db:inspect` / `db:backup` | Create/migrate, inspect and back up the SQLite DB |
| `npm run test:insights` | Unit tests for the recommender and battery regression (Node 22.6+) |
| `npm run test:api` | End-to-end API tests: auth, per-user isolation, SOS lifecycle, power trigger, pagination, limits (needs the Auth Emulator) |
| `npx cap sync android` | Sync Capacitor config/plugins into `android/` |
| `cd android && ./gradlew assembleDebug` / `lint` / `bundleRelease` | Debug APK / Android lint / Play Store bundle |

### API tests (no real accounts created)

```bash
npx firebase-tools emulators:start --only auth --project <your-project-id>
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 SAFEHER_DB_PATH=/tmp/safeher-test.db npm run dev
npm run test:api                     # add TEST_RATE_LIMIT=1 to also exercise the rate limiter
```

The emulator hook is ignored when `NODE_ENV=production`, so emulator tokens are never accepted in production.

## How SOS works (and what it does not do)

- The SOS record exists the moment it starts; GPS fixes attach as they arrive and are queued if the server is unreachable.
- The emergency screen shows call/SMS buttons for the emergency number (default 112) and your circle. These **open the dialer / SMS composer**; you press call/send. The app records "opened", never "sent".
- A real SOS can be ended after a short delay (`NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS`, default 10 s). Android Back never abandons an active SOS.

## Known limitations

- Location tracking and SOS updates run only while the app is on screen (no background location service).
- Audio and video evidence are uploaded only when you press Upload (8 MB limit per file); recording audio in the browser needs an HTTPS server.
- The on-device copy (Emergency card, offline contacts) is read-only and refreshed whenever the app is online; edits need a connection.
- Battery forecasts and smart alerts only run while the app is open, and need about 15 minutes of unplugged readings.
- The app needs the server to load; offline it shows a connection-error page with an emergency-call button. An in-progress SOS keeps working when the connection drops.
- The power-button trigger is best-effort on Android (OEM battery savers can stop it); see its doc.
- Email verification and server-shared rate limiting are not implemented. SQLite means a single server instance.
