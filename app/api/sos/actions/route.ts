import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

const KINDS = ['call_contact', 'sms_contact', 'call_emergency']

/**
 * Records that the phone's dialer or SMS composer was OPENED for a contact.
 * This is deliberately not "notified": the OS, not SafeHer, places the call or sends the SMS.
 */
export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  const { sos_event_id: eventId, contact_id: contactId, kind } = body
  if (typeof eventId !== 'string' || typeof kind !== 'string' || !KINDS.includes(kind)) {
    return apiError(400, 'sos_event_id and a valid kind are required.')
  }
  if (contactId !== undefined && contactId !== null && typeof contactId !== 'string') {
    return apiError(400, 'contact_id is invalid.')
  }

  try {
    const event = db.prepare('SELECT status FROM sos_events WHERE id = ? AND firebase_uid = ?').get(eventId, uid) as
      | { status: string }
      | undefined
    if (!event) return apiError(404, 'SOS event not found.')
    if (event.status !== 'Active') return apiError(409, 'SOS event has already ended.')

    let contactLabel = 'Emergency number'
    if (contactId) {
      const contact = db
        .prepare('SELECT name FROM emergency_contacts WHERE id = ? AND firebase_uid = ?')
        .get(contactId, uid) as { name: string } | undefined
      if (!contact) return apiError(404, 'Contact not found.')
      contactLabel = contact.name
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO sos_actions (id, firebase_uid, sos_event_id, contact_id, kind, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'opened', ?)`
    ).run(id, uid, eventId, contactId ?? null, kind, now)

    const verb = kind === 'sms_contact' ? 'SMS composer opened for' : 'Dialer opened for'
    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
       VALUES (?, ?, 'sos', ?, ?, ?)`
    ).run(crypto.randomUUID(), uid, kind === 'sms_contact' ? 'SMS Composer Opened' : 'Dialer Opened', `${verb} ${contactLabel}`, now)

    return NextResponse.json({ id, status: 'opened' }, { status: 201 })
  } catch (error) {
    return serverError('sos actions POST', error)
  }
}
