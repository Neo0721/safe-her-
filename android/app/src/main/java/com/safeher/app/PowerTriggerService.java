package com.safeher.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.ArrayDeque;

/**
 * Listens for rapid power-button presses.
 *
 * Android never delivers the power key to apps, but every press toggles the screen, which does
 * broadcast ACTION_SCREEN_ON / ACTION_SCREEN_OFF. When {@code presses} toggles happen within
 * {@code windowMs}, the SOS trigger fires: the phone vibrates and SafeHer's emergency screen opens
 * (also over the lock screen). Runs as a foreground service so Android keeps it alive.
 */
public class PowerTriggerService extends Service {
    private static final String TAG = "PowerTriggerService";

    public static final String ACTION_START = "com.safeher.app.action.START_TRIGGER";
    public static final String ACTION_SOS = "com.safeher.app.action.SOS_TRIGGERED";
    /** The user tapped "Get help" on a fall check-in. Opens the emergency screen; nobody is contacted. */
    public static final String ACTION_MOTION = "com.safeher.app.action.MOTION_CONFIRMED";
    /** The user tapped "I'm OK" on a fall check-in. */
    public static final String ACTION_MOTION_OK = "com.safeher.app.action.MOTION_OK";
    public static final String CHANNEL_PROTECTION = "protection";
    public static final String CHANNEL_ALERT = "sos_alert";
    public static final String CHANNEL_CHECKIN = "safety_checkin";
    public static final String CHANNEL_STATUS = "protection_status";

    private static final int NOTIF_PROTECTION = 4101;
    private static final int NOTIF_ALERT = 4102;
    private static final int NOTIF_CHECKIN = 4104;
    /** Ignore further triggers for a while so one burst can never fire twice. */
    private static final long COOLDOWN_MS = 20_000L;

    private static volatile boolean running = false;

    private final ArrayDeque<Long> presses = new ArrayDeque<>();
    private long lastTriggerAt = 0L;
    private BroadcastReceiver screenReceiver;
    private MotionAnomalyDetector motion;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_MOTION_OK.equals(intent.getAction())) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIF_CHECKIN);
            if (!running) {
                stopSelf();
                return START_NOT_STICKY;
            }
            return START_STICKY;
        }

        boolean powerOn = TriggerPrefs.isEnabled(this);
        boolean motionOn = TriggerPrefs.motionEnabled(this);
        if (!powerOn && !motionOn) {
            // Disabled while the service was being (re)started: do not keep a stale notification.
            stopMotion();
            unregisterScreenReceiver();
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }
        startAsForeground(powerOn, motionOn);
        if (powerOn) registerScreenReceiver();
        else unregisterScreenReceiver();
        if (motionOn) startMotion();
        else stopMotion();
        running = true;
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopMotion();
        unregisterScreenReceiver();
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---------------------------------------------------------------- detection

    private void registerScreenReceiver() {
        if (screenReceiver != null) return;
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (Intent.ACTION_SCREEN_ON.equals(action) || Intent.ACTION_SCREEN_OFF.equals(action)) {
                    onScreenToggled();
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(screenReceiver, filter);
    }

    private void unregisterScreenReceiver() {
        if (screenReceiver == null) return;
        try {
            unregisterReceiver(screenReceiver);
        } catch (IllegalArgumentException ignored) {
            // already unregistered
        }
        screenReceiver = null;
    }

    private void onScreenToggled() {
        long now = SystemClock.elapsedRealtime();
        long window = TriggerPrefs.windowMs(this);
        int needed = TriggerPrefs.presses(this);

        presses.addLast(now);
        while (!presses.isEmpty() && now - presses.peekFirst() > window) presses.pollFirst();

        Log.d(TAG, "screen toggle " + presses.size() + "/" + needed);
        if (presses.size() >= needed && now - lastTriggerAt > COOLDOWN_MS) {
            lastTriggerAt = now;
            presses.clear();
            fireTrigger();
        }
    }

    // ---------------------------------------------------------------- trigger

    private void fireTrigger() {
        Log.i(TAG, "power-button SOS trigger fired");
        vibrate();
        wakeScreen();

        Intent open = new Intent(this, MainActivity.class)
                .setAction(ACTION_SOS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Full-screen intent shows the emergency screen over the lock screen where Android allows it;
        // otherwise the user still gets a loud heads-up notification they can tap.
        Notification alert = new NotificationCompat.Builder(this, CHANNEL_ALERT)
                .setSmallIcon(R.drawable.ic_stat_sos)
                .setContentTitle("SOS triggered")
                .setContentText("Opening SafeHer's emergency screen. Tap if it does not open.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pending, true)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(NOTIF_ALERT, alert);
            } catch (SecurityException e) {
                Log.w(TAG, "notification not permitted", e);
            }
        }

        try {
            startActivity(open); // works when Android's background-start rules allow it
        } catch (Exception e) {
            Log.w(TAG, "direct activity start blocked; relying on the notification", e);
        }
    }

    /**
     * An even number of presses leaves the screen off, so wake it explicitly. The wake lock is only held
     * briefly: long enough for the emergency screen to take over with its own keep-screen-on flags.
     */
    @SuppressWarnings("deprecation")
    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            PowerManager.WakeLock lock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "SafeHer:sosTrigger");
            lock.acquire(15_000L);
        } catch (Exception e) {
            Log.w(TAG, "could not wake the screen", e);
        }
    }

    private void vibrate() {
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        long[] pattern = {0, 250, 120, 250, 120, 500};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            v.vibrate(pattern, -1);
        }
    }

    // ---------------------------------------------------------------- fall / impact check-in

    private void startMotion() {
        if (motion != null) return;
        SensorManager sm = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sm == null) return;
        MotionAnomalyDetector detector = new MotionAnomalyDetector(this::showFallCheckIn);
        if (detector.start(sm)) {
            motion = detector;
        } else {
            Log.w(TAG, "no accelerometer available; fall check-in is inactive");
        }
    }

    private void stopMotion() {
        if (motion == null) return;
        motion.stop();
        motion = null;
    }

    /**
     * The detector saw a fall-like impact followed by stillness. This only asks the user whether they
     * are OK. It never calls, texts, or starts an SOS by itself: the user chooses "Get help".
     */
    private void showFallCheckIn(String explanation) {
        Log.i(TAG, "fall check-in raised: " + explanation);
        vibrate();

        Intent help = new Intent(this, MainActivity.class)
                .setAction(ACTION_MOTION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent helpPending = PendingIntent.getActivity(
                this, 3, help, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent okPending = PendingIntent.getService(
                this, 4, new Intent(this, PowerTriggerService.class).setAction(ACTION_MOTION_OK),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent openPending = PendingIntent.getActivity(
                this, 5, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, CHANNEL_CHECKIN)
                .setSmallIcon(R.drawable.ic_stat_sos)
                .setContentTitle("Are you OK?")
                .setContentText("SafeHer noticed a fall-like impact followed by stillness.")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(
                        "SafeHer noticed a fall-like impact followed by stillness (" + explanation + "). "
                                + "Nothing has been sent to anyone. Tap Get help to open the emergency screen."))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openPending)
                .addAction(0, "I'm OK", okPending)
                .addAction(0, "Get help", helpPending)
                .setAutoCancel(true)
                .setTimeoutAfter(5 * 60_000L)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(NOTIF_CHECKIN, n);
            } catch (SecurityException e) {
                Log.w(TAG, "notification not permitted", e);
            }
        }
    }

    // ---------------------------------------------------------------- foreground notification

    private void startAsForeground(boolean powerOn, boolean motionOn) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        StringBuilder text = new StringBuilder();
        if (powerOn) text.append("Press the power button ").append(TriggerPrefs.presses(this)).append(" times quickly to start an SOS.");
        if (powerOn && motionOn) text.append(' ');
        if (motionOn) text.append("Fall check-in is on (it only asks if you are OK).");
        Notification n = new NotificationCompat.Builder(this, CHANNEL_PROTECTION)
                .setSmallIcon(R.drawable.ic_stat_sos)
                .setContentTitle(powerOn && motionOn ? "SafeHer protection is on" : powerOn ? "SafeHer quick trigger is on" : "SafeHer fall check-in is on")
                .setContentText(text.toString())
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text.toString()))
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(pending)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_PROTECTION, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_PROTECTION, n);
        }
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel protection = new NotificationChannel(
                CHANNEL_PROTECTION, "Quick trigger", NotificationManager.IMPORTANCE_LOW);
        protection.setDescription("Shown while SafeHer is listening for the power-button emergency trigger.");
        protection.setShowBadge(false);
        nm.createNotificationChannel(protection);

        NotificationChannel alert = new NotificationChannel(
                CHANNEL_ALERT, "SOS alerts", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("Appears when the power-button trigger starts an SOS.");
        alert.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alert.enableVibration(true);
        nm.createNotificationChannel(alert);

        NotificationChannel checkin = new NotificationChannel(
                CHANNEL_CHECKIN, "Fall check-ins", NotificationManager.IMPORTANCE_HIGH);
        checkin.setDescription("Asks if you are OK after SafeHer detects a fall-like impact. It never contacts anyone.");
        checkin.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        checkin.enableVibration(true);
        nm.createNotificationChannel(checkin);

        NotificationChannel status = new NotificationChannel(
                CHANNEL_STATUS, "Protection status", NotificationManager.IMPORTANCE_DEFAULT);
        status.setDescription("Tells you if Android paused SafeHer's background protection.");
        status.setShowBadge(false);
        nm.createNotificationChannel(status);
    }
}
