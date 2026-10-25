package com.safeher.app

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Deferrable background check (WorkManager, every ~15 minutes, only when the battery is not low).
 *
 * If the user has switched protection on (power-button trigger and/or fall check-in) but Android
 * stopped the foreground service (OEM battery savers, app updates, memory pressure), this tries to
 * bring it back. Android 12+ forbids starting a foreground service from the background in most
 * cases; when that is refused the worker posts a quiet "protection paused" notification instead,
 * so the user knows to reopen SafeHer rather than assuming they are protected.
 *
 * It never triggers an SOS, call, or message.
 */
class ProtectionCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val ctx = applicationContext
        if (!TriggerPrefs.anyEnabled(ctx) || PowerTriggerService.isRunning()) return Result.success()

        val notificationsAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (!notificationsAllowed) return Result.success() // user revoked notifications: respect it

        try {
            ContextCompat.startForegroundService(
                ctx, Intent(ctx, PowerTriggerService::class.java).setAction(PowerTriggerService.ACTION_START)
            )
        } catch (e: Exception) {
            Log.w(TAG, "could not restart the protection service from the background", e)
            postPausedNotification(ctx)
        }
        return Result.success()
    }

    private fun postPausedNotification(ctx: Context) {
        PowerTriggerService.createChannels(ctx)
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(ctx, 2, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(ctx, PowerTriggerService.CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_stat_sos)
            .setContentTitle("SafeHer protection is paused")
            .setContentText("Android stopped the quick trigger. Tap to open SafeHer and turn it back on.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        try {
            nm.notify(NOTIF_PAUSED, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "notification not permitted", e)
        }
    }

    companion object {
        private const val TAG = "ProtectionCheckWorker"
        private const val UNIQUE_NAME = "safeher_protection_check"
        private const val NOTIF_PAUSED = 4103

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<ProtectionCheckWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiresBatteryNotLow(true).build())
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniquePeriodicWork(UNIQUE_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context.applicationContext).cancelUniqueWork(UNIQUE_NAME)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIF_PAUSED)
        }
    }
}
