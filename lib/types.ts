export type Priority = 'High' | 'Medium' | 'Low'

export interface Contact {
  id: string
  name: string
  relationship: string
  phone: string
  email: string | null
  priority: Priority
}

export interface SosSettings {
  hold_duration: number
  location_sharing: number
  audio_recording: number
  notify_contacts: number
  power_trigger: number
  power_presses: number
  motion_detection: number
}

export interface SosEvent {
  id: string
  started_at: string
  ended_at: string | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  status: 'Active' | 'Completed' | 'Cancelled' | 'Failed' | string
  is_test: number
  trigger_source?: 'hold' | 'power' | string
  points_count?: number
  actions_count?: number
}

export interface ActivityLog {
  id: string
  type: string
  title: string
  detail: string | null
  created_at: string
}
