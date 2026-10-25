package com.safeher.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

/** Restarts the power-button trigger after a reboot, if the user had it switched on. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (!TriggerPrefs.anyEnabled(context)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return; // without the notification the service cannot be shown as foreground
        }
        try {
            ContextCompat.startForegroundService(
                    context, new Intent(context, PowerTriggerService.class).setAction(PowerTriggerService.ACTION_START));
        } catch (Exception e) {
            Log.w("BootReceiver", "could not restart the power-button trigger", e);
        }
    }
}
