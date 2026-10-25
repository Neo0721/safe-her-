package com.safeher.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.hardware.Sensor;
import android.hardware.SensorManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

/** JS bridge for the power-button SOS trigger (see {@link PowerTriggerService}). */
@CapacitorPlugin(
        name = "SosTrigger",
        permissions = {@Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")})
public class SosTriggerPlugin extends Plugin {

    // ------------------------------------------------------------------ control

    @PluginMethod
    public void start(PluginCall call) {
        int presses = clamp(call.getInt("presses", TriggerPrefs.DEFAULT_PRESSES), 3, 6);
        long windowMs = call.getInt("windowMs", (int) TriggerPrefs.DEFAULT_WINDOW_MS);
        if (!notificationsGranted()) {
            call.reject("Notification permission is required so Android lets SafeHer keep listening.", "NOTIFICATIONS_DENIED");
            return;
        }
        Context ctx = getContext();
        TriggerPrefs.save(ctx, true, presses, Math.max(2000L, Math.min(windowMs, 10000L)));
        try {
            applyService(ctx);
        } catch (Exception e) {
            call.reject("Android did not allow the trigger service to start: " + e.getMessage(), "START_FAILED");
            return;
        }
        call.resolve(statusObject(true));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        TriggerPrefs.save(ctx, false, TriggerPrefs.presses(ctx), TriggerPrefs.windowMs(ctx));
        try {
            applyService(ctx); // keeps running only if the fall check-in is still on
        } catch (Exception e) {
            // Nothing useful to do: the power trigger is already switched off in the stored settings.
        }
        call.resolve(statusObject(PowerTriggerService.isRunning()));
    }

    /** Opt-in fall / impact check-in. Requires an accelerometer and the notification permission. */
    @PluginMethod
    public void setMotionDetection(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        Context ctx = getContext();
        if (enabled) {
            if (!motionSensorAvailable()) {
                call.reject("This device has no accelerometer, so fall check-in is not available.", "NO_SENSOR");
                return;
            }
            if (!notificationsGranted()) {
                call.reject("Notification permission is required so SafeHer can ask if you are OK.", "NOTIFICATIONS_DENIED");
                return;
            }
        }
        TriggerPrefs.setMotionEnabled(ctx, enabled);
        try {
            applyService(ctx);
        } catch (Exception e) {
            TriggerPrefs.setMotionEnabled(ctx, false);
            call.reject("Android did not allow the background service to start: " + e.getMessage(), "START_FAILED");
            return;
        }
        call.resolve(statusObject(PowerTriggerService.isRunning()));
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject(PowerTriggerService.isRunning()));
    }

    /** Starts or stops the foreground service and its WorkManager health check to match the saved settings. */
    private void applyService(Context ctx) {
        if (TriggerPrefs.anyEnabled(ctx)) {
            ContextCompat.startForegroundService(
                    ctx, new Intent(ctx, PowerTriggerService.class).setAction(PowerTriggerService.ACTION_START));
            ProtectionCheckWorker.Companion.schedule(ctx);
        } else {
            ctx.stopService(new Intent(ctx, PowerTriggerService.class));
            ProtectionCheckWorker.Companion.cancel(ctx);
        }
    }

    private boolean motionSensorAvailable() {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null;
    }

    // ------------------------------------------------------------------ permissions / settings

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (notificationsGranted()) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsCallback");
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        openSettings(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            openSettings(call, new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getContext().getPackageName())));
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        openSettings(call, new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())));
    }

    private void openSettings(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the Android settings screen.", "SETTINGS_UNAVAILABLE");
        }
    }

    // ------------------------------------------------------------------ trigger delivery

    /** Called by MainActivity when the service launched the app. Retained until JS is listening. */
    void dispatchTrigger(String source) {
        JSObject data = new JSObject();
        data.put("source", source);
        data.put("at", System.currentTimeMillis());
        notifyListeners("sosTriggered", data, true);
    }

    // ------------------------------------------------------------------ helpers

    private boolean notificationsGranted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject statusObject(boolean running) {
        Context ctx = getContext();
        JSObject o = new JSObject();
        o.put("running", running);
        o.put("presses", TriggerPrefs.presses(ctx));
        o.put("notificationsGranted", notificationsGranted());
        o.put("motionEnabled", TriggerPrefs.motionEnabled(ctx));
        o.put("motionSensorAvailable", motionSensorAvailable());

        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        o.put("batteryUnrestricted", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));

        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            fullScreen = nm != null && nm.canUseFullScreenIntent();
        }
        o.put("fullScreenAllowed", fullScreen);
        // "Display over other apps" lets Android open the emergency screen straight away from the background.
        o.put("overlayAllowed", Settings.canDrawOverlays(ctx));
        return o;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
