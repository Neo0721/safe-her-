export const CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'SafeHer',
  emergencyNumber: process.env.NEXT_PUBLIC_EMERGENCY_NUMBER || '112',
  locationUpdateIntervalMs: Number(process.env.NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL_MS) || 5000,
  locationMinDistanceMeters: Number(process.env.NEXT_PUBLIC_LOCATION_MIN_DISTANCE_METERS) || 5,
  // How long a real SOS must run before it can be ended (guards against a panicked mis-tap).
  sosCancelDelaySeconds: Number(process.env.NEXT_PUBLIC_SOS_CANCEL_DELAY_SECONDS ?? 10),
}
