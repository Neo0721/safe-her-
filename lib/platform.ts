import { Capacitor } from '@capacitor/core'

/** True when running inside the Capacitor Android/iOS shell (not a normal browser tab). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}
