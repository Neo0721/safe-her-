import fs from 'fs';
import path from 'path';
import type { CapacitorConfig } from '@capacitor/cli';
import { loadEnvConfig } from '@next/env';

// Load variables from .env.local (same source the Next.js app uses).
loadEnvConfig(process.cwd());

/**
 * SafeHer is a dynamic Next.js app (API routes, SQLite, Firebase Admin), so it cannot be exported
 * as static files. The Android WebView loads the running Next.js server directly:
 *   - development: your computer on the LAN (or 10.0.2.2 for the Android emulator)
 *   - production:  your deployed HTTPS server
 * Set the address in .env.local as NEXT_PUBLIC_API_BASE_URL (or CAP_SERVER_URL to override it).
 */
const rawUrl = (process.env.CAP_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();

let serverUrl: string | undefined;
if (rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('must start with http:// or https://');
    serverUrl = parsed.origin;
  } catch (error) {
    throw new Error(`Invalid NEXT_PUBLIC_API_BASE_URL / CAP_SERVER_URL "${rawUrl}": ${(error as Error).message}`);
  }
} else {
  console.warn(
    '[capacitor] NEXT_PUBLIC_API_BASE_URL is not set. The app will show a configuration screen instead of SafeHer.'
  );
}

// The offline/error page (which cannot read plugins or env) needs to know where to retry.
try {
  fs.writeFileSync(
    path.join(process.cwd(), 'capacitor-www', 'server-url.js'),
    `window.SAFEHER_SERVER_URL = ${JSON.stringify(serverUrl ?? '')};\n`
  );
} catch {
  /* capacitor-www is optional at config-load time */
}

const config: CapacitorConfig = {
  appId: 'com.safeher.app',
  appName: 'SafeHer',
  // Minimal local shell (configuration + connection-error pages). Not the app itself.
  webDir: 'capacitor-www',
  server: serverUrl
    ? {
        url: serverUrl,
        // Plain HTTP is only for local development servers; HTTPS deployments stay strict.
        cleartext: serverUrl.startsWith('http://'),
        errorPath: 'error.html',
      }
    : undefined,
  plugins: {
    SystemBars: { insetsHandling: 'css' },
    FirebaseAuthentication: {
      // The Firebase web SDK owns the session; the native plugin only performs the Google account pick.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
