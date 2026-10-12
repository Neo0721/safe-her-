import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, optionalAccuracy, readJson, serverError, validLatLng } from '@/backend/http'

export const dynamic = 'force-dynamic'

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/
const END_STATUSES = ['Completed', 'Cancelled', 'Failed']

function log(uid: string, title: string, detail: string) {
  db.prepare(
    `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at) VALUES (?, ?, 'sos', ?, ?, ?)`
  ).run(crypto.randomUUID(), uid, title, detail, new Date().toISOString())
}

/** `GET /api/sos` lists the caller's events; `GET /api/sos?id=` returns one (used to resume an active SOS). */
export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (id) {
      const event = db.prepare('SELECT * FROM sos_events WHERE id = ? AND firebase_uid = ?').get(id, uid)
      return event ? NextResponse.json(event) : apiError(404, 'SOS event not found.')
    }
    return NextResponse.json(
      db.prepare('SELECT * FROM sos_events WHERE firebase_uid = ? ORDER BY started_at DESC LIMIT 200').all(uid)
    )
  } catch (error) {
    return serverError('sos GET', error)
  }
}

/**
 * Starts an SOS (or a drill when `is_test` is true). The event is created immediately as
 * "Active"; GPS fixes are attached afterwards through /api/location, so the record exists
 * even if no GPS fix is ever obtained. Creation is idempotent per client-supplied id.
 */
export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')

  const id = body.id === undefined ? crypto.randomUUID() : body.id
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return apiError(400, 'Invalid SOS event id.')
  const isTest = body.is_test === true
  const source = body.source === undefined ? 'hold' : body.source
  if (source !== 'hold' && source !== 'power') return apiError(400, 'source must be "hold" or "power".')

  const hasFix = body.latitude !== undefined && body.latitude !== null
  if (hasFix && !validLatLng(body.latitude, body.longitude)) return apiError(400, 'Invalid coordinates.')
  const accuracy = optionalAccuracy(body.accuracy)
  if (accuracy === undefined) return apiError(400, 'Invalid accuracy.')

  try {
    if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) {
      return apiError(409, 'Create your profile before starting an SOS.', 'PROFILE_REQUIRED')
    }

    const existing = db.prepare('SELECT * FROM sos_events WHERE id = ?').get(id) as { firebase_uid: string } | undefined
    if (existing) {
      // Idempotent for the owner; opaque conflict for anyone else.
      return existing.firebase_uid === uid ? NextResponse.json(existing) : apiError(409, 'SOS event id already in use.')
    }

    const now = new Date().toISOString()
    db.transaction(() => {
      db.prepare(
        `INSERT INTO sos_events (id, firebase_uid, started_at, latitude, longitude, accuracy, status, contacts_notified, is_test, trigger_source)
         VALUES (?, ?, ?, ?, ?, ?, 'Active', 0, ?, ?)`
      ).run(id, uid, now, hasFix ? body.latitude : null, hasFix ? body.longitude : null, hasFix ? accuracy : null, isTest ? 1 : 0, source)

      if (hasFix) {
        db.prepare(
          `INSERT INTO location_points (firebase_uid, sos_event_id, latitude, longitude, accuracy, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(uid, id, body.latitude, body.longitude, accuracy, now)
      }
      log(uid, isTest ? 'SOS Drill Started' : 'SOS Started', isTest ? 'Practice drill. No contacts were contacted.' : source === 'power' ? 'SOS activated with the power-button trigger' : 'SOS activated by user')
    })()

    return NextResponse.json(db.prepare('SELECT * FROM sos_events WHERE id = ?').get(id), { status: 201 })
  } catch (error) {
    return serverError('sos POST', error)
  }
}

/** Ends an SOS: `Completed` (user is safe), `Cancelled` (false alarm) or `Failed`. Only an Active event can end. */
export async function PUT(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  const { id, status } = body
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return apiError(400, 'SOS event id is required.')
  if (typeof status !== 'string' || !END_STATUSES.includes(status)) {
    return apiError(400, 'Status must be Completed, Cancelled or Failed.')
  }

  try {
    const event = db.prepare('SELECT * FROM sos_events WHERE id = ? AND firebase_uid = ?').get(id, uid) as
      | { status: string; is_test: number }
      | undefined
    if (!event) return apiError(404, 'SOS event not found.')
    if (event.status !== 'Active') return NextResponse.json(event) // already ended: idempotent

    db.prepare('UPDATE sos_events SET ended_at = ?, status = ? WHERE id = ? AND firebase_uid = ?').run(
      new Date().toISOString(),
      status,
      id,
      uid
    )
    const label = event.is_test ? 'Drill' : 'SOS'
    log(uid, `${label} ${status === 'Completed' ? 'Ended' : status}`, `${label} marked as ${status.toLowerCase()} by user`)

    return NextResponse.json(db.prepare('SELECT * FROM sos_events WHERE id = ? AND firebase_uid = ?').get(id, uid))
  } catch (error) {
    return serverError('sos PUT', error)
  }
}
