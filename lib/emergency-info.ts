/**
 * Pure text parsing for the card scanner (no Capacitor imports, so it can be unit-tested in Node).
 */

export interface EmergencyInfoSummary {
  rawText: string
  bloodGroup: string | null
  phone: string | null
  emergencyContact: { label?: string; phone: string } | null
  name: string | null
  idNumber: string | null
  allergies: string | null
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
// A sign or POS/NEG must follow the group. A trailing \b would never match after "+" or "-", so use a lookahead.
const BLOOD_RE = /\b(AB|A|B|O)\s*([+-](?:VE)?|POS(?:ITIVE)?|NEG(?:ATIVE)?)(?![A-Za-z0-9])/i
// Without a "blood group" label nearby, only accept the tight forms (B+, AB-, O POS), never "Plan A - ...".
const BLOOD_STRICT_RE = /\b(AB|A|B|O)([+-](?:ve)?|\s?POS(?:ITIVE)?|\s?NEG(?:ATIVE)?)(?![A-Za-z0-9])/
const BLOOD_LABEL_RE = /blood|b\.?\s*group|\bbg\b|\brh\b/i
const NAME_LABEL_RE = /^(?:full\s+name|patient(?:'s)?\s+name|name)\s*[:\-]\s*(.+)$/i
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/
const EMERGENCY_LABEL_RE = /(?:emergency|ice|contact|relative|guardian|father|mother|spouse|kin)\b/i
const AADHAAR_RE = /\b\d{4}\s\d{4}\s\d{4}\b/
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/
const DRIVING_RE = /\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/
const ALLERGY_RE = /(?:allergic to|allergies?|allergy)[\s:]*([A-Za-z0-9,\s]{3,40})/i

function normalizeBlood(m: RegExpMatchArray): string | null {
  const type = m[1].toUpperCase()
  const raw = m[2].trim().toUpperCase()
  const sign = raw.startsWith('NEG') || raw.startsWith('-') ? '-' : '+'
  const candidate = `${type}${sign}`
  return BLOOD_GROUPS.includes(candidate) ? candidate : null
}

/**
 * Extracts useful emergency fields from scanned text: blood group, phone numbers, emergency contact
 * lines, ID numbers (Aadhaar/PAN/license pattern), and allergies.
 *
 * This is deterministic regex extraction on top of the real OCR text; it never invents values.
 */
export function extractEmergencyInfo(raw: string): EmergencyInfoSummary {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  let bloodGroup: string | null = null
  const labelled = lines.find((l) => BLOOD_LABEL_RE.test(l))
  const bloodMatch = (labelled && labelled.match(BLOOD_RE)) || raw.match(BLOOD_STRICT_RE)
  if (bloodMatch) bloodGroup = normalizeBlood(bloodMatch)

  let phone: string | null = null
  let emergencyContact: { label?: string; phone: string } | null = null

  for (const line of lines) {
    const match = line.match(PHONE_RE)
    if (match) {
      const clean = match[0].replace(/[\s-]/g, '')
      if (EMERGENCY_LABEL_RE.test(line)) {
        emergencyContact = { label: line.replace(match[0], '').trim() || 'Emergency contact', phone: clean }
      } else if (!phone) {
        phone = clean
      }
    }
  }

  let idNumber: string | null = null
  const aadhaar = raw.match(AADHAAR_RE)
  const pan = raw.match(PAN_RE)
  const dl = raw.match(DRIVING_RE)
  if (aadhaar) idNumber = `Aadhaar: ${aadhaar[0]}`
  else if (pan) idNumber = `PAN: ${pan[0]}`
  else if (dl) idNumber = `Driving Licence: ${dl[0]}`

  let allergies: string | null = null
  const allergyMatch = raw.match(ALLERGY_RE)
  if (allergyMatch) allergies = allergyMatch[1].trim()

  // Best-effort name guess: the first line containing 2-3 capitalized words without digits/labels.
  let name: string | null = null
  for (const line of lines) {
    const labelledName = line.match(NAME_LABEL_RE)?.[1]?.trim()
    if (labelledName && /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(labelledName)) {
      name = labelledName
      break
    }
  }
  for (const line of name ? [] : lines.slice(0, 6)) {
    if (
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(line) &&
      !/(government|republic|identity|card|department|driving|licence|health|hospital|insurance)/i.test(line)
    ) {
      name = line
      break
    }
  }

  return { rawText: raw, bloodGroup, phone, emergencyContact, name, idNumber, allergies }
}
