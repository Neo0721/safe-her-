import { auth } from '@/lib/firebase/client'
import { isNativeApp } from '@/lib/platform'

const REQUEST_TIMEOUT_MS = 15000

/** Fired after the app changes the user's profile or contacts, so the on-phone copy can be refreshed. */
export const DATA_CHANGED_EVENT = 'safeher:data-changed'

/** An API failure with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get isNetwork() {
    return this.status === 0
  }
}

/**
 * The app normally talks to the same origin that served it (the Android WebView loads the Next.js
 * server directly, so relative URLs are correct and survive IP changes). An absolute base URL is
 * used only when the page itself came from the bundled Capacitor origin (localhost/capacitor://).
 */
function resolveUrl(path: string): string {
  if (!path.startsWith('/') || typeof window === 'undefined') return path
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')
  const { protocol, hostname } = window.location
  const bundled = isNativeApp() && (protocol === 'capacitor:' || hostname === 'localhost')
  return bundled && base ? `${base}${path}` : path
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!auth) throw new ApiError(401, 'Sign-in is not configured for this build.', 'AUTH_NOT_CONFIGURED')
  await auth.authStateReady() // wait for session restoration before reading currentUser
  if (!auth.currentUser) throw new ApiError(401, 'You are not signed in.', 'NOT_SIGNED_IN')
  return auth.currentUser.getIdToken(forceRefresh)
}

async function send(path: string, options: RequestInit, token: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(resolveUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    const timedOut = (error as { name?: string }).name === 'AbortError'
    throw new ApiError(
      0,
      timedOut
        ? 'The server took too long to respond. Check your connection and try again.'
        : 'Cannot reach the SafeHer server. Check your internet connection.',
      'NETWORK'
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Authenticated fetch. Retries once with a refreshed token on 401. Rejects with ApiError on network failure. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let response = await send(path, options, await getToken())
  if (response.status === 401) {
    response = await send(path, options, await getToken(true))
  }
  return response
}

/** Authenticated JSON call. Throws ApiError with the server's message for non-2xx responses. */
export async function apiJson<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...init } = options
  const response = await apiFetch(path, json === undefined ? init : { ...init, body: JSON.stringify(json) })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; code?: string }
    throw new ApiError(response.status, body.error || `Request failed (${response.status}).`, body.code)
  }
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && /^\/api\/(contacts|profile)(\/|\?|$)/.test(path) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }
  return data as T
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}
