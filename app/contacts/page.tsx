'use client'

import { Plus, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { ContactCard } from '@/components/contact-card'
import { Stagger, StaggerItem } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import type { Contact, Priority } from '@/lib/types'
import { cn, initialsOf } from '@/lib/utils'

const priorities: Priority[] = ['High', 'Medium', 'Low']

const empty = {
  name: '',
  relationship: '',
  phone: '',
  email: '',
  priority: 'High' as Priority,
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const { user } = useAuth()
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchContacts = async () => {
    try {
      setContacts(await apiJson<Contact[]>('/api/contacts'))
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, 'Could not load your contacts.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void fetchContacts()
  }, [user])

  const openAdd = () => {
    setEditing(null)
    setForm(empty)
    setFormOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditing(contact)
    setForm({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email ?? '',
      priority: contact.priority,
    })
    setFormOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim() || !form.relationship.trim() || !form.phone.trim()) {
      toast.error('Please fill in name, relationship and phone.')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await apiJson(`/api/contacts/${editing.id}`, { method: 'PUT', json: form })
        toast.success('Contact updated')
      } else {
        await apiJson('/api/contacts', { method: 'POST', json: form })
        toast.success('Contact added to your safety network')
      }
      setFormOpen(false)
      await fetchContacts()
    } catch (error) {
      toast.error(errorMessage(error, 'Error saving contact. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiJson(`/api/contacts/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success(`${deleteTarget.name} removed`)
      await fetchContacts()
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete contact.'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <AppShell title="Emergency Contacts" showBack>
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/8 p-3.5">
        <ShieldAlert className="size-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          During an SOS, these contacts appear as one-tap call and SMS shortcuts. SafeHer opens your dialer or SMS app; you press call or send.
        </p>
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
      >
        <Plus className="size-5" />
        Add contact
      </button>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm">
          <p className="font-medium">Could not load your contacts</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); void fetchContacts() }} className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 font-semibold">
            Try again
          </button>
        </div>
      ) : contacts.length > 0 ? (
        <Stagger className="mt-4 space-y-3">
          {contacts.map((contact) => (
            <StaggerItem key={contact.id}>
              <ContactCard
                contact={{ ...contact, initials: initialsOf(contact.name) }}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">No emergency contacts added yet.</p>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Edit Contact' : 'Add Contact'}
        description="Trusted people you can call or message with one tap during an emergency."
      >
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-rel">Relationship</Label>
            <Input
              id="c-rel"
              required
              value={form.relationship}
              onChange={(e) =>
                setForm({ ...form, relationship: e.target.value })
              }
              placeholder="Mother, Friend, Sibling…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-phone">Phone</Label>
            <Input
              id="c-phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. +91 98765 43210"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">Email (Optional)</Label>
            <Input
              id="c-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  className={cn(
                    'min-h-11 rounded-xl border py-2.5 text-sm font-medium transition-colors',
                    form.priority === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="h-12 flex-1 rounded-xl"
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove contact?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from your emergency shortcuts.`
            : ''
        }
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1 rounded-xl"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="h-12 flex-1 rounded-xl"
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </AppShell>
  )
}
