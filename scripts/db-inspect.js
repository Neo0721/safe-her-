const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.SAFEHER_DB_PATH
  ? path.resolve(process.env.SAFEHER_DB_PATH)
  : path.join(__dirname, '../data/safeher.db')

if (!fs.existsSync(DB_PATH)) {
  console.log(`Database does not exist at ${DB_PATH}. Run "npm run db:init" first.`)
  process.exit(1)
}

const db = new Database(DB_PATH)

console.log('====================================')
console.log('   SafeHer Database Inspection')
console.log('====================================')

const tables = [
  'users',
  'emergency_contacts',
  'sos_events',
  'location_points',
  'trips',
  'sos_settings',
  'sos_actions',
  'activity_logs',
]

tables.forEach((table) => {
  try {
    const row = db.prepare(`SELECT count(*) as count FROM ${table}`).get()
    console.log(`${table}: ${row.count} rows`)
  } catch (err) {
    console.log(`${table}: Table does not exist or error reading (${err.message})`)
  }
})

console.log('\n====================================')
console.log('   Sanitized User Records')
console.log('====================================')

try {
  const users = db
    .prepare('SELECT id, firebase_uid, full_name, email, phone, blood_group, language, created_at FROM users')
    .all()
  if (users.length === 0) {
    console.log('No user profiles created in database yet.')
  } else {
    users.forEach((user) => {
      console.log(`- [User ID: ${user.id}] ${user.full_name} (${user.email}) | UID: ${user.firebase_uid}`)
    })
  }
} catch (err) {
  console.log('Error reading users:', err.message)
}

console.log('\n====================================')
console.log('   Sanitized Emergency Contacts')
console.log('====================================')

try {
  const contacts = db
    .prepare('SELECT id, firebase_uid, name, relationship, phone, priority FROM emergency_contacts')
    .all()
  if (contacts.length === 0) {
    console.log('No emergency contacts in database yet.')
  } else {
    contacts.forEach((c) => {
      console.log(`- [UID: ${c.firebase_uid}] ${c.name} (${c.relationship}) - Phone: ${c.phone} | Priority: ${c.priority}`)
    })
  }
} catch (err) {
  console.log('Error reading emergency contacts:', err.message)
}

console.log('\n====================================')
console.log('   Sanitized SOS Events')
console.log('====================================')

try {
  const events = db
    .prepare('SELECT id, firebase_uid, started_at, ended_at, latitude, longitude, status, is_test FROM sos_events')
    .all()
  if (events.length === 0) {
    console.log('No SOS events in database yet.')
  } else {
    events.forEach((e) => {
      console.log(
        `- [UID: ${e.firebase_uid}] ${e.is_test ? 'DRILL ' : ''}Status: ${e.status} | Start: ${e.started_at} | End: ${e.ended_at || 'Active'} | Coords: ${e.latitude || 'N/A'}, ${e.longitude || 'N/A'}`
      )
    })
  }
} catch (err) {
  console.log('Error reading SOS events:', err.message)
}

db.close()
