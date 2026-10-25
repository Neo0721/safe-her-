import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/platform'

export interface ImageLabel {
  label: string
  confidence: number
}

export interface ClassifyResult {
  labels: ImageLabel[]
  elapsedMs: number
  engine: string
  imageWidth: number
  imageHeight: number
}

interface ImageClassifierNative {
  classify(options: { base64: string; minConfidence?: number }): Promise<ClassifyResult>
}

const native = registerPlugin<ImageClassifierNative>('ImageClassifier')

/** On-device image classification (ML Kit Image Labeling). Reports what the model saw; it never judges danger. */
export const imageClassifier = {
  available: () => isNativeApp(),

  async classify(base64: string, minConfidence = 0.5): Promise<ClassifyResult> {
    if (!isNativeApp()) {
      throw new Error('On-device image classification runs in the SafeHer Android app. Open the app on your phone or in Android Studio.')
    }
    return native.classify({ base64, minConfidence })
  },
}
