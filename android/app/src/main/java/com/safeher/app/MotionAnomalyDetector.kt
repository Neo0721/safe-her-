package com.safeher.app

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Explainable, rule-based fall / impact detector. This is NOT a machine-learning model.
 *
 * It reads the accelerometer and looks for the physical signature of a fall followed by the
 * person staying still:
 *
 *   1. FREE FALL : total acceleration drops below [FREE_FALL_MS2] (weightlessness) for at least
 *                  [FREE_FALL_MIN_MS].
 *   2. IMPACT    : within [IMPACT_WINDOW_MS] the acceleration spikes above [IMPACT_MS2].
 *   3. STILLNESS : after a short settle time, the device stays within [STILL_BAND_MS2] of
 *                  gravity (9.81 m/s^2) for [STILL_MS]. Any real movement cancels the detection.
 *
 * Only when all three happen does it call [Listener.onFallSuspected]. The caller must only ask
 * the user "are you OK?"; this class never contacts anyone. A dropped phone can look similar,
 * which is why a human confirmation is always required.
 */
class MotionAnomalyDetector(private val listener: Listener) : SensorEventListener {

    fun interface Listener {
        fun onFallSuspected(explanation: String)
    }

    private enum class Stage { IDLE, FREE_FALL, IMPACT }

    private var manager: SensorManager? = null
    private var stage = Stage.IDLE
    private var freeFallStartNs = 0L
    private var freeFallDurationMs = 0L
    private var freeFallEndNs = 0L
    private var impactNs = 0L
    private var impactPeak = 0f
    private var stillSinceNs = 0L
    private var lastTriggerNs = 0L

    /** True if this device has an accelerometer at all. */
    fun start(sensorManager: SensorManager): Boolean {
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return false
        manager = sensorManager
        reset()
        return sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        manager?.unregisterListener(this)
        manager = null
        reset()
    }

    private fun reset() {
        stage = Stage.IDLE
        freeFallStartNs = 0L
        stillSinceNs = 0L
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        val magnitude = sqrt(x * x + y * y + z * z)
        val t = event.timestamp // nanoseconds

        if (lastTriggerNs != 0L && t - lastTriggerNs < COOLDOWN_NS) return

        when (stage) {
            Stage.IDLE -> {
                if (magnitude < FREE_FALL_MS2) {
                    if (freeFallStartNs == 0L) freeFallStartNs = t
                    if ((t - freeFallStartNs) / NS_PER_MS >= FREE_FALL_MIN_MS) {
                        stage = Stage.FREE_FALL
                        freeFallDurationMs = (t - freeFallStartNs) / NS_PER_MS
                        freeFallEndNs = t
                    }
                } else {
                    freeFallStartNs = 0L
                }
            }

            Stage.FREE_FALL -> {
                if (magnitude < FREE_FALL_MS2) {
                    // Still falling: extend the free-fall phase.
                    freeFallDurationMs = (t - freeFallStartNs) / NS_PER_MS
                    freeFallEndNs = t
                } else if (magnitude > IMPACT_MS2) {
                    stage = Stage.IMPACT
                    impactNs = t
                    impactPeak = magnitude
                    stillSinceNs = 0L
                } else if ((t - freeFallEndNs) / NS_PER_MS > IMPACT_WINDOW_MS) {
                    reset() // weightlessness without an impact (e.g. a hop or a toss)
                }
            }

            Stage.IMPACT -> {
                if (magnitude > impactPeak) impactPeak = magnitude
                val sinceImpactMs = (t - impactNs) / NS_PER_MS
                if (sinceImpactMs < SETTLE_MS) return // bouncing/settling: ignore

                if (abs(magnitude - GRAVITY) <= STILL_BAND_MS2) {
                    if (stillSinceNs == 0L) stillSinceNs = t
                    val stillMs = (t - stillSinceNs) / NS_PER_MS
                    if (stillMs >= STILL_MS) {
                        lastTriggerNs = t
                        reset()
                        listener.onFallSuspected(
                            "Free fall for ${freeFallDurationMs} ms, then an impact of " +
                                "${"%.1f".format(impactPeak)} m/s², then no movement for ${STILL_MS / 1000} s."
                        )
                    }
                } else {
                    // Real movement after the impact (picked up, stood up, walked): not a fall.
                    reset()
                }
            }
        }
    }

    companion object {
        const val GRAVITY = 9.81f
        const val FREE_FALL_MS2 = 4.0f
        const val FREE_FALL_MIN_MS = 100L
        const val IMPACT_MS2 = 26.0f
        const val IMPACT_WINDOW_MS = 1000L
        const val SETTLE_MS = 1200L
        const val STILL_BAND_MS2 = 1.8f
        const val STILL_MS = 2500L
        private const val NS_PER_MS = 1_000_000L
        private const val COOLDOWN_NS = 120_000L * NS_PER_MS
    }
}
