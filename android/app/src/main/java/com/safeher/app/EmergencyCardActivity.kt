package com.safeher.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import java.text.DateFormat
import java.util.Date

/**
 * A second, fully native screen (XML layouts, no WebView): the Emergency Card.
 *
 * It reads the on-device SQLite mirror, so it opens instantly and works with no network. Calls go
 * through an ACTION_DIAL Intent, which opens the phone's dialer with the number filled in; the
 * person presses call, so the app never claims a call was placed.
 */
class EmergencyCardActivity : AppCompatActivity() {

    private lateinit var db: LocalDb
    private lateinit var noteField: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_emergency_card)
        // Light background: dark status-bar and navigation icons so the clock and battery stay readable.
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        db = LocalDb(this)
        noteField = findViewById(R.id.noteField)

        findViewById<Button>(R.id.closeButton).setOnClickListener { finish() }
        findViewById<Button>(R.id.callEmergencyButton).setOnClickListener { dial(EMERGENCY_NUMBER) }
        findViewById<Button>(R.id.saveNoteButton).setOnClickListener {
            db.saveNote(noteField.text.toString())
            Toast.makeText(this, R.string.card_note_saved, Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.openAppButton).setOnClickListener {
            // Explicit Intent back to the main (WebView) Activity; singleTask brings the existing one forward.
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
            finish()
        }
        bind()
    }

    override fun onResume() {
        super.onResume()
        bind()
    }

    private fun bind() {
        val snap = db.snapshot()
        val hasData = snap.owner != null
        findViewById<TextView>(R.id.cardName).text = snap.fullName ?: getString(R.string.card_unknown)
        findViewById<TextView>(R.id.cardBlood).text = getString(R.string.card_blood, snap.bloodGroup ?: getString(R.string.card_not_set))
        findViewById<TextView>(R.id.cardPhone).text = getString(R.string.card_phone, snap.phone ?: getString(R.string.card_not_set))
        findViewById<TextView>(R.id.cardSynced).text =
            if (snap.syncedAt != null) {
                getString(R.string.card_synced, DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(snap.syncedAt)))
            } else {
                getString(R.string.card_never_synced)
            }
        if (noteField.text.isNullOrEmpty()) noteField.setText(db.note())

        val list = findViewById<LinearLayout>(R.id.contactList)
        list.removeAllViews()
        val empty = findViewById<TextView>(R.id.contactsEmpty)
        empty.visibility = if (snap.contacts.isEmpty()) View.VISIBLE else View.GONE
        empty.setText(if (hasData) R.string.card_no_contacts else R.string.card_no_data)

        val inflater = LayoutInflater.from(this)
        for (contact in snap.contacts) {
            val row = inflater.inflate(R.layout.item_card_contact, list, false)
            row.findViewById<TextView>(R.id.contactName).text = contact.name
            row.findViewById<TextView>(R.id.contactDetail).text = "${contact.relationship} · ${contact.phone}"
            row.findViewById<Button>(R.id.contactCall).setOnClickListener { dial(contact.phone) }
            list.addView(row)
        }
    }

    private fun dial(number: String) {
        val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null))
        try {
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, R.string.card_no_dialer, Toast.LENGTH_LONG).show()
        }
    }

    companion object {
        const val EXTRA_OPENED_FROM = "opened_from"
        /** India's single emergency number; the dialer opens, the person decides whether to call. */
        private const val EMERGENCY_NUMBER = "112"
    }
}
