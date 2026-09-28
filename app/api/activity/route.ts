import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, optionalString, readJson, requiredString, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

const TYPES = ['sos', 'contact', 'location', 'settings', 'auth']

export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const requested = Number(new URL(request.url).searchParams.get('limit') ?? 20)
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 20

  try {
    const logs = db
      .prepare('SELECT * FROM activity_logs WHERE firebase_uid = ? ORDER BY created_at DESC LIMIT ?')
      .all(uid, limit)
    return NextResponse.json(logs)
  } catch (error) {
    return serverError('activity GET', error)
  }
}

export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  if (!body) return apiError(400, 'Request body must be a JSON object.')

  const type = typeof body.type === 'string' ? body.type : ''
  const title = requiredString(body.title, 100)
  const detail = optionalString(body.detail, 300)
  if (!TYPES.includes(type) || !title || detail === undefined) {
    return apiError(400, 'A valid type and title are required.')
  }

  try {
    if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) {
      return apiError(409, 'Create your profile first.', 'PROFILE_REQUIRED')
    }
    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, uid, type, title, detail, new Date().toISOString())
    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error) {
    return serverError('activity POST', error)
  }
}
