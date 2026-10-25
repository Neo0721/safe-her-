import { Device } from '@capacitor/device'
import type { BatterySample } from '@/lib/insights'

// Real battery readings kept on this phone only (never uploaded) so the drain rate can be fitted.
const KEY = 'safeher.batteryLog.v1'
const MAX_SAMPLES = 240
const MIN_GAP_MS = 4 * 60_000
const MAX_AGE_MS = 24 * 3_600_000

export function readBatteryLog(): BatterySample[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as BatterySample[]
    const cutoff = Date.now() - MAX_AGE_MS
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s.t === 'number' && typeof s.level === 'number' && s.t >= cutoff)
      : []
  } catch {
    return []
  }
}

export function clearBatteryLog() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Reads the real battery and appends it (rate-limited). Returns the stored log, or null if the OS exposes no battery data. */
export async function sampleBattery(force = false): Promise<{ log: BatterySample[]; level: number; charging: boolean } | null> {
  try {
    const info = await Device.getBatteryInfo()
    if (typeof info.batteryLevel !== 'number') return null
    const level = Math.round(info.batteryLevel * 100)
    const charging = Boolean(info.isCharging)
    const log = readBatteryLog()
    const last = log[log.length - 1]
    if (force || !last || Date.now() - last.t >= MIN_GAP_MS || last.charging !== charging) {
      log.push({ t: Date.now(), level, charging })
      try {
        window.localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX_SAMPLES)))
      } catch {
        /* storage full or blocked: prediction just has less data */
      }
    }
    return { log, level, charging }
  } catch {
    return null
  }
}
