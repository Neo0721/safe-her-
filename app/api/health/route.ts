import { NextResponse } from 'next/server'
import db from '@/backend/db/database'
import { adminAuth } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness probe for load balancers and uptime monitors. Public by design and returns
 * no user data: only whether the database answers and whether sign-in verification is configured.
 */
export async function GET() {
  let database: 'ok' | 'error' = 'ok'
  try {
    db.prepare('SELECT 1').get()
  } catch {
    database = 'error'
  }
  const auth = adminAuth ? 'configured' : 'missing'
  const healthy = database === 'ok' && auth === 'configured'

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', database, auth, uptimeSeconds: Math.round(process.uptime()) },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
