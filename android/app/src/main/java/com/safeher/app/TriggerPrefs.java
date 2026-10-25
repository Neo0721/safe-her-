package com.safeher.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Native-side copy of the power-button trigger settings, so the service can restart after a reboot. */
final class TriggerPrefs {
    private static final String FILE = "safeher_trigger";
    static final int DEFAULT_PRESSES = 5;
    static final long DEFAULT_WINDOW_MS = 5000L;

    private TriggerPrefs() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context c) {
        return prefs(c).getBoolean("enabled", false);
    }

    /** Opt-in fall / impact check-in (accelerometer). */
    static boolean motionEnabled(Context c) {
        return prefs(c).getBoolean("motionEnabled", false);
    }

    static void setMotionEnabled(Context c, boolean enabled) {
        prefs(c).edit().putBoolean("motionEnabled", enabled).apply();
    }

    /** True when the foreground service has anything to do. */
    static boolean anyEnabled(Context c) {
        return isEnabled(c) || motionEnabled(c);
    }

    static int presses(Context c) {
        return prefs(c).getInt("presses", DEFAULT_PRESSES);
    }

    static long windowMs(Context c) {
        return prefs(c).getLong("windowMs", DEFAULT_WINDOW_MS);
    }

    static void save(Context c, boolean enabled, int presses, long windowMs) {
        prefs(c).edit().putBoolean("enabled", enabled).putInt("presses", presses).putLong("windowMs", windowMs).apply();
    }
}
