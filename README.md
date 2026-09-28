# SafeHer – Women Safety Android App

SafeHer is a personal-safety app: a hold-to-activate SOS that records **real GPS** data, one-tap call/SMS shortcuts for the emergency number and your contacts, live tracking on a map, SOS history, and practice drills.

It prioritises **honest behaviour over simulation**: it never claims a call connected or an SMS was sent (it only opens your phone's dialer/SMS app), and it never invents GPS, battery, network or audio data.

## Architecture

```
Android app (Capacitor WebView)
   │  loads the running Next.js server (server.url)
   ▼
Next.js app  ──►  /api/* route handlers
                     │  verify Firebase ID token (Firebase Admin) → uid
                     ▼
                  SQLite (data/safeher.db, better-sqlite3)
```

- **Firebase is identity only** (Email/Password + Google). Passwords are never stored in SQLite. There is no Firestore/Realtime Database.
- Every protected API route verifies the `Authorization: Bearer <ID token>` **server-side** and takes the uid from the verified token. A uid sent by a client is never trusted, and all queries are scoped by that uid.
- The Android app is a WebView on your Next.js server (the app is dynamic, so it is **not** statically exported). The server address comes from `NEXT_PUBLIC_API_BASE_URL`; nothing is hardcoded.

## Requirements

- Node 20+ and npm
- Android Studio (includes JDK 21 and the Android SDK). The Gradle build pins JDK 21 automatically, so a newer system JDK (e.g. 25) is fine.
- A Firebase project (Authentication enabled: Email/Password and, optionally, Google)

## Setup

```bash
npm install
cp .env.local.example .env.local      # then fill in your Firebase values
npm run db:init                       # creates/migrates data/safeher.db (safe to re-run; data is preserved)
```

## Run the web app

```bash
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
4. Press **Run** in Android Studio. The app loads from your dev server, so UI code changes appear without rebuilding the APK. Re-run `npx cap sync android` after changing the server address or adding a Capacitor plugin.

Command-line build: `cd android && ./gradlew assembleDebug` (APK in `android/app/build/outputs/apk/debug/`).

### Google sign-in on Android

Google blocks OAuth inside embedded WebViews, so the app uses the native Google account picker. To enable it:

1. Firebase Console → Project settings → add an **Android app** with package `com.safeher.app` and your debug/release **SHA-1** fingerprint (`cd android && ./gradlew signingReport`).
2. Download `google-services.json` into `android/app/` (it is git-ignored).
3. Rebuild. Until then the Google button shows "not set up for this build" and email/password works normally.

### Production

Deploy the Next.js server (with persistent storage for `data/`, or move the DB), set `NEXT_PUBLIC_API_BASE_URL=https://your-domain`, run `npx cap sync android`, and build a signed release. Release builds only allow HTTPS.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run db:init` / `db:inspect` | Create/migrate and inspect the SQLite DB |
| `npm run test:api` | End-to-end API tests: auth, per-user isolation, SOS lifecycle (needs the Auth Emulator, see below) |
| `npx cap sync android` | Sync Capacitor config/plugins into `android/` |
| `cd android && ./gradlew assembleDebug` / `lint` | Debug APK / Android lint |

### API tests (no real accounts created)

```bash
npx firebase-tools emulators:start --only auth --project <your-project-id>
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 SAFEHER_DB_PATH=/tmp/safeher-test.db npm run dev
npm run test:api
```

The emulator hook is ignored when `NODE_ENV=production`, so emulator tokens are never accepted in production.

## How SOS works (and what it does not do)

- **Hold** the SOS button (3/5/10 s, your choice). The SOS record is created immediately; real GPS fixes attach as they arrive and are buffered if the server is unreachable.
- The emergency screen shows call/SMS buttons for the emergency number (default 112) and your contacts. These **open the dialer / SMS composer**; you press call/send. The app records "opened", never "sent".
- **Drill** mode records a practice event and contacts nobody.
- Real SOS can be ended after a short delay (`NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS`, default 10 s); Android Back never abandons an active SOS.

## Known limitations

- Location tracking and SOS updates run only while the app is open in the foreground (no background service).
- Audio recording is kept in memory only (not uploaded) and needs an HTTPS server.
- The app needs the server to load; without connectivity it shows a connection-error page (with a note to use the phone's dialer). An in-progress SOS keeps working when the connection drops.
- Email verification and rate limiting are not implemented.
