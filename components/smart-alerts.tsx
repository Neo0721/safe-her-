'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { sampleBattery } from '@/lib/battery-log'
import { fitBatteryDrain, formatDuration, minutesUntil } from '@/lib/insights'
import { isSmartAlertsEnabled, notifyBatteryForecast } from '@/lib/smart-alerts'
import { isNativeApp } from '@/lib/platform'

const SAMPLE_EVERY_MS = 5 * 60_000

/**
 * Smart alerts (opt-in, on-device): while the app is open it records real battery readings and,
 * if the fitted trend says the battery will run out soon, shows a local notification. Nothing is
 * sent to a server and no contact is ever alerted. Renders nothing.
 */
export function SmartAlerts() {
  const { user } = useAuth()
  const uid = user?.uid

  useEffect(() => {
    if (!uid || !isNativeApp()) return
    let stopped = false
    const tick = async () => {
      if (stopped || !isSmartAlertsEnabled()) return
      const reading = await sampleBattery()
      if (!reading || reading.charging) return
      const fit = fitBatteryDrain(reading.log)
      if (!fit) return
      const minutes = minutesUntil(reading.level, 10, fit)
      if (minutes !== null && minutes <= 45) {
        await notifyBatteryForecast(reading.level, formatDuration(minutes))
      }
    }
    void tick()
    const timer = setInterval(tick, SAMPLE_EVERY_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [uid])

  return null
}
