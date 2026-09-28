// Remembers an in-progress SOS on this device so a refresh, app restart or accidental navigation
// resumes the same event instead of creating a duplicate. The server remains the source of truth.
const KEY = 'safeher.activeSos'

export interface ActiveSos {
  id: string
  uid: string
  isTest: boolean
  startedAt: number
}

export function getActiveSos(uid: string | undefined): ActiveSos | null {
  if (!uid) return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveSos
    return parsed.uid === uid && typeof parsed.id === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function setActiveSos(value: ActiveSos) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* storage unavailable: resume is best-effort */
  }
}

export function clearActiveSos() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
