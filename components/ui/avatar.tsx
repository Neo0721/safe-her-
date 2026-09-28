'use client'

import { useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Avatar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        'relative flex size-12 shrink-0 overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  )
}

/** Shows the picture only when there is a source and it loads; otherwise the fallback stays visible. */
function AvatarImage({ className, alt = '', src, ...props }: ComponentProps<'img'>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || typeof src !== 'string' || failedSrc === src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-slot="avatar-image"
      alt={alt}
      src={src}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn('absolute inset-0 z-10 size-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center bg-secondary text-sm font-medium text-secondary-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
