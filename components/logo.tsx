import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconClassName?: string
  showText?: boolean
  textClassName?: string
}

export function Logo({
  className,
  iconClassName,
  showText = true,
  textClassName,
}: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className={cn('size-5', iconClassName)} />
      </span>
      {showText && (
        <span
          className={cn(
            'font-display text-xl font-bold tracking-tight',
            textClassName,
          )}
        >
          Safe<span className="text-primary">Her</span>
        </span>
      )}
    </div>
  )
}
