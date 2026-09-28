import type { Database } from 'better-sqlite3'

export function migrate(db: Database): void
export function resolveDbPath(): string
