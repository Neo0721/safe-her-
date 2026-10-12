import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

/** SOS and drill history for the caller, with counts of recorded location points and opened call/SMS composers. */
export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const params = new URL(request.url).searchParams
  const requested = Number(params.get('limit') ?? 50)
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 200) : 50
  // Cursor pagination: pass the oldest `started_at` already shown as `before` to get the next page.
  const before = params.get('before')
  if (before !== null && Number.isNaN(Date.parse(before))) return apiError(400, 'before must be an ISO timestamp.')

  try {
    const events = db
      .prepare(
        `SELECT e.*,
           (SELECT COUNT(*) FROM location_points p WHERE p.sos_event_id = e.id AND p.firebase_uid = e.firebase_uid) AS points_count,
           (SELECT COUNT(*) FROM sos_actions a WHERE a.sos_event_id = e.id AND a.firebase_uid = e.firebase_uid) AS actions_count
         FROM sos_events e
         WHERE e.firebase_uid = ? AND (? IS NULL OR e.started_at < ?)
         ORDER BY e.started_at DESC
         LIMIT ?`
      )
      .all(uid, before, before, limit)
    return NextResponse.json(events)
  } catch (error) {
    return serverError('history GET', error)
  }
}
