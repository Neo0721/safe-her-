'use client'

import { useEffect } from 'react'

/** Mirrors "the page has been scrolled" onto <html data-scrolled> so headers can turn frosted only when needed. */
export function ScrollState() {
  useEffect(() => {
    const root = document.documentElement
    const update = () => {
      if (window.scrollY > 6) root.setAttribute('data-scrolled', '1')
      else root.removeAttribute('data-scrolled')
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      root.removeAttribute('data-scrolled')
    }
  }, [])
  return null
}
