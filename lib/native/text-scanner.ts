import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

export interface ScanBlock {
  text: string
  lines: string[]
}

export interface ScanResult {
  text: string
  blocks: ScanBlock[]
  lineCount: number
  elapsedMs: number
  engine: string
  script: 'latin' | 'devanagari'
  imageWidth: number
  imageHeight: number
}

export interface EmergencyInfoSummary {
  rawText: string
  bloodGroup: string | null
  phone: string | null
  emergencyContact: { label?: string; phone: string } | null
  name: string | null
  idNumber: string | null
  allergies: string | null
}

interface TextScannerNative {
  recognize(options: { base64: string; script?: 'latin' | 'devanagari' }): Promise<ScanResult>
}

const native = registerPlugin<TextScannerNative>('TextScanner')

export const textScanner = {
  available: () => isNativeApp(),

  async recognize(base64: string, script: 'latin' | 'devanagari' = 'latin'): Promise<ScanResult> {
    if (!isNativeApp()) {
      throw new Error(
        'On-device ML Kit text recognition runs in the SafeHer Android app. Open the app on your phone or in Android Studio to scan.'
      )
    }
    return native.recognize({ base64, script })
  },
}

// ---------------------------------------------------------------------------- parsing

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const BLOOD_RE = /\b(A|B|AB|O)\s*([+-]|POS(?:ITIVE)?|NEG(?:ATIVE)?)\b/i
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/
const EMERGENCY_LABEL_RE = /(?:emergency|ice|contact|relative|guardian|father|mother|spouse|kin)\b/i
const AADHAAR_RE = /\b\d{4}\s\d{4}\s\d{4}\b/
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/
const DRIVING_RE = /\b[A-Z]{2}[-\s]?\d{2}[-\s]?\d{11}\b/
const ALLERGY_RE = /(?:allergic to|allergies?|allergy)[\s:]*([A-Za-z0-9,\s]{3,40})/i

function normalizeBlood(m: RegExpMatchArray): string | null {
  const type = m[1].toUpperCase()
  const sign = m[2].toUpperCase().startsWith('NEG') ? '-' : m[2].toUpperCase().startsWith('POS') ? '+' : m[2]
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
  const bloodMatch = raw.match(BLOOD_RE)
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
  for (const line of lines.slice(0, 6)) {
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
