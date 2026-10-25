import { apiJson } from '@/lib/api-fetch'
import { localStore } from '@/lib/native/local-store'
import type { Contact } from '@/lib/types'

interface ProfileResponse {
  full_name?: string | null
  phone?: string | null
  blood_group?: string | null
}

/** Copies the signed-in user's profile and contacts from the server into the phone's SQLite database. */
export async function syncLocalMirror(uid: string): Promise<void> {
  if (!localStore.available()) return
  const [profile, contacts] = await Promise.all([
    apiJson<ProfileResponse>('/api/profile'),
    apiJson<Contact[]>('/api/contacts'),
  ])
  await localStore.save({
    owner: uid,
    fullName: profile.full_name ?? null,
    phone: profile.phone ?? null,
    bloodGroup: profile.blood_group ?? null,
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, relationship: c.relationship, phone: c.phone, priority: c.priority })),
  })
}
