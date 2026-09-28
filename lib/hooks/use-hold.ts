'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Press-and-hold gesture with progress. `onComplete` fires once when the hold reaches `durationMs`. */
export function useHold(durationMs: number, onComplete: () => void) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const frame = useRef<number | null>(null)
  const startedAt = useRef(0)
  const done = useRef(false)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setHolding(false)
    setProgress(0)
  }, [])

  useEffect(() => cancel, [cancel])

  const start = useCallback(() => {
    if (frame.current !== null) return
    done.current = false
    startedAt.current = performance.now()
    setHolding(true)
    const tick = () => {
      const pct = Math.min((performance.now() - startedAt.current) / durationMs, 1)
      setProgress(pct)
      if (pct >= 1) {
        frame.current = null
        setHolding(false)
        if (!done.current) {
          done.current = true
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100])
          completeRef.current()
        }
        return
      }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [durationMs])

  return {
    progress,
    holding,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    },
  }
}
