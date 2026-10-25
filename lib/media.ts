import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { apiFetch, apiJson, ApiError } from '@/lib/api-fetch'
import { isNativeApp } from '@/lib/platform'

/** Photo capture and evidence-media helpers (camera, gallery, authenticated upload). */

export type MediaKind = 'photo' | 'audio' | 'video'

export interface MediaItem {
  id: string
  sos_event_id: string | null
  kind: MediaKind
  mime_type: string
  size_bytes: number
  created_at: string
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export type PhotoErrorCode = 'cancelled' | 'denied' | 'unavailable'

export class PhotoError extends Error {
  constructor(
    public code: PhotoErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PhotoError'
  }
}

function toPhotoError(error: unknown): PhotoError {
  if (error instanceof PhotoError) return error
  const message = String((error as { message?: string })?.message ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('cancel') || lower.includes('no image picked')) return new PhotoError('cancelled', 'No photo was taken.')
  if (lower.includes('denied') || lower.includes('permission')) {
    return new PhotoError('denied', 'Camera or photo access is blocked. Allow it for SafeHer in your phone settings.')
  }
  return new PhotoError('unavailable', message || 'The camera is not available on this device.')
}

/** Browser fallback: opens the file chooser (with the camera on phones) and resolves with the picked image. */
function pickFromBrowser(capture: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (capture) input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) resolve(file)
      else reject(new PhotoError('cancelled', 'No photo was selected.'))
    }
    input.addEventListener('cancel', () => reject(new PhotoError('cancelled', 'No photo was selected.')))
    input.click()
  })
}

/**
 * Takes a photo with the camera or picks one from the gallery. On Android this uses the Capacitor
 * Camera plugin (system camera / photo picker, so only the chosen image is shared with the app).
 */
export async function getPhoto(source: 'camera' | 'gallery'): Promise<Blob> {
  if (!isNativeApp()) return pickFromBrowser(source === 'camera')
  try {
    if (source === 'camera') {
      const status = await Camera.checkPermissions()
      if (status.camera !== 'granted') {
        const next = await Camera.requestPermissions({ permissions: ['camera'] })
        if (next.camera !== 'granted') throw new PhotoError('denied', 'Camera access is blocked. Allow it for SafeHer in your phone settings.')
      }
    }
    const photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 80,
      width: 1600,
      height: 1600,
      correctOrientation: true,
      saveToGallery: false,
    })
    if (!photo.webPath) throw new PhotoError('unavailable', 'The camera returned no image.')
    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    return new Blob([blob], { type: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg' })
  } catch (error) {
    throw toPhotoError(error)
  }
}

/**
 * Records a short video with the camera app, or picks one from the gallery. This goes through the
 * system file chooser (Capacitor's WebView launches the camera app for `capture`), so the app only
 * receives the clip the person chose. Clips over the upload limit are rejected before upload.
 */
export function getVideo(source: 'camera' | 'gallery'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'
    if (source === 'camera') input.setAttribute('capture', 'environment')
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) resolve(file)
      else reject(new PhotoError('cancelled', 'No video was selected.'))
    }
    input.addEventListener('cancel', () => reject(new PhotoError('cancelled', 'No video was selected.')))
    input.click()
  })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

// ------------------------------------------------------------------------------- upload

export async function uploadMedia(kind: MediaKind, blob: Blob, sosEventId?: string): Promise<MediaItem> {
  const type = (blob.type || '').split(';')[0].trim().toLowerCase()
  if (!type) throw new ApiError(400, 'The file type could not be determined.')
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, `This file is ${formatBytes(blob.size)} and the upload limit is 8 MB.${kind === 'video' ? ' Record a shorter clip or lower the camera quality.' : ''}`)
  }
  const query = `kind=${kind}${sosEventId ? `&sos_event_id=${encodeURIComponent(sosEventId)}` : ''}`
  const response = await apiFetch(`/api/media?${query}`, { method: 'POST', body: blob, headers: { 'Content-Type': type } })
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    /* non-JSON body */
  }
  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; code?: string }
    throw new ApiError(response.status, body.error || `Upload failed (${response.status}).`, body.code)
  }
  return data as MediaItem
}

export const listMedia = () => apiJson<MediaItem[]>('/api/media')

export async function fetchMediaBlob(id: string): Promise<Blob> {
  const response = await apiFetch(`/api/media?id=${encodeURIComponent(id)}`)
  if (!response.ok) throw new ApiError(response.status, 'Could not load this item.')
  return response.blob()
}

export const deleteMedia = (id: string) => apiJson(`/api/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' })

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
}

/**
 * Downloads one of the user's own uploads. In a browser this saves a file; in the Android app the
 * file is written to the app cache and the system share sheet opens so the person chooses where
 * it goes (Files, Drive, a messaging app...). Nothing is shared unless they pick a destination.
 */
/** Deletes evidence copies left in the app cache by earlier downloads (native only). Best effort. */
export async function purgeSharedCache(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache })
    await Promise.all(
      files
        .filter((f) => f.name.startsWith('safeher-') && /\.(jpg|png|webp|webm|m4a|ogg|mp3|aac|mp4|3gp|mov)$/.test(f.name))
        .map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => undefined))
    )
  } catch {
    /* nothing to clean */
  }
}

export async function downloadMedia(item: Pick<MediaItem, 'id' | 'kind' | 'mime_type' | 'created_at'>): Promise<'saved' | 'shared'> {
  await purgeSharedCache() // the previous download has already been handed to its destination
  const blob = await fetchMediaBlob(item.id)
  const ext = EXTENSIONS[item.mime_type] ?? 'bin'
  const stamp = item.created_at.slice(0, 19).replace(/[-:T]/g, '')
  const name = `safeher-${item.kind}-${stamp}.${ext}`

  if (isNativeApp()) {
    const written = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache })
    await Share.share({ title: 'SafeHer evidence', files: [written.uri], dialogTitle: 'Save or send this file' })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
