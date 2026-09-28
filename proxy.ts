import { NextResponse, type NextRequest } from 'next/server'

// Optional CORS support for the API. By default the app is same-origin (the Android WebView
// loads the Next.js server directly), so no origins are allowed. Set CORS_ALLOWED_ORIGINS to a
// comma-separated list only if a client is served from a different origin.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowed = origin !== null && allowedOrigins.includes(origin)

  const response =
    request.method === 'OPTIONS' && allowed
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next()

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
