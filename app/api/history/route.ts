import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

/** SOS and drill history for the caller, with counts of recorded location points and opened call/SMS composers. */
export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  try {
    const events = db
      .prepare(
        `SELECT e.*,
           (SELECT COUNT(*) FROM location_points p WHERE p.sos_event_id = e.id AND p.firebase_uid = e.firebase_uid) AS points_count,
           (SELECT COUNT(*) FROM sos_actions a WHERE a.sos_event_id = e.id AND a.firebase_uid = e.firebase_uid) AS actions_count
         FROM sos_events e
         WHERE e.firebase_uid = ?
         ORDER BY e.started_at DESC
         LIMIT 200`
      )
      .all(uid)
    return NextResponse.json(events)
  } catch (error) {
    return serverError('history GET', error)
  }
}
