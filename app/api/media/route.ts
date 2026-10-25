import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, serverError } from '@/backend/http'

export const dynamic = 'force-dynamic'

/**
 * Evidence media (photos and audio) that the signed-in user explicitly uploads.
 *
 *   POST   /api/media?kind=photo|audio|video[&sos_event_id=]   raw bytes, Content-Type = the media type
 *   GET    /api/media                                    list metadata for the caller
 *   GET    /api/media?id=                                download one item (caller's own only)
 *   DELETE /api/media?id=                                delete one item (caller's own only)
 *
 * The uid always comes from the verified Firebase token. Files are stored under data/media with a
 * server-generated name; client file names are never used.
 */

const MAX_BYTES = 8 * 1024 * 1024
const MAX_ITEMS_PER_USER = 200
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

type Kind = 'photo' | 'audio' | 'video'

const MIME: Record<Kind, Record<string, string>> = {
  photo: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  audio: { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' },
  video: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/quicktime': 'mov' },
}

function mediaDir() {
  const dir = process.env.SAFEHER_MEDIA_DIR
    ? path.resolve(process.env.SAFEHER_MEDIA_DIR)
    : path.join(process.cwd(), 'data', 'media')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Absolute path of a stored file. `fileName` is always a server-generated UUID plus a fixed
 * extension from the allow-list, never client input, so the dynamic path is safe; the annotation
 * stops the bundler from tracing the whole project because of it.
 */
function mediaFile(fileName: string) {
  return path.join(/* turbopackIgnore: true */ mediaDir(), fileName)
}

/** Cheap content sniffing so a mislabelled upload (e.g. HTML sent as image/png) is rejected. */
function looksLike(kind: Kind, mime: string, b: Buffer): boolean {
  if (b.length < 12) return false
  if (kind === 'photo') {
    if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8
    if (mime === 'image/png') return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    if (mime === 'image/webp') return b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP'
    return false
  }
  if (kind === 'video') {
    if (mime === 'video/webm') return b.readUInt32BE(0) === 0x1a45dfa3
    // MP4 / 3GP / QuickTime are all ISO base media files: a 'ftyp' (or legacy 'moov'/'mdat'/'wide') box comes first.
    const box = b.subarray(4, 8).toString('ascii')
    return box === 'ftyp' || box === 'moov' || box === 'mdat' || box === 'wide'
  }
  if (mime === 'audio/webm') return b.readUInt32BE(0) === 0x1a45dfa3
  if (mime === 'audio/ogg') return b.subarray(0, 4).toString('ascii') === 'OggS'
  if (mime === 'audio/mp4') return b.subarray(4, 8).toString('ascii') === 'ftyp'
  if (mime === 'audio/mpeg') return b.subarray(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  if (mime === 'audio/aac') return b[0] === 0xff && (b[1] & 0xf0) === 0xf0
  return false
}

interface MediaRow {
  id: string
  firebase_uid: string
  sos_event_id: string | null
  kind: Kind
  mime_type: string
  size_bytes: number
  file_name: string
  created_at: string
}

export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  if (kind !== 'photo' && kind !== 'audio' && kind !== 'video') return apiError(400, 'kind must be "photo", "audio" or "video".')

  const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const ext = MIME[kind][mime]
  if (!ext) return apiError(415, `Unsupported ${kind} type.`)

  const sosEventId = url.searchParams.get('sos_event_id')
  if (sosEventId !== null && !ID_PATTERN.test(sosEventId)) return apiError(400, 'Invalid sos_event_id.')

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return apiError(413, 'File is too large (8 MB maximum).')

  try {
    if (!db.prepare('SELECT 1 FROM users WHERE firebase_uid = ?').get(uid)) {
      return apiError(409, 'Create your profile before uploading media.', 'PROFILE_REQUIRED')
    }
    if (sosEventId && !db.prepare('SELECT 1 FROM sos_events WHERE id = ? AND firebase_uid = ?').get(sosEventId, uid)) {
      return apiError(404, 'SOS event not found.')
    }
    const count = (db.prepare('SELECT COUNT(*) AS n FROM media_items WHERE firebase_uid = ?').get(uid) as { n: number }).n
    if (count >= MAX_ITEMS_PER_USER) return apiError(409, 'Media limit reached. Delete some items first.', 'MEDIA_LIMIT')

    const bytes = Buffer.from(await request.arrayBuffer())
    if (bytes.length === 0) return apiError(400, 'Empty upload.')
    if (bytes.length > MAX_BYTES) return apiError(413, 'File is too large (8 MB maximum).')
    if (!looksLike(kind, mime, bytes)) return apiError(400, `The file is not a valid ${mime} ${kind}.`)

    const id = crypto.randomUUID()
    const fileName = `${id}.${ext}`
    const now = new Date().toISOString()
    fs.writeFileSync(mediaFile(fileName), bytes, { mode: 0o600 })
    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO media_items (id, firebase_uid, sos_event_id, kind, mime_type, size_bytes, file_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, uid, sosEventId, kind, mime, bytes.length, fileName, now)
        db.prepare(
          `INSERT INTO activity_logs (id, firebase_uid, type, title, detail, created_at)
           VALUES (?, ?, 'media', ?, ?, ?)`
        ).run(crypto.randomUUID(), uid, kind === 'photo' ? 'Photo Uploaded' : kind === 'video' ? 'Video Uploaded' : 'Audio Uploaded', 'Saved to your account at your request', now)
      })()
    } catch (error) {
      fs.rmSync(mediaFile(fileName), { force: true })
      throw error
    }

    return NextResponse.json(
      { id, sos_event_id: sosEventId, kind, mime_type: mime, size_bytes: bytes.length, created_at: now },
      { status: 201 }
    )
  } catch (error) {
    return serverError('media POST', error)
  }
}

export async function GET(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      const rows = db
        .prepare(
          `SELECT id, sos_event_id, kind, mime_type, size_bytes, created_at
           FROM media_items WHERE firebase_uid = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(uid, MAX_ITEMS_PER_USER)
      return NextResponse.json(rows)
    }

    if (!ID_PATTERN.test(id)) return apiError(400, 'Invalid media id.')
    const row = db.prepare('SELECT * FROM media_items WHERE id = ? AND firebase_uid = ?').get(id, uid) as MediaRow | undefined
    if (!row) return apiError(404, 'Media not found.')
    const file = mediaFile(row.file_name)
    if (!fs.existsSync(file)) return apiError(404, 'The stored file is missing.')
    return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
      headers: {
        'Content-Type': row.mime_type,
        'Content-Length': String(row.size_bytes),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    return serverError('media GET', error)
  }
}

export async function DELETE(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !ID_PATTERN.test(id)) return apiError(400, 'Media id is required.')

  try {
    const row = db.prepare('SELECT * FROM media_items WHERE id = ? AND firebase_uid = ?').get(id, uid) as MediaRow | undefined
    if (!row) return apiError(404, 'Media not found.')
    db.prepare('DELETE FROM media_items WHERE id = ? AND firebase_uid = ?').run(id, uid)
    fs.rmSync(mediaFile(row.file_name), { force: true })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError('media DELETE', error)
  }
}
