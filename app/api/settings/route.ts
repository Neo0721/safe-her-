import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

const HOLD_DURATIONS = [3, 5, 10]

interface SettingsRow {
  firebase_uid: string
  hold_duration: number
  location_sharing: number
  audio_recording: number
  notify_contacts: number
  updated_at: string
}

function toFlag(value: unknown): 0 | 1 | null {
  if (value === true || value === 1) return 1
  if (value === false || value === 0) return 0
  return null
}

function ensureSettings(uid: string): SettingsRow | null {
  if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) return null
  db.prepare(
    `INSERT OR IGNORE INTO sos_settings (firebase_uid, hold_duration, location_sharing, audio_recording, notify_contacts, updated_at)
     VALUES (?, 3, 1, 0, 1, ?)`
  ).run(uid, new Date().toISOString())
  return db.prepare('SELECT * FROM sos_settings WHERE firebase_uid = ?').get(uid) as SettingsRow
}

export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  try {
    const settings = ensureSettings(uid)
    if (!settings) return apiError(409, 'Create your profile first.', 'PROFILE_REQUIRED')
    return NextResponse.json(settings)
  } catch (error) {
    return serverError('settings GET', error)
  }
}

export async function PUT(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')

  try {
    const current = ensureSettings(uid)
    if (!current) return apiError(409, 'Create your profile first.', 'PROFILE_REQUIRED')

    // Partial updates are merged onto the stored values; anything invalid is rejected.
    const hold = body.hold_duration === undefined ? current.hold_duration : Number(body.hold_duration)
    if (!HOLD_DURATIONS.includes(hold)) return apiError(400, 'hold_duration must be 3, 5 or 10 seconds.')

    const merged: Record<string, 0 | 1> = {}
    for (const key of ['location_sharing', 'audio_recording', 'notify_contacts'] as const) {
      const flag = body[key] === undefined ? (current[key] as 0 | 1) : toFlag(body[key])
      if (flag === null) return apiError(400, `${key} must be a boolean.`)
      merged[key] = flag
    }

    const now = new Date().toISOString()
    db.prepare(
      `UPDATE sos_settings
       SET hold_duration = ?, location_sharing = ?, audio_recording = ?, notify_contacts = ?, updated_at = ?
       WHERE firebase_uid = ?`
    ).run(hold, merged.location_sharing, merged.audio_recording, merged.notify_contacts, now, uid)

    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
       VALUES (?, ?, 'settings', 'Settings Changed', 'SOS preferences updated', ?)`
    ).run(crypto.randomUUID(), uid, now)

    return NextResponse.json(db.prepare('SELECT * FROM sos_settings WHERE firebase_uid = ?').get(uid))
  } catch (error) {
    return serverError('settings PUT', error)
  }
}
