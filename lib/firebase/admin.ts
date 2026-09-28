if (typeof window !== 'undefined') {
  throw new Error('Firebase Admin SDK must not be imported on the client side.')
}

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY

// The Auth Emulator is a local development aid only. Never honour it in production,
// otherwise unsigned emulator tokens would be accepted as real identities.
if (process.env.NODE_ENV === 'production') {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST
}
const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)

let app: App | null = null
let adminAuth: Auth | null = null

try {
  const existing = getApps()
  if (existing.length > 0) {
    app = existing[0]
  } else if (usingEmulator && projectId) {
    app = initializeApp({ projectId })
  } else if (rawPrivateKey && clientEmail && projectId) {
    // Accept keys pasted with surrounding quotes and escaped newlines.
    const privateKey = rawPrivateKey
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  } else {
    console.warn(
      '[firebase-admin] Credentials are not configured; protected API routes will return 503.'
    )
  }
  if (app) adminAuth = getAuth(app)
} catch (error) {
  console.error('[firebase-admin] Initialization failed:', error)
}

export { adminAuth }
