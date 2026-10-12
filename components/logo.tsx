import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconClassName?: string
  showText?: boolean
  textClassName?: string
  size?: 'sm' | 'md' | 'lg'
  /** Use on a coloured/gradient background: the wordmark stays fully white/pink instead of gradient-filled. */
  onDark?: boolean
}

const sizes = {
  sm: { box: 'size-8 rounded-xl', icon: 'size-4.5', text: 'text-lg' },
  md: { box: 'size-10 rounded-2xl', icon: 'size-5.5', text: 'text-xl' },
  lg: { box: 'size-16 rounded-3xl', icon: 'size-9', text: 'text-3xl' },
} as const

export function Logo({ className, iconClassName, showText = true, textClassName, size = 'md', onDark }: LogoProps) {
  const s = sizes[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className={cn('flex items-center justify-center', onDark ? 'bg-white/20 ring-1 ring-white/30' : 'gradient-primary glow-primary', s.box)}>
        <ShieldCheck className={cn(s.icon, iconClassName)} strokeWidth={2.2} />
      </span>
      {showText && (
        <span className={cn('font-display font-bold tracking-tight', s.text, textClassName)}>
          Safe<span className={onDark ? 'text-pink-200' : 'text-gradient'}>Her</span>
        </span>
      )}
    </div>
  )
}
