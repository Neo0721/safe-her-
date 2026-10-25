import crypto from 'crypto'
import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson, serverError } from '@/backend/http'
import { hashShareToken } from '@/backend/share-token'

export const dynamic = 'force-dynamic'

/**
 * Expiring share links for one evidence item the signed-in user owns.
 *
 *   POST   /api/media/share  { media_id, hours }   create a link (returns the token once)
 *   GET    /api/media/share?media_id=              list this item's active links (no tokens)
 *   DELETE /api/media/share?media_id=              revoke every link for the item
 */

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/
const MAX_HOURS = 24 * 7
const MAX_ACTIVE_PER_ITEM = 10

function owns(uid: string, mediaId: string) {
  return !!db.prepare('SELECT 1 FROM media_items WHERE id = ? AND firebase_uid = ?').get(mediaId, uid)
}

export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const body = await readJson(request)
  const mediaId = body?.media_id
  const hours = body?.hours
  if (typeof mediaId !== 'string' || !ID_PATTERN.test(mediaId)) return apiError(400, 'media_id is required.')
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 1 || hours > MAX_HOURS) {
    return apiError(400, `hours must be between 1 and ${MAX_HOURS}.`)
  }

  try {
    if (!owns(uid, mediaId)) return apiError(404, 'Media not found.')
    const now = new Date()
    const active = (
      db.prepare('SELECT COUNT(*) AS n FROM media_shares WHERE media_id = ? AND firebase_uid = ? AND expires_at > ?').get(mediaId, uid, now.toISOString()) as { n: number }
    ).n
    if (active >= MAX_ACTIVE_PER_ITEM) return apiError(409, 'Too many active links for this item. Stop sharing first.', 'SHARE_LIMIT')

    const token = crypto.randomBytes(32).toString('base64url')
    const expiresAt = new Date(now.getTime() + Math.round(hours * 3600_000)).toISOString()
    db.transaction(() => {
      db.prepare('DELETE FROM media_shares WHERE firebase_uid = ? AND expires_at <= ?').run(uid, now.toISOString())
      db.prepare('INSERT INTO media_shares (token_hash, media_id, firebase_uid, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        hashShareToken(token), mediaId, uid, now.toISOString(), expiresAt
      )
      db.prepare(`INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at) VALUES (?, ?, 'media', 'Evidence Link Created', ?, ?)`).run(
        crypto.randomUUID(), uid, 'Anyone with the link can view one item until it expires', now.toISOString()
      )
    })()
    return NextResponse.json({ token, path: `/shared/${token}`, expires_at: expiresAt }, { status: 201 })
  } catch (error) {
    return serverError('media share POST', error)
  }
}

export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse
  const mediaId = new URL(request.url).searchParams.get('media_id')
  if (!mediaId || !ID_PATTERN.test(mediaId)) return apiError(400, 'media_id is required.')
  try {
    if (!owns(uid, mediaId)) return apiError(404, 'Media not found.')
    const rows = db
      .prepare('SELECT created_at, expires_at FROM media_shares WHERE media_id = ? AND firebase_uid = ? AND expires_at > ? ORDER BY expires_at DESC')
      .all(mediaId, uid, new Date().toISOString())
    return NextResponse.json(rows)
  } catch (error) {
    return serverError('media share GET', error)
  }
}

export async function DELETE(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse
  const mediaId = new URL(request.url).searchParams.get('media_id')
  if (!mediaId || !ID_PATTERN.test(mediaId)) return apiError(400, 'media_id is required.')
  try {
    const result = db.prepare('DELETE FROM media_shares WHERE media_id = ? AND firebase_uid = ?').run(mediaId, uid)
    return NextResponse.json({ revoked: result.changes })
  } catch (error) {
    return serverError('media share DELETE', error)
  }
}
