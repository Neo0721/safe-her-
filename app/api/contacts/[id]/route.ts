import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'
import { parseContact } from '@/backend/contacts'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Ctx) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse
  const { id } = await params

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  const parsed = parseContact(body)
  if ('error' in parsed) return apiError(400, parsed.error)

  try {
    const now = new Date().toISOString()
    // Scoped by firebase_uid: another user's contact id simply matches nothing (404).
    const info = db
      .prepare(
        `UPDATE emergency_contacts
         SET name = ?, relationship = ?, phone = ?, email = ?, priority = ?, updated_at = ?
         WHERE id = ? AND firebase_uid = ?`
      )
      .run(parsed.name, parsed.relationship, parsed.phone, parsed.email, parsed.priority, now, id, uid)
    if (info.changes === 0) return apiError(404, 'Contact not found.')

    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
       VALUES (?, ?, 'contact', 'Contact Updated', ?, ?)`
    ).run(crypto.randomUUID(), uid, `${parsed.name} (${parsed.relationship}) details updated`, now)

    return NextResponse.json(db.prepare('SELECT * FROM emergency_contacts WHERE id = ? AND firebase_uid = ?').get(id, uid))
  } catch (error) {
    return serverError('contacts PUT', error)
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse
  const { id } = await params

  try {
    const contact = db
      .prepare('SELECT name, relationship FROM emergency_contacts WHERE id = ? AND firebase_uid = ?')
      .get(id, uid) as { name: string; relationship: string } | undefined
    if (!contact) return apiError(404, 'Contact not found.')

    db.prepare('DELETE FROM emergency_contacts WHERE id = ? AND firebase_uid = ?').run(id, uid)
    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
       VALUES (?, ?, 'contact', 'Contact Deleted', ?, ?)`
    ).run(crypto.randomUUID(), uid, `${contact.name} (${contact.relationship}) removed from safety network`, new Date().toISOString())

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError('contacts DELETE', error)
  }
}
