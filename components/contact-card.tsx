'use client'

import { PencilLine, Phone, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Contact } from '@/lib/types'
import { cn } from '@/lib/utils'

const priorityVariant = { High: 'emergency', Medium: 'default', Low: 'muted' } as const
const avatarTone = ['gradient-primary', 'gradient-sky', 'gradient-warm', 'gradient-success'] as const

export function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact & { initials: string }
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}) {
  // Stable colour per contact so the list is easy to scan.
  const tone = avatarTone[[...contact.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % avatarTone.length]

  return (
    <div className="surface rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold shadow-md', tone)}>
          {contact.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-display text-base font-bold">{contact.name}</p>
            <Badge variant={priorityVariant[contact.priority]}>{contact.priority}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{contact.relationship}</p>
          <a href={`tel:${contact.phone}`} className="mt-0.5 flex min-h-8 items-center gap-1.5 text-sm font-medium text-primary">
            <Phone className="size-3.5 shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </a>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => onEdit(contact)}
            aria-label={`Edit ${contact.name}`}
            className="surface-raised flex size-11 items-center justify-center rounded-2xl transition-transform active:scale-90"
          >
            <PencilLine className="size-4.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(contact)}
            aria-label={`Delete ${contact.name}`}
            className="flex size-11 items-center justify-center rounded-2xl bg-danger/10 text-danger transition-transform active:scale-90"
          >
            <Trash2 className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
