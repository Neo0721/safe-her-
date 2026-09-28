import type { ComponentProps } from 'react'
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

function AvatarImage({ className, alt = '', ...props }: ComponentProps<'img'>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-slot="avatar-image"
      alt={alt}
      className={cn('size-full object-cover', className)}
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
