import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'
import { parseContact } from '@/backend/contacts'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  try {
    const contacts = db
      .prepare(
        `SELECT * FROM emergency_contacts WHERE firebase_uid = ?
         ORDER BY CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, created_at`
      )
      .all(uid)
    return NextResponse.json(contacts)
  } catch (error) {
    return serverError('contacts GET', error)
  }
}

export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')
  const parsed = parseContact(body)
  if ('error' in parsed) return apiError(400, parsed.error)

  try {
    if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) {
      return apiError(409, 'Create your profile before adding contacts.', 'PROFILE_REQUIRED')
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM emergency_contacts WHERE firebase_uid = ?').get(uid) as { n: number }
    if (count.n >= 20) return apiError(400, 'You can save at most 20 emergency contacts.')

    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO emergency_contacts (id, firebase_uid, name, relationship, phone, email, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, uid, parsed.name, parsed.relationship, parsed.phone, parsed.email, parsed.priority, now, now)

    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
       VALUES (?, ?, 'contact', 'Contact Added', ?, ?)`
    ).run(crypto.randomUUID(), uid, `${parsed.name} (${parsed.relationship}) added to safety network`, now)

    return NextResponse.json(db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(id), { status: 201 })
  } catch (error) {
    return serverError('contacts POST', error)
  }
}
