const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')
const { migrate, resolveDbPath } = require('../backend/db/schema.cjs')

// Scripts may be run from any directory; the default DB lives next to the project.
const DB_PATH = process.env.SAFEHER_DB_PATH
  ? resolveDbPath()
  : path.join(__dirname, '../data/safeher.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

console.log('Opening database at:', DB_PATH)
const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')

console.log('Initializing tables and applying migrations...')
migrate(db)

console.log('Database successfully initialized!')
db.close()
