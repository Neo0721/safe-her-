/**
 * Routing, geocoding and nearby-places lookups for the Navigate screen.
 *
 * All three use free, key-less OpenStreetMap-ecosystem services, so no API key is bundled in the
 * app. They are public community servers: fair-use only, and every call can fail offline, so
 * callers must show the error rather than invent a route.
 *   - Route:    routing.openstreetmap.de (OSRM, walking profile)
 *   - Search:   Nominatim
 *   - Nearby:   Overpass API (police stations, hospitals, pharmacies)
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  name: string
  detail?: string
  /** Straight-line distance from the origin in metres, when an origin was supplied. */
  distance?: number
}

export interface RouteStep {
  instruction: string
  distance: number
}

export interface RouteResult {
  path: LatLng[]
  distance: number
  duration: number
  steps: RouteStep[]
}

export class PlacesError extends Error {
  constructor(
    message: string,
    public network = false
  ) {
    super(message)
    this.name = 'PlacesError'
  }
}

const TIMEOUT_MS = 15000

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new PlacesError(`The map service answered with an error (${res.status}).`)
    return (await res.json()) as T
  } catch (error) {
    if (error instanceof PlacesError) throw error
    const timedOut = (error as { name?: string }).name === 'AbortError'
    throw new PlacesError(
      timedOut ? 'The map service took too long to respond.' : 'Could not reach the map service. Check your internet connection.',
      true
    )
  } finally {
    clearTimeout(timer)
  }
}

export function distanceBetween(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// ---------------------------------------------------------------------------- routing

interface OsrmStep {
  distance: number
  name?: string
  maneuver: { type: string; modifier?: string }
}
interface OsrmResponse {
  code: string
  message?: string
  routes?: {
    distance: number
    duration: number
    geometry: { coordinates: [number, number][] }
    legs: { steps: OsrmStep[] }[]
  }[]
}

function describeStep(step: OsrmStep): string {
  const { type, modifier } = step.maneuver
  const road = step.name ? ` onto ${step.name}` : ''
  switch (type) {
    case 'depart':
      return `Start walking${step.name ? ` on ${step.name}` : ''}`
    case 'arrive':
      return 'You have arrived at your destination'
    case 'turn':
    case 'end of road':
    case 'fork':
    case 'on ramp':
    case 'off ramp':
      return `Turn ${modifier ?? 'ahead'}${road}`
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${road}`
    default:
      return `Continue${modifier ? ` ${modifier}` : ''}${road}`
  }
}

export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const data = await getJson<OsrmResponse>(
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`
  )
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) {
    throw new PlacesError(data.code === 'NoRoute' ? 'No walking route was found to that destination.' : data.message || 'No route found.')
  }
  return {
    path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: route.distance,
    duration: route.duration,
    steps: route.legs.flatMap((leg) => leg.steps).map((s) => ({ instruction: describeStep(s), distance: s.distance })),
  }
}

// ---------------------------------------------------------------------------- search

interface NominatimItem {
  lat: string
  lon: string
  display_name: string
  name?: string
}

export async function searchPlaces(query: string, near?: LatLng): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) throw new PlacesError('Type at least 3 characters to search.')
  const bias = near ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}` : ''
  const items = await getJson<NominatimItem[]>(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}${bias}`,
    { headers: { Accept: 'application/json' } }
  )
  return items.map((i) => {
    const place: Place = {
      lat: Number(i.lat),
      lng: Number(i.lon),
      name: i.name || i.display_name.split(',')[0],
      detail: i.display_name,
    }
    if (near) place.distance = distanceBetween(near, place)
    return place
  })
}

// ---------------------------------------------------------------------------- nearby

/** Overridable with NEXT_PUBLIC_OVERPASS_URL (comma-separated) to point at your own Overpass instance. */
const OVERPASS_ENDPOINTS = (
  process.env.NEXT_PUBLIC_OVERPASS_URL ||
  'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter'
)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean)

export type NearbyKind = 'police' | 'hospital' | 'pharmacy'

const OVERPASS_FILTER: Record<NearbyKind, string> = {
  police: '["amenity"="police"]',
  hospital: '["amenity"~"hospital|clinic"]',
  pharmacy: '["amenity"="pharmacy"]',
}
const KIND_LABEL: Record<NearbyKind, string> = { police: 'Police station', hospital: 'Hospital / clinic', pharmacy: 'Pharmacy' }

interface OverpassElement {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export async function findNearby(kind: NearbyKind, origin: LatLng, radiusMeters = 4000): Promise<Place[]> {
  const f = OVERPASS_FILTER[kind]
  const query = `[out:json][timeout:15];(node${f}(around:${radiusMeters},${origin.lat},${origin.lng});way${f}(around:${radiusMeters},${origin.lat},${origin.lng}););out center 25;`
  // Public Overpass servers go down or rate-limit regularly: try each in turn and only fail if all do.
  let data: { elements: OverpassElement[] } | null = null
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      data = await getJson<{ elements: OverpassElement[] }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!data) throw lastError instanceof Error ? lastError : new PlacesError('Could not reach the map service.', true)
  const places: Place[] = []
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat === undefined || lng === undefined) continue
    const place: Place = { lat, lng, name: el.tags?.name || KIND_LABEL[kind], detail: KIND_LABEL[kind] }
    place.distance = distanceBetween(origin, place)
    places.push(place)
  }
  return places.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)).slice(0, 8)
}

/** An external-app deep link (Google Maps) for turn-by-turn voice navigation outside SafeHer. */
export function externalDirectionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(6)},${to.lng.toFixed(6)}&travelmode=walking`
}
