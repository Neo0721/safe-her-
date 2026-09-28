// Local cache of the user's SOS hold duration (the saved value lives in SQLite via /api/settings).
const KEY = 'safeher.holdSeconds'
const ALLOWED = [3, 5, 10]

export function getHoldSeconds(): number {
  try {
    const value = Number(window.localStorage.getItem(KEY))
    return ALLOWED.includes(value) ? value : 3
  } catch {
    return 3
  }
}

export function setHoldSeconds(seconds: number) {
  try {
    if (ALLOWED.includes(seconds)) window.localStorage.setItem(KEY, String(seconds))
  } catch {
    /* ignore */
  }
}
