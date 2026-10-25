import fs from 'fs'
import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { apiError, serverError } from '@/backend/http'
import { mediaFile } from '@/backend/media-files'
import { hashShareToken, SHARE_TOKEN_PATTERN } from '@/backend/share-token'

export const dynamic = 'force-dynamic'

/**
 * PUBLIC (no sign-in): serves exactly one evidence item to whoever holds a valid, unexpired
 * share link the owner created. The unguessable 256-bit token is the credential; only its hash is
 * stored. Expired, revoked, deleted and unknown tokens all answer the same 404.
 *
 *   GET /api/shared/<token>           the file
 *   GET /api/shared/<token>?meta=1    { kind, mime_type, size_bytes, created_at, expires_at }
 */

interface Row {
  kind: string
  mime_type: string
  size_bytes: number
  file_name: string
  created_at: string
  expires_at: string
}

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!SHARE_TOKEN_PATTERN.test(token)) return apiError(404, 'This link is invalid or has expired.')
  try {
    const row = db
      .prepare(
        `SELECT m.kind, m.mime_type, m.size_bytes, m.file_name, m.created_at, s.expires_at
         FROM media_shares s JOIN media_items m ON m.id = s.media_id
         WHERE s.token_hash = ? AND s.expires_at > ?`
      )
      .get(hashShareToken(token), new Date().toISOString()) as Row | undefined
    if (!row) return apiError(404, 'This link is invalid or has expired.')

    if (new URL(request.url).searchParams.get('meta') === '1') {
      return NextResponse.json({ kind: row.kind, mime_type: row.mime_type, size_bytes: row.size_bytes, created_at: row.created_at, expires_at: row.expires_at })
    }
    const file = mediaFile(row.file_name)
    if (!fs.existsSync(file)) return apiError(404, 'This link is invalid or has expired.')
    return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
      headers: {
        'Content-Type': row.mime_type,
        'Content-Length': String(row.size_bytes),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (error) {
    return serverError('shared GET', error)
  }
}
