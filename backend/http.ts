import { NextResponse } from 'next/server'

export function apiError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })
}

export function serverError(context: string, error: unknown) {
  console.error(`[api] ${context}:`, error)
  return apiError(500, 'Internal server error')
}

/** Parses a JSON object body. Returns null for malformed or non-object payloads. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : undefined
}

export function requiredString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

export function validLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function optionalAccuracy(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e7
    ? value
    : undefined
}

/** Phone numbers: digits with an optional leading +, spaces, dashes, dots and parentheses. */
export function validPhone(value: string): boolean {
  return /^[+]?[\d\s\-().]{3,20}$/.test(value) && /\d{3,}/.test(value.replace(/\D/g, ''))
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
