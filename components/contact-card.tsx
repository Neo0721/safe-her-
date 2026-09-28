'use client'

import { PencilLine, Phone, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Contact } from '@/lib/types'

const priorityVariant = {
  High: 'emergency',
  Medium: 'default',
  Low: 'muted',
} as const

export function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact & { initials: string }
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-14 border-2 border-secondary">
          <AvatarFallback className="bg-primary/12 font-display font-semibold text-primary">
            {contact.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-display font-semibold">
              {contact.name}
            </p>
            <Badge variant={priorityVariant[contact.priority]}>
              {contact.priority}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contact.relationship}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-foreground/80">
            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
            <a href={`tel:${contact.phone}`} className="truncate">{contact.phone}</a>
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(contact)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <PencilLine className="size-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(contact)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emergency/30 py-2 text-sm font-medium text-emergency transition-colors hover:bg-emergency/10"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    </Card>
  )
}
