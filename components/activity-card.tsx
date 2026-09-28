import { MapPin, Settings2, Siren, UserRoundCog } from 'lucide-react'
import { cn } from '@/lib/utils'

const config = {
  sos: {
    icon: Siren,
    className: 'bg-danger/12 text-danger',
    bgColor: 'bg-danger/5',
  },
  contact: {
    icon: UserRoundCog,
    className: 'bg-primary/12 text-primary',
    bgColor: 'bg-primary/5',
  },
  location: {
    icon: MapPin,
    className: 'bg-success/12 text-success',
    bgColor: 'bg-success/5',
  },
  settings: {
    icon: Settings2,
    className: 'bg-muted/50 text-muted-foreground',
    bgColor: 'bg-muted/5',
  },
  auth: {
    icon: UserRoundCog,
    className: 'bg-primary/12 text-primary',
    bgColor: 'bg-primary/5',
  },
} as const

export interface ActivityView {
  id: string
  type: string
  title: string
  detail: string | null
  time: string
}

export function ActivityCard({ activity }: { activity: ActivityView }) {
  // Safe fallback to prevent runtime crashes if an unexpected activity type is logged
  const cardConfig = config[activity.type as keyof typeof config] || config.settings
  const { icon: Icon, className, bgColor } = cardConfig

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 transition-all hover:shadow-sm',
        bgColor
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
          className,
        )}
      >
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {activity.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {activity.detail}
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {activity.time}
      </span>
    </div>
  )
}
