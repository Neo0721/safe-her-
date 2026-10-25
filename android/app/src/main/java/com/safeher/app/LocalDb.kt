package com.safeher.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * On-device SQLite store (Android's built-in SQLite, no server involved).
 *
 * It holds a read-only mirror of the signed-in user's profile and emergency contacts so that the
 * native Emergency Card works with no network, plus one value the user types on the phone itself
 * (a medical note) that is never uploaded. The server's SQLite database stays the source of truth:
 * [replaceSnapshot] overwrites the mirror each time the app syncs, and [clear] wipes everything on
 * logout so one person's data is never shown to the next person using the phone.
 */
class LocalDb(context: Context) : SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    data class Contact(val id: String, val name: String, val relationship: String, val phone: String, val priority: String)

    data class Snapshot(
        val owner: String?,
        val fullName: String?,
        val phone: String?,
        val bloodGroup: String?,
        val syncedAt: Long?,
        val contacts: List<Contact>,
    )

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE contacts (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 relationship TEXT NOT NULL,
                 phone TEXT NOT NULL,
                 priority TEXT NOT NULL
               )"""
        )
        db.execSQL("CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // v1 only so far. Future versions add columns with ALTER TABLE instead of dropping data.
    }

    /** Replaces the mirrored profile and contacts in a single transaction. */
    fun replaceSnapshot(owner: String, fullName: String?, phone: String?, bloodGroup: String?, contacts: List<Contact>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val previousOwner = getValue(db, KEY_OWNER)
            if (previousOwner != null && previousOwner != owner) {
                // A different account signed in on this phone: its note must not carry over.
                db.delete("kv", "k = ?", arrayOf(KEY_NOTE))
            }
            db.delete("contacts", null, null)
            for (c in contacts) {
                val values = ContentValues().apply {
                    put("id", c.id)
                    put("name", c.name)
                    put("relationship", c.relationship)
                    put("phone", c.phone)
                    put("priority", c.priority)
                }
                db.insertWithOnConflict("contacts", null, values, SQLiteDatabase.CONFLICT_REPLACE)
            }
            setValue(db, KEY_OWNER, owner)
            setValue(db, KEY_NAME, fullName)
            setValue(db, KEY_PHONE, phone)
            setValue(db, KEY_BLOOD, bloodGroup)
            setValue(db, KEY_SYNCED, System.currentTimeMillis().toString())
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun snapshot(): Snapshot {
        val db = readableDatabase
        val contacts = ArrayList<Contact>()
        db.rawQuery(
            "SELECT id, name, relationship, phone, priority FROM contacts " +
                "ORDER BY CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, name COLLATE NOCASE",
            null,
        ).use { c ->
            while (c.moveToNext()) {
                contacts.add(Contact(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4)))
            }
        }
        return Snapshot(
            owner = getValue(db, KEY_OWNER),
            fullName = getValue(db, KEY_NAME),
            phone = getValue(db, KEY_PHONE),
            bloodGroup = getValue(db, KEY_BLOOD),
            syncedAt = getValue(db, KEY_SYNCED)?.toLongOrNull(),
            contacts = contacts,
        )
    }

    fun note(): String = getValue(readableDatabase, KEY_NOTE) ?: ""

    /** The note stays on this phone only; it is the one local-only record the user can edit. */
    fun saveNote(text: String) {
        val db = writableDatabase
        if (text.isBlank()) db.delete("kv", "k = ?", arrayOf(KEY_NOTE)) else setValue(db, KEY_NOTE, text.trim())
    }

    fun clear() {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete("contacts", null, null)
            db.delete("kv", null, null)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun getValue(db: SQLiteDatabase, key: String): String? =
        db.rawQuery("SELECT v FROM kv WHERE k = ?", arrayOf(key)).use { if (it.moveToFirst()) it.getString(0) else null }

    private fun setValue(db: SQLiteDatabase, key: String, value: String?) {
        if (value.isNullOrBlank()) {
            db.delete("kv", "k = ?", arrayOf(key))
        } else {
            val values = ContentValues().apply {
                put("k", key)
                put("v", value)
            }
            db.insertWithOnConflict("kv", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
    }

    companion object {
        private const val DB_NAME = "safeher_local.db"
        private const val DB_VERSION = 1
        private const val KEY_OWNER = "owner"
        private const val KEY_NAME = "full_name"
        private const val KEY_PHONE = "phone"
        private const val KEY_BLOOD = "blood_group"
        private const val KEY_SYNCED = "synced_at"
        private const val KEY_NOTE = "medical_note"
    }
}
