'use client'

import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { pushBackHandler } from '@/lib/back-stack'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
  title?: string
  description?: string
  hideClose?: boolean
}

function Dialog({
  open,
  onOpenChange,
  children,
  className,
  title,
  description,
  hideClose,
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Android back button closes the dialog instead of navigating away.
    const removeBack = pushBackHandler(() => onOpenChange(false))
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      removeBack()
    }
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              // Scrolls internally so long forms stay reachable when the keyboard shrinks the viewport.
              'relative z-10 max-h-[calc(100dvh-var(--sat)-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card p-6 pb-[calc(1.5rem+var(--sab))] shadow-xl sm:rounded-3xl',
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  {title && (
                    <h2 className="font-display text-lg font-semibold">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close dialog"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export { Dialog }
