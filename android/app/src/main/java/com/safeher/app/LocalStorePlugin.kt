package com.safeher.app

import android.content.Intent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Bridge to the on-device SQLite mirror ([LocalDb]) and the native Emergency Card screen.
 *
 * JS: `LocalStore.saveSnapshot / getSnapshot / clear / openEmergencyCard`.
 * Nothing here talks to the network; the web layer decides when to copy server data in.
 */
@CapacitorPlugin(name = "LocalStore")
class LocalStorePlugin : Plugin() {

    private val db: LocalDb by lazy { LocalDb(context) }

    @PluginMethod
    fun saveSnapshot(call: PluginCall) {
        val owner = call.getString("owner")
        if (owner.isNullOrBlank()) {
            call.reject("owner is required.", "NO_OWNER")
            return
        }
        val contacts = ArrayList<LocalDb.Contact>()
        val array = call.getArray("contacts") ?: JSArray()
        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            val id = item.optString("id")
            val name = item.optString("name")
            val phone = item.optString("phone")
            if (id.isBlank() || name.isBlank() || phone.isBlank()) continue
            contacts.add(
                LocalDb.Contact(id, name, item.optString("relationship"), phone, item.optString("priority", "High"))
            )
        }
        try {
            db.replaceSnapshot(
                owner = owner,
                fullName = call.getString("fullName"),
                phone = call.getString("phone"),
                bloodGroup = call.getString("bloodGroup"),
                contacts = contacts,
            )
            val out = JSObject()
            out.put("contacts", contacts.size)
            call.resolve(out)
        } catch (e: Exception) {
            call.reject("Could not save to the on-device database.", "DB_ERROR")
        }
    }

    @PluginMethod
    fun getSnapshot(call: PluginCall) {
        try {
            val snap = db.snapshot()
            val contacts = JSArray()
            for (c in snap.contacts) {
                val o = JSObject()
                o.put("id", c.id)
                o.put("name", c.name)
                o.put("relationship", c.relationship)
                o.put("phone", c.phone)
                o.put("priority", c.priority)
                contacts.put(o)
            }
            val out = JSObject()
            out.put("owner", snap.owner)
            out.put("fullName", snap.fullName)
            out.put("phone", snap.phone)
            out.put("bloodGroup", snap.bloodGroup)
            out.put("syncedAt", snap.syncedAt)
            out.put("contacts", contacts)
            out.put("note", db.note())
            call.resolve(out)
        } catch (e: Exception) {
            call.reject("Could not read the on-device database.", "DB_ERROR")
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        try {
            db.clear()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not clear the on-device database.", "DB_ERROR")
        }
    }

    /** Explicit Intent: starts the native [EmergencyCardActivity] (a separate screen with its own XML layout). */
    @PluginMethod
    fun openEmergencyCard(call: PluginCall) {
        val intent = Intent(context, EmergencyCardActivity::class.java)
        intent.putExtra(EmergencyCardActivity.EXTRA_OPENED_FROM, "web")
        activity.startActivity(intent)
        call.resolve()
    }
}
