import { optionalString, requiredString, validEmail, validPhone } from '@/backend/http'

export const PRIORITIES = ['High', 'Medium', 'Low']

export interface ContactInput {
  name: string
  relationship: string
  phone: string
  email: string | null
  priority: string
}

/** Validates a contact payload. Shared by the collection and item routes. */
export function parseContact(body: Record<string, unknown>): ContactInput | { error: string } {
  const name = requiredString(body.name, 100)
  const relationship = requiredString(body.relationship, 50)
  const phone = requiredString(body.phone, 20)
  if (!name || !relationship || !phone) return { error: 'Name, relationship and phone are required.' }
  if (!validPhone(phone)) return { error: 'Phone number is invalid.' }

  const email = optionalString(body.email, 254)
  if (email === undefined || (email && !validEmail(email))) return { error: 'Email address is invalid.' }

  const priority = typeof body.priority === 'string' ? body.priority : 'High'
  if (!PRIORITIES.includes(priority)) return { error: 'Priority must be High, Medium or Low.' }

  return { name, relationship, phone, email, priority }
}
