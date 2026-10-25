import crypto from 'crypto'

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
