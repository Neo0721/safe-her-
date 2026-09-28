import { Geolocation } from '@capacitor/geolocation'

/**
 * Real device GPS. On Android this uses the native location plugin (works without a secure
 * context); in a browser it falls back to navigator.geolocation. No coordinates are ever invented.
 */
export type Fix = { lat: number; lng: number; accuracy: number; timestamp: number }
export type LocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported'
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

export class LocationError extends Error {
  constructor(
    public code: LocationErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'LocationError'
  }
}

export const LOCATION_ERROR_TEXT: Record<LocationErrorCode, string> = {
  denied: 'Location permission denied',
  unavailable: 'GPS signal unavailable',
  timeout: 'GPS timed out',
  unsupported: 'Location not supported on this device',
}

function toLocationError(error: unknown): LocationError {
  if (error instanceof LocationError) return error
  const e = error as { code?: number | string; message?: string }
  const message = String(e?.message ?? '').toLowerCase()
  if (e?.code === 1 || message.includes('denied') || message.includes('permission')) {
    return new LocationError('denied', LOCATION_ERROR_TEXT.denied)
  }
  if (e?.code === 3 || message.includes('timeout') || message.includes('timed out')) {
    return new LocationError('timeout', LOCATION_ERROR_TEXT.timeout)
  }
  if (message.includes('not supported') || message.includes('unsupported')) {
    return new LocationError('unsupported', LOCATION_ERROR_TEXT.unsupported)
  }
  return new LocationError('unavailable', LOCATION_ERROR_TEXT.unavailable)
}

export async function getLocationPermission(): Promise<PermissionState> {
  try {
    const status = await Geolocation.checkPermissions()
    const value = status.location
    return value === 'granted' || value === 'denied' ? value : 'prompt'
  } catch {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported'
  }
}

export async function requestLocationPermission(): Promise<PermissionState> {
  try {
    const status = await Geolocation.requestPermissions({ permissions: ['location'] })
    return status.location === 'granted' ? 'granted' : status.location === 'denied' ? 'denied' : 'prompt'
  } catch {
    // Browsers without the Permissions API: a position request triggers the prompt.
    try {
      await getCurrentFix({ timeoutMs: 15000 })
      return 'granted'
    } catch (error) {
      return toLocationError(error).code === 'denied' ? 'denied' : 'prompt'
    }
  }
}

export async function getCurrentFix(opts: { timeoutMs?: number } = {}): Promise<Fix> {
  try {
    const p = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: opts.timeoutMs ?? 10000,
      maximumAge: 0,
    })
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }
  } catch (error) {
    throw toLocationError(error)
  }
}

/** Streams real fixes. Returns a function that stops watching. */
export async function watchFixes(
  onFix: (fix: Fix) => void,
  onError: (error: LocationError) => void
): Promise<() => void> {
  let id: string | null = null
  let stopped = false
  try {
    id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }, (position, err) => {
      if (stopped) return
      if (err || !position) {
        onError(toLocationError(err))
        return
      }
      onFix({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      })
    })
  } catch (error) {
    onError(toLocationError(error))
  }
  return () => {
    stopped = true
    if (id !== null) void Geolocation.clearWatch({ id })
  }
}

/** Great-circle distance in metres. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
