'use client'

import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { useAuth } from '@/contexts/AuthContext'
import { DATA_CHANGED_EVENT } from '@/lib/api-fetch'
import { syncLocalMirror } from '@/lib/local-sync'
import { localStore } from '@/lib/native/local-store'

/**
 * Keeps the phone's own SQLite copy (used by the native Emergency Card and offline fallbacks) in
 * step with the server: after sign-in, when the app returns to the foreground, and after the user
 * edits their profile or contacts. Renders nothing; a no-op in a browser.
 */
export function OfflineSync() {
  const { user } = useAuth()
  const uid = user?.uid

  useEffect(() => {
    if (!uid || !localStore.available()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      clearTimeout(timer)
      // Debounced: several edits in a row cause one refresh.
      timer = setTimeout(() => {
        syncLocalMirror(uid).catch((error) => console.warn('Phone copy not refreshed:', (error as Error).message))
      }, 800)
    }
    run()
    window.addEventListener(DATA_CHANGED_EVENT, run)
    let remove: (() => void) | undefined
    let cancelled = false
    void App.addListener('resume', run).then((handle) => {
      if (cancelled) void handle.remove()
      else remove = () => void handle.remove()
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener(DATA_CHANGED_EVENT, run)
      remove?.()
    }
  }, [uid])

  return null
}
