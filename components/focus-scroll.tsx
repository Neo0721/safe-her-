'use client'

import { useEffect } from 'react'

/** Keeps the focused form field visible when the on-screen keyboard opens. */
export function FocusScroll() {
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      // Wait for the keyboard animation / viewport resize before measuring.
      window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])
  return null
}
