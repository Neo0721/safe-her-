// Online backup of the SQLite database using SQLite's backup API (safe while the server is running).
//   npm run db:backup                -> data/backups/safeher-<timestamp>.db
//   npm run db:backup -- /path/x.db  -> custom destination
const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const source = process.env.SAFEHER_DB_PATH
  ? path.resolve(process.env.SAFEHER_DB_PATH)
  : path.join(__dirname, '../data/safeher.db')

if (!fs.existsSync(source)) {
  console.error(`No database at ${source}. Nothing to back up.`)
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const destination = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(path.dirname(source), 'backups', `safeher-${stamp}.db`)
fs.mkdirSync(path.dirname(destination), { recursive: true })

const db = new Database(source, { readonly: true })
db.backup(destination)
  .then(() => {
    console.log(`Backup written to ${destination}`)
    db.close()
  })
  .catch((error) => {
    console.error('Backup failed:', error.message)
    db.close()
    process.exit(1)
  })
