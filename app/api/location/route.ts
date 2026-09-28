import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, optionalAccuracy, readJson, serverError, validLatLng } from '@/backend/http'

export const dynamic = 'force-dynamic'

/**
 * Stores one real GPS fix, attached to exactly one of the caller's SOS events or trips.
 * Ownership of the parent is verified, so a client cannot write points into someone else's records.
 */
export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')

  const sosId = typeof body.sos_event_id === 'string' ? body.sos_event_id : null
  const tripId = typeof body.trip_id === 'string' ? body.trip_id : null
  if ((sosId === null) === (tripId === null)) {
    return apiError(400, 'Provide exactly one of sos_event_id or trip_id.')
  }
  if (!validLatLng(body.latitude, body.longitude)) return apiError(400, 'Valid latitude and longitude are required.')
  const accuracy = optionalAccuracy(body.accuracy)
  if (accuracy === undefined) return apiError(400, 'Invalid accuracy.')
  const { latitude, longitude } = body as { latitude: number; longitude: number }

  // Points buffered while offline arrive late; accept the device's fix time if it is plausible.
  let recordedAt = new Date().toISOString()
  if (body.recorded_at !== undefined) {
    const t = typeof body.recorded_at === 'string' ? Date.parse(body.recorded_at) : NaN
    const now = Date.now()
    if (!Number.isFinite(t) || t > now + 60_000 || t < now - 24 * 3600_000) {
      return apiError(400, 'recorded_at must be within the last 24 hours.')
    }
    recordedAt = new Date(t).toISOString()
  }

  try {
    if (sosId) {
      const event = db
        .prepare('SELECT status, latitude FROM sos_events WHERE id = ? AND firebase_uid = ?')
        .get(sosId, uid) as { status: string; latitude: number | null } | undefined
      if (!event) return apiError(404, 'SOS event not found.')
      if (event.status !== 'Active') return apiError(409, 'SOS event has already ended.')
      // First fix becomes the event's headline location.
      if (event.latitude === null) {
        db.prepare('UPDATE sos_events SET latitude = ?, longitude = ?, accuracy = ? WHERE id = ? AND firebase_uid = ?').run(
          latitude,
          longitude,
          accuracy,
          sosId,
          uid
        )
      }
    } else {
      const trip = db.prepare('SELECT status FROM trips WHERE id = ? AND firebase_uid = ?').get(tripId, uid) as
        | { status: string }
        | undefined
      if (!trip) return apiError(404, 'Trip not found.')
      if (trip.status !== 'Active') return apiError(409, 'Trip has already ended.')
    }

    db.prepare(
      `INSERT INTO location_points (firebase_uid, sos_event_id, trip_id, latitude, longitude, accuracy, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uid, sosId, tripId, latitude, longitude, accuracy, recordedAt)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return serverError('location POST', error)
  }
}

/** Returns the caller's stored points for one SOS event or trip, oldest first. */
export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const params = new URL(request.url).searchParams
  const sosId = params.get('sos_event_id')
  const tripId = params.get('trip_id')
  if ((sosId === null) === (tripId === null)) {
    return apiError(400, 'Provide exactly one of sos_event_id or trip_id.')
  }

  try {
    const points = sosId
      ? db
          .prepare(
            `SELECT latitude, longitude, accuracy, recorded_at FROM location_points
             WHERE firebase_uid = ? AND sos_event_id = ? ORDER BY recorded_at, id LIMIT 5000`
          )
          .all(uid, sosId)
      : db
          .prepare(
            `SELECT latitude, longitude, accuracy, recorded_at FROM location_points
             WHERE firebase_uid = ? AND trip_id = ? ORDER BY recorded_at, id LIMIT 5000`
          )
          .all(uid, tripId)
    return NextResponse.json(points)
  } catch (error) {
    return serverError('location GET', error)
  }
}
