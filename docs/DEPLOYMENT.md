# Deploying SafeHer

SafeHer is a single Next.js server (UI + `/api/*`) with a SQLite file. The Android app is a WebView that loads this server over HTTPS.

## 1. Environment

Copy `.env.local.example` and fill in the Firebase values. For production also set:

| Variable | Notes |
|---|---|
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server only. Never in the client or the APK |
| `NEXT_PUBLIC_*` | Inlined at **build** time: set before `npm run build` / `docker build` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server only. Enables the Safety Assistant (default model `gemini-2.5-flash`). Without the key the assistant answers 503 and the app shows a fixed-text guide |
| `SAFEHER_MEDIA_DIR` | Optional. Uploaded evidence (photo / audio / video). Default `./data/media`, which is inside the Docker volume. Back it up together with the database |
| `SAFEHER_DB_PATH` | Optional. Default `./data/safeher.db`. Put it on a persistent disk |
| `RATE_LIMIT_PER_MINUTE` | Per-client API limit (default 600) |
| `CORS_ALLOWED_ORIGINS` | Leave empty (same-origin) unless a client is hosted elsewhere |

`FIREBASE_AUTH_EMULATOR_HOST` is ignored when `NODE_ENV=production`.

## 2. Run

**Node**

```bash
npm ci
npm run db:init
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

**Docker** (the SQLite file lives in a volume)

```bash
docker build -t safeher \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=... \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... .
docker run -d --name safeher -p 3000:3000 -v safeher-data:/app/data \
  -e FIREBASE_CLIENT_EMAIL=... -e FIREBASE_PRIVATE_KEY="$(cat key.pem)" -e GEMINI_API_KEY=... \
  -e NEXT_PUBLIC_FIREBASE_PROJECT_ID=... safeher
```

The container listens on `$PORT` if the host sets one (Render uses 10000), otherwise 3000.

Put a reverse proxy (Caddy / nginx / a cloud load balancer) in front for **HTTPS**, and have it send `X-Forwarded-For` (the rate limiter keys on it). Release builds of the Android app only allow HTTPS. Evidence uploads are up to 8 MB, so allow at least that in the proxy (nginx: `client_max_body_size 9m;`; Caddy and most cloud load balancers allow it by default).

## 3. Operations

- **Health**: `GET /api/health` returns 200 `{status:"ok"}` or 503 `{status:"degraded"}` (database or Firebase Admin not ready). Use it for the load-balancer check and uptime monitoring. The Docker image already has a `HEALTHCHECK`.
- **Backups**: `npm run db:backup` writes a consistent online snapshot to `data/backups/`. Schedule it (cron) and copy the files off the machine. For continuous replication use [Litestream](https://litestream.io/) on the same volume.
- **Migrations**: automatic and additive on server start (`backend/db/schema.cjs`); safe to deploy repeatedly.
- **Logs**: API errors are logged server-side; clients only receive generic messages.

## 3b. Scaling notes (honest)

SQLite in WAL mode comfortably serves thousands of users on one instance: reads are concurrent and the writes here are tiny. The limits are by design:

- **One instance** (the file is local, the rate limiter is in memory). Scale vertically first.
- To go multi-instance you must replace SQLite with a networked database (the API layer is isolated in `backend/db` and the routes use plain SQL) and move the rate limiter to the proxy or a shared store.
- Location writes are throttled client-side (5 s / 5 m) and server-validated; history/activity endpoints are paginated.

## 4. Android release

1. Set `NEXT_PUBLIC_API_BASE_URL=https://your-domain` in `.env.local`, then `npx cap sync android`.
2. Create a keystore and `android/keystore.properties` (git-ignored):
   ```
   storeFile=/absolute/path/safeher-release.jks
   storePassword=...
   keyAlias=...
   keyPassword=...
   ```
3. `cd android && ./gradlew bundleRelease` (Play Store) or `assembleRelease` (APK).
4. Google sign-in: add the Android app in Firebase with the **release** SHA-1, download `google-services.json` into `android/app/`.
5. Play Console declarations: foreground service (special use: emergency SOS trigger), "display over other apps", precise location, notifications.
