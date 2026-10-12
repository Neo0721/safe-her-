'use client'

import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { isNativeApp } from '@/lib/platform'

/**
 * Keeps Android status/navigation bar icons readable: light icons on dark screens, dark icons on light ones.
 * Screens that are always dark (the emergency screen) set `data-dark-screen` on <html> while mounted.
 * Re-evaluated on every navigation so a forced style never leaks into the next screen.
 */
export function SystemBarsSync() {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()

  useEffect(() => {
    if (!isNativeApp() || !resolvedTheme) return
    const darkScreen = resolvedTheme === 'dark' || document.documentElement.hasAttribute('data-dark-screen')
    SystemBars.setStyle({ style: darkScreen ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }, [resolvedTheme, pathname])

  return null
}
