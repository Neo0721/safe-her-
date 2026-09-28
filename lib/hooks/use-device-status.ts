'use client'

import { useEffect, useState } from 'react'
import { Device } from '@capacitor/device'
import { Network } from '@capacitor/network'

/** Real battery level from the device. `null` means the platform does not expose it. */
export function useBattery(): { level: number | null; charging: boolean | null; ready: boolean } {
  const [state, setState] = useState<{ level: number | null; charging: boolean | null; ready: boolean }>({
    level: null,
    charging: null,
    ready: false,
  })

  useEffect(() => {
    let active = true
    const read = async () => {
      try {
        const info = await Device.getBatteryInfo()
        if (!active) return
        const level = typeof info.batteryLevel === 'number' ? Math.round(info.batteryLevel * 100) : null
        setState({ level, charging: info.isCharging ?? null, ready: true })
      } catch {
        if (active) setState({ level: null, charging: null, ready: true })
      }
    }
    void read()
    const timer = setInterval(read, 60000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return state
}

/** Real connectivity state. */
export function useNetwork(): { connected: boolean | null; type: string | null } {
  const [state, setState] = useState<{ connected: boolean | null; type: string | null }>({
    connected: null,
    type: null,
  })

  useEffect(() => {
    let active = true
    let remove: (() => void) | null = null

    Network.getStatus()
      .then((s) => active && setState({ connected: s.connected, type: s.connectionType }))
      .catch(() => active && setState({ connected: typeof navigator !== 'undefined' ? navigator.onLine : null, type: null }))

    Network.addListener('networkStatusChange', (s) => setState({ connected: s.connected, type: s.connectionType }))
      .then((handle) => {
        if (active) remove = () => void handle.remove()
        else void handle.remove()
      })
      .catch(() => {})

    return () => {
      active = false
      remove?.()
    }
  }, [])

  return state
}
