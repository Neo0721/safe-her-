'use client'

import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SettingsToggleProps {
  icon: LucideIcon
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  tone?: 'primary' | 'danger' | 'success' | 'warm' | 'sky'
}

const tones = {
  primary: 'gradient-primary',
  danger: 'gradient-danger',
  success: 'gradient-success',
  warm: 'gradient-warm',
  sky: 'gradient-sky',
} as const

export function SettingsToggle({ icon: Icon, label, description, checked, onCheckedChange, tone = 'primary' }: SettingsToggleProps) {
  const id = label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="surface-raised flex items-center gap-3 rounded-2xl p-3.5">
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm', tones[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  )
}
