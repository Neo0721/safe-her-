import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

interface SmartAlertNative {
  checkPermission(): Promise<{ display: 'granted' | 'denied' | 'prompt' }>
  requestPermission(): Promise<{ display: 'granted' | 'denied' | 'prompt' }>
  notify(options: { id?: number; title: string; body: string }): Promise<void>
}

// Plain on-device notification (no alarms scheduled, no contact is ever alerted).
const native = registerPlugin<SmartAlertNative>('SmartAlert')

const ENABLED_KEY = 'safeher.smartAlerts'
const LAST_KEY = 'safeher.smartAlerts.lastBattery'
const COOLDOWN_MS = 60 * 60_000
const BATTERY_NOTIFICATION_ID = 7101

export function isSmartAlertsEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/** Turns smart alerts on (asking for notification permission first) or off. Returns the resulting state. */
export async function setSmartAlerts(enabled: boolean): Promise<{ enabled: boolean; reason?: string }> {
  if (enabled) {
    if (!isNativeApp()) return { enabled: false, reason: 'Smart alerts run in the SafeHer Android app.' }
    const status = await native.requestPermission()
    if (status.display !== 'granted') {
      return { enabled: false, reason: 'Notifications are blocked. Allow them for SafeHer in your phone settings.' }
    }
  }
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    return { enabled: false, reason: 'This device would not save the setting.' }
  }
  return { enabled }
}

/** Shows a local notification, at most once an hour, warning that the battery is predicted to run low. */
export async function notifyBatteryForecast(level: number, duration: string): Promise<boolean> {
  try {
    const last = Number(window.localStorage.getItem(LAST_KEY) ?? 0)
    if (Date.now() - last < COOLDOWN_MS) return false
    if ((await native.checkPermission()).display !== 'granted') return false
    await native.notify({
      id: BATTERY_NOTIFICATION_ID,
      title: 'Battery may run out soon',
      body: `At ${level}% and the current rate, your phone could reach 10% in about ${duration}. Charge it so SafeHer can keep sharing your location.`,
    })
    window.localStorage.setItem(LAST_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}
