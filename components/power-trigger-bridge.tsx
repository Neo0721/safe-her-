'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson } from '@/lib/api-fetch'
import { powerTrigger } from '@/lib/native/sos-trigger'
import type { SosSettings } from '@/lib/types'

/**
 * Keeps the Android power-button trigger in step with the signed-in user's saved settings and
 * opens the emergency screen when the trigger fires. Renders nothing; a no-op in a browser.
 */
export function PowerTriggerBridge() {
  const router = useRouter()
  const { user } = useAuth()
  const uid = user?.uid
  const routerRef = useRef(router)
  const signedInRef = useRef(false)

  useEffect(() => {
    routerRef.current = router
  }, [router])
  useEffect(() => {
    signedInRef.current = !!uid
  }, [uid])

  // Deliver triggers (including one that cold-started the app).
  useEffect(() => {
    if (!powerTrigger.available()) return
    let off: (() => void) | undefined
    let cancelled = false
    void powerTrigger
      .onTriggered((event) => {
        const source = event?.source === 'motion' ? 'motion' : 'power'
        if (signedInRef.current) {
          routerRef.current.push(`/emergency?start=1&source=${source}`)
        } else {
          toast.error('SOS was triggered, but you are signed out. Call your emergency number or sign in.')
          routerRef.current.replace('/login')
        }
      })
      .then((remove) => {
        if (cancelled) remove()
        else off = remove
      })
    return () => {
      cancelled = true
      off?.()
    }
  }, [])

  // Apply the saved setting whenever a user signs in; switch it off for signed-out sessions.
  useEffect(() => {
    if (!powerTrigger.available()) return
    if (!uid) {
      void powerTrigger.stop()
      void powerTrigger.setMotionDetection(false)
      return
    }
    let cancelled = false
    apiJson<SosSettings>('/api/settings')
      .then(async (settings) => {
        if (cancelled) return
        if (settings.power_trigger === 1) await powerTrigger.start(settings.power_presses)
        else await powerTrigger.stop()
        await powerTrigger.setMotionDetection(settings.motion_detection === 1)
      })
      .catch((error) => console.warn('Protection settings not applied:', (error as Error).message))
    return () => {
      cancelled = true
    }
  }, [uid])

  return null
}
