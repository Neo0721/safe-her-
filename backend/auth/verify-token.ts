import { adminAuth } from '@/lib/firebase/admin'
import { apiError } from '@/backend/http'

export interface VerifiedUser {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

type VerifyResult =
  | { user: VerifiedUser; errorResponse?: undefined }
  | { user: null; errorResponse: Response }

/**
 * Verifies the Firebase ID token in the `Authorization: Bearer` header.
 * The UID always comes from the verified token, never from the request body or query.
 */
export async function getVerifiedUser(request: Request): Promise<VerifyResult> {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return { user: null, errorResponse: apiError(401, 'Missing or invalid Authorization header.') }
  }

  const token = header.slice(7).trim()
  if (!token) {
    return { user: null, errorResponse: apiError(401, 'Missing ID token.') }
  }

  if (!adminAuth) {
    return {
      user: null,
      errorResponse: apiError(
        503,
        'Authentication is not configured on the server.',
        'ADMIN_CREDENTIALS_MISSING'
      ),
    }
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return {
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: (decoded.name as string | undefined) ?? null,
        picture: decoded.picture ?? null,
      },
    }
  } catch (error) {
    // Do not echo verifier internals to the client.
    console.warn('[auth] ID token rejected:', (error as { code?: string }).code ?? 'unknown')
    return { user: null, errorResponse: apiError(401, 'Invalid or expired session. Please sign in again.', 'INVALID_TOKEN') }
  }
}

/** Convenience wrapper for routes that only need the UID. */
export async function getVerifiedUid(
  request: Request
): Promise<{ uid: string; errorResponse?: undefined } | { uid: null; errorResponse: Response }> {
  const result = await getVerifiedUser(request)
  if (result.errorResponse) return { uid: null, errorResponse: result.errorResponse }
  return { uid: result.user.uid }
}
