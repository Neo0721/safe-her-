import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

export interface TriggerStatus {
  running: boolean
  presses: number
  notificationsGranted: boolean
  /** True when Android will not restrict SafeHer in the background (battery optimisation off). */
  batteryUnrestricted: boolean
  /** True when Android lets the alert open the emergency screen over the lock screen. */
  fullScreenAllowed: boolean
  /** True when SafeHer may open itself instantly from the background ("display over other apps"). */
  overlayAllowed: boolean
}

interface SosTriggerNative {
  start(options: { presses: number; windowMs?: number }): Promise<TriggerStatus>
  stop(): Promise<TriggerStatus>
  status(): Promise<TriggerStatus>
  requestNotificationPermission(): Promise<{ granted: boolean }>
  openBatterySettings(): Promise<void>
  openFullScreenSettings(): Promise<void>
  openOverlaySettings(): Promise<void>
  addListener(event: 'sosTriggered', handler: (data: { source: string; at: number }) => void): Promise<PluginListenerHandle>
}

const native = registerPlugin<SosTriggerNative>('SosTrigger')

/** The power-button trigger only exists in the Android app; in a browser every call is a safe no-op. */
export const powerTrigger = {
  available: () => isNativeApp(),

  async status(): Promise<TriggerStatus | null> {
    if (!isNativeApp()) return null
    try {
      return await native.status()
    } catch {
      return null
    }
  },

  /** Asks for the notification permission Android requires for a background listener. */
  async ensurePermission(): Promise<boolean> {
    if (!isNativeApp()) return false
    const current = await native.status()
    if (current.notificationsGranted) return true
    return (await native.requestNotificationPermission()).granted
  },

  /** Starts (or restarts) listening. Asks for the notification permission first if needed. */
  async start(presses: number): Promise<TriggerStatus> {
    if (!isNativeApp()) throw new Error('The power-button trigger is only available in the Android app.')
    if (!(await powerTrigger.ensurePermission())) {
      throw new Error('Allow notifications so Android lets SafeHer keep listening in the background.')
    }
    return native.start({ presses })
  },

  async stop(): Promise<void> {
    if (!isNativeApp()) return
    try {
      await native.stop()
    } catch {
      /* nothing to stop */
    }
  },

  openBatterySettings: () => (isNativeApp() ? native.openBatterySettings() : Promise.resolve()),
  openFullScreenSettings: () => (isNativeApp() ? native.openFullScreenSettings() : Promise.resolve()),
  openOverlaySettings: () => (isNativeApp() ? native.openOverlaySettings() : Promise.resolve()),

  /** Fires when the service launched the app after N rapid power-button presses (also replays one missed while closed). */
  async onTriggered(handler: () => void): Promise<() => void> {
    if (!isNativeApp()) return () => {}
    const handle = await native.addListener('sosTriggered', () => handler())
    return () => void handle.remove()
  },
}
