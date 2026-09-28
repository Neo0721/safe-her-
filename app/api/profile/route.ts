import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUser } from '@/backend/auth/verify-token'
import { apiError, optionalString, readJson, requiredString, serverError, validPhone } from '@/backend/http'

export const dynamic = 'force-dynamic'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French']

export async function GET(request: Request) {
  const { user, errorResponse } = await getVerifiedUser(request)
  if (errorResponse) return errorResponse

  try {
    const profile = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(user.uid)
    if (!profile) return apiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    return NextResponse.json(profile)
  } catch (error) {
    return serverError('profile GET', error)
  }
}

/**
 * Creates or updates the caller's profile. Identity (uid, email) comes from the
 * verified Firebase token; the client can only supply descriptive fields.
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await getVerifiedUser(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')

  const email = user.email
  if (!email) return apiError(400, 'Your Firebase account has no email address.')

  const fullName = requiredString(body.fullName, 100) ?? (user.name ? requiredString(user.name, 100) : null)
  if (!fullName) return apiError(400, 'Full name is required (max 100 characters).')

  const phone = optionalString(body.phone, 20)
  if (phone === undefined || (phone && !validPhone(phone))) return apiError(400, 'Phone number is invalid.')

  const bloodGroup = optionalString(body.bloodGroup, 3)
  if (bloodGroup === undefined || (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup))) {
    return apiError(400, 'Blood group is invalid.')
  }

  const language = optionalString(body.language, 20)
  if (language === undefined || (language && !LANGUAGES.includes(language))) {
    return apiError(400, 'Language is invalid.')
  }

  let photoUrl = optionalString(body.photoUrl, 500)
  if (photoUrl === undefined) return apiError(400, 'Photo URL is invalid.')
  if (photoUrl && !/^https:\/\//i.test(photoUrl)) photoUrl = null
  photoUrl = photoUrl ?? user.picture

  try {
    const conflict = db
      .prepare('SELECT firebase_uid FROM users WHERE email = ? AND firebase_uid != ?')
      .get(email, user.uid)
    if (conflict) return apiError(409, 'This email is already linked to a different profile.', 'EMAIL_CONFLICT')

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users (firebase_uid, full_name, email, phone, blood_group, language, photo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(firebase_uid) DO UPDATE SET
         full_name = excluded.full_name,
         email = excluded.email,
         phone = COALESCE(excluded.phone, users.phone),
         blood_group = COALESCE(excluded.blood_group, users.blood_group),
         language = COALESCE(excluded.language, users.language),
         photo_url = COALESCE(excluded.photo_url, users.photo_url),
         updated_at = excluded.updated_at`
    ).run(user.uid, fullName, email, phone, bloodGroup, language ?? 'English', photoUrl, now, now)

    db.prepare(
      `INSERT OR IGNORE INTO sos_settings (firebase_uid, hold_duration, location_sharing, audio_recording, notify_contacts, updated_at)
       VALUES (?, 3, 1, 0, 1, ?)`
    ).run(user.uid, now)

    const hasAuthLog = db
      .prepare("SELECT id FROM activity_logs WHERE firebase_uid = ? AND type = 'auth'")
      .get(user.uid)
    if (!hasAuthLog) {
      db.prepare(
        `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
         VALUES (?, ?, 'auth', 'Account Connected', 'Safety profile linked to your sign-in account', ?)`
      ).run(crypto.randomUUID(), user.uid, now)
    }

    return NextResponse.json(db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(user.uid))
  } catch (error) {
    return serverError('profile POST', error)
  }
}
