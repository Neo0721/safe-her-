# Power-button quick trigger

Press the power button N times quickly (3–6, default 5) and SafeHer starts an SOS without unlocking the phone.

## How it works

Android **never delivers the power key to apps** (not even with an Accessibility Service). What an app *can* see is that every power press toggles the screen, which broadcasts `ACTION_SCREEN_ON` / `ACTION_SCREEN_OFF`. SafeHer counts those toggles:

1. Settings → SOS settings → **Quick trigger** saves `power_trigger` / `power_presses` in SQLite (`sos_settings`).
2. The native plugin (`SosTriggerPlugin`) starts `PowerTriggerService`, a **foreground service** with a small ongoing notification. Android keeps foreground services alive far more reliably than background ones.
3. The service counts screen toggles. N toggles within 5 seconds fires the trigger (then a 20 s cool-down so one burst can't fire twice).
4. On trigger it vibrates, wakes the screen, and opens `MainActivity` over the lock screen (the phone stays locked). The web app routes to `/emergency?start=1&source=power`, which records the SOS with `trigger_source = 'power'`.
5. After a reboot, `BootReceiver` restarts the service if the trigger was on.

Because the *screen toggle* is what's counted, the press that turns the screen off counts too. With the screen on, 5 presses = off, on, off, on, off.

## What the user must allow (shown live in Settings)

| Check | Why |
|---|---|
| Notifications | Android requires a visible notification for a foreground service (13+ also needs the runtime permission) |
| Battery restrictions: "Unrestricted" | Aggressive OEM battery savers (Xiaomi, Oppo, Vivo, Samsung "sleeping apps") can stop the service otherwise |
| "Display over other apps" | Lets Android open SafeHer instantly from the background. Without it the SOS opens from a heads-up notification the user taps |
| Full-screen intents (Android 14+) | Lets the alert open over the lock screen |

## Limitations (be upfront with users)

- It is **best effort**, not guaranteed. A phone that force-stops the app, a full battery-saver mode, or a user "swiping away" the app on some OEM skins can stop it. Test it on the exact phone model.
- Android's built-in **Emergency SOS** (Pixel/Samsung: press power 5×) is more reliable because it lives in the OS. Recommend users enable it too; SafeHer's value is the recorded GPS trail and one-screen call/SMS shortcuts.
- It counts screen toggles, so unusual screen-wake sources (a notification lighting the screen, a wake-on-lift feature) in the same 5 s window could contribute. The 3–6 press range and cool-down keep false triggers rare, but not impossible. Every trigger can be ended as "Accidental trigger" and is logged as a power-button SOS.
- While locked, the SOS screen shows over the lock screen. Only the emergency flow is launched, but the app session is signed in; a user who wants zero exposure can disable the trigger.
- Google Play restricts `SYSTEM_ALERT_WINDOW` and special-use foreground services. For Play distribution you must justify both in the policy declaration (an emergency-safety use case qualifies). Sideloaded/internal builds are unaffected.

## Other trigger ideas (not implemented)

- **Shake to SOS**: accelerometer in the same foreground service; needs careful thresholds to avoid walking/running false positives.
- **Volume-button pattern**: only possible with an Accessibility Service (heavy permission and Play review burden).
- **Lock-screen widget / Quick Settings tile**: a one-tap tile that opens the SOS hold screen. Cheap to add and very reliable.
- **Wearable / Bluetooth button**: an inexpensive hardware button paired to the phone.
- **Fake-call + silent check-in timer**: "Check in within 30 min or alert my circle" needs a server-side scheduler and an SMS provider; today SafeHer deliberately only opens the dialer/SMS app.

## Testing on an emulator

```bash
# app in the background, trigger service running, then 4 rapid presses (if set to 4×)
adb shell input keyevent 3
for i in 1 2 3 4; do adb shell input keyevent 26; sleep 0.5; done
adb logcat -d | grep PowerTriggerService
```
