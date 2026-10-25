# SafeHer server: Next.js app + API routes + SQLite (single instance).
#   docker build -t safeher \
#     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... (see docs/DEPLOYMENT.md for the full list) .
#   docker run -p 3000:3000 -v safeher-data:/app/data --env-file .env.production safeher

FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 compiles a native module when no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they are build args.
ARG NEXT_PUBLIC_APP_NAME=SafeHer
ARG NEXT_PUBLIC_EMERGENCY_NUMBER=112
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL_MS=5000
ARG NEXT_PUBLIC_LOCATION_MIN_DISTANCE_METERS=5
ARG NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS=10
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_EMERGENCY_NUMBER=$NEXT_PUBLIC_EMERGENCY_NUMBER \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL_MS=$NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL_MS \
    NEXT_PUBLIC_LOCATION_MIN_DISTANCE_METERS=$NEXT_PUBLIC_LOCATION_MIN_DISTANCE_METERS \
    NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS=$NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app ./
# The SQLite database lives here: mount a persistent volume on /app/data.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
USER node
EXPOSE 3000
# Hosts such as Render set PORT (e.g. 10000) and expect the app to listen on it; default to 3000 otherwise.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "exec npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
