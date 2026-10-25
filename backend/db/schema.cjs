/**
 * Single source of truth for the SafeHer SQLite schema.
 * Used by the Next.js server (backend/db/database.ts) and by scripts/db-init.js.
 *
 * Firebase is used for identity only. Passwords are never stored here.
 * All migrations are additive and idempotent so existing data is preserved.
 */
const path = require('path')

/** Resolve the SQLite file location. `SAFEHER_DB_PATH` lets tests use a scratch database. */
function resolveDbPath() {
  const override = process.env.SAFEHER_DB_PATH
  if (override) return path.resolve(override)
  return path.join(process.cwd(), 'data', 'safeher.db')
}

const BASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    blood_group TEXT,
    language TEXT DEFAULT 'English',
    photo_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) DEFAULT 'High',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    destination TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sos_events (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    status TEXT CHECK(status IN ('Preparing', 'Activating', 'Active', 'Attempted', 'Completed', 'Failed', 'Cancelled', 'Unavailable')) DEFAULT 'Active',
    contacts_notified INTEGER DEFAULT 0,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS location_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT NOT NULL,
    sos_event_id TEXT,
    trip_id TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (sos_event_id) REFERENCES sos_events(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sos_settings (
    firebase_uid TEXT PRIMARY KEY,
    hold_duration INTEGER DEFAULT 3,
    location_sharing INTEGER DEFAULT 1,
    audio_recording INTEGER DEFAULT 0,
    notify_contacts INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );

  -- Records that the dialer / SMS composer was OPENED for a contact during an SOS.
  -- It never claims a call connected or an SMS was delivered: the OS does that, not the app.
  CREATE TABLE IF NOT EXISTS sos_actions (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    sos_event_id TEXT NOT NULL,
    contact_id TEXT,
    kind TEXT NOT NULL CHECK(kind IN ('call_contact', 'sms_contact', 'call_emergency')),
    status TEXT NOT NULL DEFAULT 'opened',
    created_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE,
    FOREIGN KEY (sos_event_id) REFERENCES sos_events(id) ON DELETE CASCADE
  );

  -- Photos / audio / video the user explicitly chose to upload. Bytes live on disk (data/media), metadata here.
  -- Every row is scoped to the verified Firebase uid; nothing is uploaded automatically.
  CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY,
    firebase_uid TEXT NOT NULL,
    sos_event_id TEXT,
    kind TEXT NOT NULL CHECK(kind IN ('photo', 'audio', 'video')),
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (firebase_uid) REFERENCES users(firebase_uid) ON DELETE CASCADE
  );
`

const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_users_uid ON users(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_contacts_uid ON emergency_contacts(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_sos_uid ON sos_events(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_loc_uid ON location_points(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_loc_sos ON location_points(sos_event_id);
  CREATE INDEX IF NOT EXISTS idx_trips_uid ON trips(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_activity_uid ON activity_logs(firebase_uid);
  CREATE INDEX IF NOT EXISTS idx_actions_sos ON sos_actions(sos_event_id);
  CREATE INDEX IF NOT EXISTS idx_sos_started ON sos_events(firebase_uid, started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(firebase_uid, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(firebase_uid, status);
`

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)
}

/** Create tables and apply additive migrations. Safe to run repeatedly. */
function migrate(db) {
  db.exec(BASE_SCHEMA)

  // Drill / test SOS flag. The status CHECK constraint cannot be altered in place,
  // so drills are stored as a normal event with is_test = 1.
  if (!hasColumn(db, 'sos_events', 'is_test')) {
    db.exec('ALTER TABLE sos_events ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0')
  }

  // Power-button quick trigger: opt-in, N rapid presses within a short window.
  if (!hasColumn(db, 'sos_settings', 'power_trigger')) {
    db.exec('ALTER TABLE sos_settings ADD COLUMN power_trigger INTEGER NOT NULL DEFAULT 0')
  }
  if (!hasColumn(db, 'sos_settings', 'power_presses')) {
    db.exec('ALTER TABLE sos_settings ADD COLUMN power_presses INTEGER NOT NULL DEFAULT 5')
  }
  // How an SOS was started: 'hold' (on-screen button), 'power' (power-button trigger) or
  // 'motion' (the user confirmed a fall / impact check-in alert).
  if (!hasColumn(db, 'sos_events', 'trigger_source')) {
    db.exec("ALTER TABLE sos_events ADD COLUMN trigger_source TEXT NOT NULL DEFAULT 'hold'")
  }
  // Opt-in sensor-based fall / impact check-in (rule-based, on-device).
  if (!hasColumn(db, 'sos_settings', 'motion_detection')) {
    db.exec('ALTER TABLE sos_settings ADD COLUMN motion_detection INTEGER NOT NULL DEFAULT 0')
  }

  // Video evidence: a CHECK constraint cannot be altered in place, so databases created before
  // video support get the table rebuilt (rows are copied unchanged; media files are untouched).
  const mediaDef = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'media_items'").get()
  if (mediaDef && !mediaDef.sql.includes("'video'")) {
    db.transaction(() => {
      db.exec('ALTER TABLE media_items RENAME TO media_items_old')
      db.exec(BASE_SCHEMA.match(/CREATE TABLE IF NOT EXISTS media_items \([\s\S]*?\n  \);/)[0].replace('IF NOT EXISTS ', ''))
      db.exec('INSERT INTO media_items SELECT id, firebase_uid, sos_event_id, kind, mime_type, size_bytes, file_name, created_at FROM media_items_old')
      db.exec('DROP TABLE media_items_old')
    })()
  }

  db.exec(INDEXES)
  db.exec('CREATE INDEX IF NOT EXISTS idx_media_uid ON media_items(firebase_uid, created_at DESC)')
}

module.exports = { migrate, resolveDbPath }
