import { NextResponse, type NextRequest } from 'next/server'

/**
 * API edge layer: optional CORS plus a per-client rate limit.
 *
 * The limiter is in-memory, so it protects a single server instance (SafeHer's SQLite design is
 * single-instance anyway). Behind several instances, move it to the reverse proxy or a shared store.
 */

// By default the app is same-origin (the Android WebView loads this server directly), so no
// origins are allowed. Set CORS_ALLOWED_ORIGINS only if a client is served from elsewhere.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const LIMIT = Math.max(Number(process.env.RATE_LIMIT_PER_MINUTE) || 600, 30)
const WINDOW_MS = 60_000

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let lastSweep = 0

function clientKey(request: NextRequest): string {
  // Trust the first hop of X-Forwarded-For only when a reverse proxy sets it.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'local'
}

function consume(key: string, now: number): { allowed: boolean; retryAfter: number } {
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }
  bucket.count += 1
  return bucket.count > LIMIT
    ? { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
    : { allowed: true, retryAfter: 0 }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowed = origin !== null && allowedOrigins.includes(origin)

  // CORS preflights and the health probe never count against the limit.
  const exempt = request.method === 'OPTIONS' || request.nextUrl.pathname === '/api/health'
  const verdict = exempt ? { allowed: true, retryAfter: 0 } : consume(clientKey(request), Date.now())

  let response: NextResponse
  if (request.method === 'OPTIONS' && allowed) {
    response = new NextResponse(null, { status: 204 })
  } else if (!verdict.allowed) {
    response = NextResponse.json(
      { error: 'Too many requests. Please slow down and try again shortly.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.max(verdict.retryAfter, 1)) } },
    )
  } else {
    response = NextResponse.next()
  }

  if (allowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.headers.set('Access-Control-Max-Age', '600')
    response.headers.set('Vary', 'Origin')
  }
  return response
}

export const config = { matcher: '/api/:path*' }
