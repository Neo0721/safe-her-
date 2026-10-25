package com.safeher.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Posts an ordinary, immediate notification on this phone for the app's opt-in "smart alerts"
 * (for example "battery may run out soon"). It never schedules alarms, never contacts anyone and
 * needs only the notification permission.
 *
 * JS: `SmartAlert.checkPermission / requestPermission / notify({ id, title, body })`.
 */
@CapacitorPlugin(
    name = "SmartAlert",
    permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")],
)
class SmartAlertPlugin : Plugin() {

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        call.resolve(JSObject().put("display", permissionState()))
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (permissionState() == "granted" || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(JSObject().put("display", permissionState()))
        } else {
            requestPermissionForAlias("notifications", call, "permissionResult")
        }
    }

    @PermissionCallback
    private fun permissionResult(call: PluginCall) {
        call.resolve(JSObject().put("display", permissionState()))
    }

    @PluginMethod
    fun notify(call: PluginCall) {
        val title = call.getString("title")
        val body = call.getString("body")
        if (title.isNullOrBlank() || body.isNullOrBlank()) {
            call.reject("title and body are required.", "BAD_REQUEST")
            return
        }
        if (permissionState() != "granted") {
            call.reject("Notifications are not allowed for SafeHer.", "PERMISSION_DENIED")
            return
        }
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Smart alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Helpful heads-ups generated on this phone, such as a low-battery forecast."
                }
            )
        }
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_sos)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(call.getInt("id", DEFAULT_ID) ?: DEFAULT_ID, notification)
            call.resolve()
        } catch (e: SecurityException) {
            // The permission can be revoked between the check above and this call.
            call.reject("Notifications are not allowed for SafeHer.", "PERMISSION_DENIED")
        }
    }

    private fun permissionState(): String {
        val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            return if (granted && enabled) "granted" else if (getPermissionState("notifications") == PermissionState.DENIED) "denied" else "prompt"
        }
        return if (enabled) "granted" else "denied"
    }

    companion object {
        private const val CHANNEL = "smart_alerts"
        private const val DEFAULT_ID = 7101
    }
}
