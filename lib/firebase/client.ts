import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { isNativeApp } from '@/lib/platform'

// Firebase is used for identity only. These are public web-app identifiers, not secrets.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_firebase_api_key') {
    const isFirstInit = getApps().length === 0
    app = isFirstInit ? initializeApp(firebaseConfig) : getApp()

    if (isFirstInit && typeof window !== 'undefined' && isNativeApp()) {
      // Popup/redirect resolvers do not work in a WebView; persist the session in IndexedDB instead.
      auth = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      })
    } else {
      auth = getAuth(app)
    }

    // Local development only: point at the Firebase Auth Emulator instead of the live project.
    const emulatorUrl = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL
    if (emulatorUrl && process.env.NODE_ENV !== 'production' && isFirstInit) {
      connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true })
    }

    googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({ prompt: 'select_account' })
  } else {
    console.warn('Firebase API key is missing. Sign-in is disabled until .env.local is configured.')
  }
} catch (error) {
  console.error('Firebase client initialization failed:', error)
}

export { app, auth, googleProvider }
