'use client'

import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface SettingsToggleProps {
  icon: LucideIcon
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function SettingsToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: SettingsToggleProps) {
  const id = label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
