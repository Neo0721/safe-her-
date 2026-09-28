'use client'

import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { isNativeApp } from '@/lib/platform'

/** Keeps Android status/navigation bar icons readable: light icons on the dark theme, dark icons on the light theme. */
export function SystemBarsSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!isNativeApp() || !resolvedTheme) return
    SystemBars.setStyle({ style: resolvedTheme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }, [resolvedTheme])

  return null
}
