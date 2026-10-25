import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { migrate, resolveDbPath } from './schema.cjs'

// `next build` imports every route in several worker processes just to analyse them. They must not
// all open (and switch to WAL) the real file at once: that races with "database is locked", and it
// would also leave an empty database inside a Docker image. Nothing is read or written at build time.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'
const DB_PATH = IS_BUILD ? ':memory:' : resolveDbPath()
if (!IS_BUILD) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __safeherDb?: Database.Database }

function open(): Database.Database {
  const conn = new Database(DB_PATH, { timeout: 10_000 })
  if (!IS_BUILD) conn.pragma('journal_mode = WAL')
  conn.pragma('foreign_keys = ON')
  migrate(conn)
  return conn
}

const db = globalForDb.__safeherDb ?? open()
if (process.env.NODE_ENV !== 'production') globalForDb.__safeherDb = db

export function initDb() {
  migrate(db)
}

export default db
