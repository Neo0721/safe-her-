import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { auth, googleProvider } from '@/lib/firebase/client'
import { ApiError, apiJson } from '@/lib/api-fetch'
import { isNativeApp } from '@/lib/platform'

export interface Profile {
  id: number
  firebase_uid: string
  full_name: string
  email: string
  phone: string | null
  blood_group: string | null
  language: string | null
  photo_url: string | null
}

// While signup is writing the profile itself, the background sync must not race it.
let profileWriteInFlight = false
export const isProfileWriteInFlight = () => profileWriteInFlight

function requireAuth() {
  if (!auth) throw new ApiError(0, 'Sign-in is not configured. Add the Firebase settings to .env.local.', 'AUTH_NOT_CONFIGURED')
  return auth
}

/** Makes sure the signed-in Firebase user has a SQLite profile. Safe to call repeatedly. */
export async function ensureProfile(user: User, extra: { fullName?: string; phone?: string } = {}): Promise<Profile> {
  try {
    return await apiJson<Profile>('/api/profile')
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error
  }
  const fullName = extra.fullName || user.displayName || user.email?.split('@')[0] || 'SafeHer User'
  return apiJson<Profile>('/api/profile', {
    method: 'POST',
    json: { fullName, phone: extra.phone || undefined, photoUrl: user.photoURL || undefined },
  })
}

export async function signUpWithEmail(input: { name: string; email: string; phone: string; password: string }) {
  const a = requireAuth()
  profileWriteInFlight = true
  try {
    const { user } = await createUserWithEmailAndPassword(a, input.email, input.password)
    await updateProfile(user, { displayName: input.name })
    // Force-refresh so the ID token carries the display name.
    await user.getIdToken(true)
    await apiJson('/api/profile', { method: 'POST', json: { fullName: input.name, phone: input.phone } })
    return user
  } finally {
    profileWriteInFlight = false
  }
}

export async function signInWithEmail(email: string, password: string) {
  const a = requireAuth()
  const { user } = await signInWithEmailAndPassword(a, email, password)
  await ensureProfile(user)
  return user
}

/**
 * Google sign-in. Browsers use the Firebase popup. The Android app uses the native Google
 * account picker (Google blocks OAuth inside embedded WebViews) and hands the resulting
 * ID token to the Firebase web SDK so a single auth session exists.
 */
export async function signInWithGoogle() {
  const a = requireAuth()
  let user: User
  if (isNativeApp()) {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
    const idToken = result.credential?.idToken
    if (!idToken) throw new ApiError(0, 'Google did not return an ID token.', 'GOOGLE_NO_TOKEN')
    user = (await signInWithCredential(a, GoogleAuthProvider.credential(idToken))).user
  } else {
    if (!googleProvider) throw new ApiError(0, 'Google sign-in is not configured.', 'AUTH_NOT_CONFIGURED')
    user = (await signInWithPopup(a, googleProvider)).user
  }
  await ensureProfile(user)
  return user
}

export async function sendResetEmail(email: string) {
  await sendPasswordResetEmail(requireAuth(), email)
}

export async function logOut() {
  if (isNativeApp()) {
    try {
      await FirebaseAuthentication.signOut()
    } catch {
      /* no native session to clear */
    }
  }
  if (auth) await signOut(auth)
}

/** Maps Firebase and network errors to messages that are safe and helpful to show. */
export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string }
  switch (e?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
  }
  const message = e?.message ?? ''
  if (/cancel/i.test(message) || /cancel/i.test(String(e?.code ?? ''))) return 'Google sign-in was cancelled.'
  // Native (Capacitor) failures carry codes like UNIMPLEMENTED; these mean the Android build lacks Google config.
  if (typeof e?.code === 'string' && !e.code.startsWith('auth/') && /^[A-Z_]+$/.test(e.code)) {
    return 'Google sign-in is not set up for this app build yet. Use email and password, or ask the developer to add google-services.json.'
  }
  if (/unimplemented|default_web_client_id|developer_error|no credential|12500|10:/i.test(message)) {
    return 'Google sign-in is not set up for this app build yet. Use email and password, or ask the developer to add google-services.json.'
  }
  if (error instanceof ApiError) return error.message
  return 'Sign-in failed. Please try again.'
}
