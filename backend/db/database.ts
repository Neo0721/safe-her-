import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { migrate, resolveDbPath } from './schema.cjs'

const DB_PATH = resolveDbPath()
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __safeherDb?: Database.Database }

function open(): Database.Database {
  const conn = new Database(DB_PATH)
  conn.pragma('journal_mode = WAL')
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
