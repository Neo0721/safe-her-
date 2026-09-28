'use client'

import { App } from '@capacitor/app'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { runBackHandler } from '@/lib/back-stack'
import { isNativeApp } from '@/lib/platform'

// Screens where "back" leaves the app instead of navigating.
const ROOT_ROUTES = ['/', '/home', '/login']

/** Wires the Android hardware/gesture back button to sensible in-app navigation. */
export function AndroidBackHandler() {
  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const pathRef = useRef(pathname)

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!isNativeApp()) return
    let remove: (() => void) | null = null
    let active = true

    App.addListener('backButton', ({ canGoBack }) => {
      if (runBackHandler()) return // an open dialog claims back first

      const path = pathRef.current
      if (path.startsWith('/emergency')) {
        // Never abandon an active SOS with a stray back press.
        toast.info('Use the buttons on screen to end the SOS.')
        return
      }
      if (ROOT_ROUTES.includes(path)) {
        void App.exitApp()
        return
      }
      if (canGoBack) router.back()
      else router.replace('/home')
    })
      .then((handle) => {
        if (active) remove = () => void handle.remove()
        else void handle.remove()
      })
      .catch(() => {})

    return () => {
      active = false
      remove?.()
    }
  }, [router])

  return null
}
