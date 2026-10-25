import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

export interface ScanBlock {
  text: string
  lines: string[]
}

export interface ScanResult {
  text: string
  blocks: ScanBlock[]
  lineCount: number
  elapsedMs: number
  engine: string
  script: 'latin' | 'devanagari'
  imageWidth: number
  imageHeight: number
}


interface TextScannerNative {
  recognize(options: { base64: string; script?: 'latin' | 'devanagari' }): Promise<ScanResult>
}

const native = registerPlugin<TextScannerNative>('TextScanner')

export const textScanner = {
  available: () => isNativeApp(),

  async recognize(base64: string, script: 'latin' | 'devanagari' = 'latin'): Promise<ScanResult> {
    if (!isNativeApp()) {
      throw new Error(
        'On-device ML Kit text recognition runs in the SafeHer Android app. Open the app on your phone or in Android Studio to scan.'
      )
    }
    return native.recognize({ base64, script })
  },
}

export { extractEmergencyInfo, type EmergencyInfoSummary } from '@/lib/emergency-info'
