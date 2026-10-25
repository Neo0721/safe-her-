import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

export interface LocalContact {
  id: string
  name: string
  relationship: string
  phone: string
  priority: 'High' | 'Medium' | 'Low' | string
}

export interface LocalSnapshot {
  owner: string | null
  fullName: string | null
  phone: string | null
  bloodGroup: string | null
  /** Epoch milliseconds of the last successful copy from the server. */
  syncedAt: number | null
  contacts: LocalContact[]
  note: string
}

interface LocalStoreNative {
  saveSnapshot(snapshot: {
    owner: string
    fullName?: string | null
    phone?: string | null
    bloodGroup?: string | null
    contacts: LocalContact[]
  }): Promise<{ contacts: number }>
  getSnapshot(): Promise<LocalSnapshot>
  clear(): Promise<void>
  openEmergencyCard(): Promise<void>
}

const native = registerPlugin<LocalStoreNative>('LocalStore')

/**
 * The phone's own SQLite database (Android only). It mirrors the signed-in user's profile and
 * contacts for offline use; the server database remains the source of truth. In a browser every
 * call is a harmless no-op.
 */
export const localStore = {
  available: () => isNativeApp(),

  async save(snapshot: Parameters<LocalStoreNative['saveSnapshot']>[0]): Promise<void> {
    if (!isNativeApp()) return
    await native.saveSnapshot(snapshot)
  },

  async read(): Promise<LocalSnapshot | null> {
    if (!isNativeApp()) return null
    try {
      return await native.getSnapshot()
    } catch {
      return null
    }
  },

  async clear(): Promise<void> {
    if (!isNativeApp()) return
    try {
      await native.clear()
    } catch {
      /* nothing to clear */
    }
  },

  async openEmergencyCard(): Promise<void> {
    if (!isNativeApp()) throw new Error('The native Emergency Card is part of the SafeHer Android app.')
    await native.openEmergencyCard()
  },
}
