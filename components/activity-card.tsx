import { MapPin, Settings2, Siren, UserRoundCog } from 'lucide-react'
import { cn } from '@/lib/utils'

const config = {
  sos: { icon: Siren, tone: 'gradient-danger' },
  contact: { icon: UserRoundCog, tone: 'gradient-primary' },
  location: { icon: MapPin, tone: 'gradient-sky' },
  settings: { icon: Settings2, tone: 'gradient-warm' },
  auth: { icon: UserRoundCog, tone: 'gradient-success' },
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
  const { icon: Icon, tone } = config[activity.type as keyof typeof config] || config.settings

  return (
    <div className="surface flex items-center gap-3 rounded-2xl p-3">
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm', tone)}>
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{activity.title}</p>
        <p className="truncate text-xs text-muted-foreground">{activity.detail}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{activity.time}</span>
    </div>
  )
}
