'use client'

import { useEffect } from 'react'

/** Marks the current screen as dark at the top so the Android status-bar icons are drawn light (see SystemBarsSync). */
export function DarkScreen() {
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-dark-screen', '1')
    return () => root.removeAttribute('data-dark-screen')
  }, [])
  return null
}
