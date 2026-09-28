import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

function log(uid: string, title: string, detail: string) {
  db.prepare(
    `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at) VALUES (?, ?, 'location', ?, ?, ?)`
  ).run(crypto.randomUUID(), uid, title, detail, new Date().toISOString())
}

/** Starts a live-location trip session. */
export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  const id = body.id === undefined ? crypto.randomUUID() : body.id
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return apiError(400, 'Invalid trip id.')

  try {
    if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) {
      return apiError(409, 'Create your profile first.', 'PROFILE_REQUIRED')
    }
    const existing = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as { firebase_uid: string } | undefined
    if (existing) {
      return existing.firebase_uid === uid ? NextResponse.json(existing) : apiError(409, 'Trip id already in use.')
    }
    // A killed app can leave a session "Active" forever; close this user's sessions idle for 10+ minutes.
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString()
    db.prepare(
      `UPDATE trips
       SET status = 'Ended',
           ended_at = COALESCE((SELECT MAX(recorded_at) FROM location_points p WHERE p.trip_id = trips.id), started_at)
       WHERE firebase_uid = ? AND status = 'Active'
         AND COALESCE((SELECT MAX(recorded_at) FROM location_points p WHERE p.trip_id = trips.id), started_at) < ?`
    ).run(uid, cutoff)

    db.prepare(`INSERT INTO trips (id, firebase_uid, started_at, status) VALUES (?, ?, ?, 'Active')`).run(
      id,
      uid,
      new Date().toISOString()
    )
    log(uid, 'Live Tracking Started', 'Location tracking session started on this device')
    return NextResponse.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(id), { status: 201 })
  } catch (error) {
    return serverError('trips POST', error)
  }
}

/** Ends a trip session. */
export async function PUT(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  if (typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) return apiError(400, 'Trip id is required.')

  try {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND firebase_uid = ?').get(body.id, uid) as
      | { status: string }
      | undefined
    if (!trip) return apiError(404, 'Trip not found.')
    if (trip.status === 'Active') {
      db.prepare(`UPDATE trips SET status = 'Ended', ended_at = ? WHERE id = ? AND firebase_uid = ?`).run(
        new Date().toISOString(),
        body.id,
        uid
      )
      log(uid, 'Live Tracking Stopped', 'Location tracking session ended')
    }
    return NextResponse.json(db.prepare('SELECT * FROM trips WHERE id = ? AND firebase_uid = ?').get(body.id, uid))
  } catch (error) {
    return serverError('trips PUT', error)
  }
}
