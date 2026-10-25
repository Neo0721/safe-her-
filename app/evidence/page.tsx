'use client'

import { Camera as CameraIcon, CheckCircle2, Download, Image as ImageIcon, Loader2, Mic, Play, Square, Trash2, UploadCloud, Video, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { useAuth } from '@/contexts/AuthContext'
import { errorMessage } from '@/lib/api-fetch'
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder'
import {
  PhotoError,
  deleteMedia,
  downloadMedia,
  fetchMediaBlob,
  formatBytes,
  getPhoto,
  getVideo,
  MAX_UPLOAD_BYTES,
  listMedia,
  uploadMedia,
  type MediaItem,
} from '@/lib/media'
import { cn } from '@/lib/utils'

function clock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function EvidencePage() {
  const { user } = useAuth()

  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [video, setVideo] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<null | 'photo' | 'audio' | 'video'>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const audio = useAudioRecorder()

  const [items, setItems] = useState<MediaItem[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [preview, setPreview] = useState<{ id: string; url: string; kind: 'photo' | 'audio' | 'video' } | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setListError(null)
    try {
      setItems(await listMedia())
    } catch (error) {
      setListError(errorMessage(error))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (user) void refresh()
  }, [user, refresh])

  // Object URLs must be released.
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview])
  useEffect(() => () => void (videoUrl && URL.revokeObjectURL(videoUrl)), [videoUrl])

  const captureVideo = async (source: 'camera' | 'gallery') => {
    setVideoError(null)
    try {
      const blob = await getVideo(source)
      if (blob.size > MAX_UPLOAD_BYTES) {
        setVideoError(`That clip is ${formatBytes(blob.size)}; the upload limit is 8 MB. Record a shorter clip.`)
        return
      }
      setVideo(blob)
      setVideoUrl(URL.createObjectURL(blob))
    } catch (error) {
      if (error instanceof PhotoError && error.code === 'cancelled') return
      setVideoError(errorMessage(error, 'Could not get a video.'))
    }
  }

  const discardVideo = () => {
    setVideo(null)
    setVideoUrl(null)
    setVideoError(null)
  }

  const save = async (item: MediaItem) => {
    setDownloading(item.id)
    try {
      const outcome = await downloadMedia(item)
      toast.success(outcome === 'shared' ? 'Choose where to save it.' : 'Downloaded.')
    } catch (error) {
      const message = errorMessage(error)
      if (!/cancel/i.test(message)) toast.error(`Could not download: ${message}`)
    } finally {
      setDownloading(null)
    }
  }

  const capture = async (source: 'camera' | 'gallery') => {
    setPhotoError(null)
    try {
      const blob = await getPhoto(source)
      setPhoto(blob)
      setPhotoUrl(URL.createObjectURL(blob))
    } catch (error) {
      if (error instanceof PhotoError && error.code === 'cancelled') return
      setPhotoError(errorMessage(error, 'Could not get a photo.'))
    }
  }

  const discardPhoto = () => {
    setPhoto(null)
    setPhotoUrl(null)
    setPhotoError(null)
  }

  const upload = async (kind: 'photo' | 'audio' | 'video') => {
    const blob = kind === 'photo' ? photo : kind === 'video' ? video : audio.blob
    if (!blob) return
    setUploading(kind)
    try {
      await uploadMedia(kind, blob)
      toast.success(kind === 'photo' ? 'Photo saved to your account.' : kind === 'video' ? 'Video saved to your account.' : 'Recording saved to your account.')
      if (kind === 'photo') discardPhoto()
      else if (kind === 'video') discardVideo()
      else audio.discard()
      void refresh()
    } catch (error) {
      toast.error(`Not uploaded: ${errorMessage(error)}`)
    } finally {
      setUploading(null)
    }
  }

  const view = async (item: MediaItem) => {
    setPreviewing(item.id)
    try {
      const blob = await fetchMediaBlob(item.id)
      setPreview({ id: item.id, kind: item.kind, url: URL.createObjectURL(blob) })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPreviewing(null)
    }
  }

  const remove = async (item: MediaItem) => {
    try {
      await deleteMedia(item.id)
      if (preview?.id === item.id) setPreview(null)
      setItems((list) => list.filter((i) => i.id !== item.id))
      toast.success('Deleted.')
    } catch (error) {
      toast.error(`Could not delete: ${errorMessage(error)}`)
    }
  }

  return (
    <AppShell title="Evidence" subtitle="Photos, video and audio you choose to keep" showBack>
      <div className="space-y-5 py-1">
        <FadeIn>
          <p className="surface rounded-3xl p-4 text-sm text-muted-foreground">
            Nothing here is uploaded automatically. A photo or recording stays on this device until you press <strong>Upload</strong>,
            and you can delete anything you uploaded below.
          </p>
        </FadeIn>

        {/* Photo */}
        <FadeIn delay={0.05}>
          <section className="surface rounded-3xl p-4" aria-labelledby="photo-heading">
            <h2 id="photo-heading" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <CameraIcon className="size-5 text-primary" /> Photo
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void capture('camera')} className="gradient-primary flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                <CameraIcon className="size-5" /> Take photo
              </button>
              <button type="button" onClick={() => void capture('gallery')} className="surface-raised flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                <ImageIcon className="size-5 text-muted-foreground" /> Gallery
              </button>
            </div>
            {photoError && (
              <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">
                {photoError}
              </p>
            )}
            {photoUrl && photo && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Photo ready to upload" className="max-h-72 w-full rounded-2xl object-contain bg-muted" />
                <p className="mt-1 text-xs text-muted-foreground">{formatBytes(photo.size)} · not uploaded yet</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={discardPhoto} className="surface-raised flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
                    <X className="size-4" /> Discard
                  </button>
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => void upload('photo')}
                    className="gradient-success flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                  >
                    {uploading === 'photo' ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Upload
                  </button>
                </div>
              </div>
            )}
          </section>
        </FadeIn>

        {/* Video */}
        <FadeIn delay={0.08}>
          <section className="surface rounded-3xl p-4" aria-labelledby="video-heading">
            <h2 id="video-heading" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Video className="size-5 text-primary" /> Video
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Short clips only: uploads are limited to 8 MB (roughly 10 to 30 seconds).</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void captureVideo('camera')} className="gradient-primary flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                <Video className="size-5" /> Record video
              </button>
              <button type="button" onClick={() => void captureVideo('gallery')} className="surface-raised flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                <ImageIcon className="size-5 text-muted-foreground" /> Gallery
              </button>
            </div>
            {videoError && (
              <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">
                {videoError}
              </p>
            )}
            {videoUrl && video && (
              <div className="mt-3">
                <video src={videoUrl} controls playsInline className="max-h-72 w-full rounded-2xl bg-muted" />
                <p className="mt-1 text-xs text-muted-foreground">{formatBytes(video.size)} · not uploaded yet</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={discardVideo} className="surface-raised flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
                    <X className="size-4" /> Discard
                  </button>
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => void upload('video')}
                    className="gradient-success flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                  >
                    {uploading === 'video' ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Upload
                  </button>
                </div>
              </div>
            )}
          </section>
        </FadeIn>

        {/* Audio */}
        <FadeIn delay={0.1}>
          <section className="surface rounded-3xl p-4" aria-labelledby="audio-heading">
            <h2 id="audio-heading" className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Mic className="size-5 text-primary" /> Audio recording
            </h2>
            <div className="mt-3 flex items-center gap-3">
              {audio.state === 'recording' ? (
                <button type="button" onClick={audio.stop} className="gradient-danger flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                  <Square className="size-4" /> Stop · {clock(audio.seconds)}
                </button>
              ) : (
                <button type="button" onClick={() => void audio.start()} className="gradient-primary flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95">
                  <Mic className="size-5" /> {audio.blob ? 'Record again' : 'Start recording'}
                </button>
              )}
              {audio.state === 'recording' && <span className="size-3 animate-pulse rounded-full bg-danger" aria-label="Recording" />}
            </div>
            {audio.error && (
              <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">
                {audio.error}
              </p>
            )}
            {audio.interrupted && audio.blob && (
              <p role="status" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                The recording was interrupted (for example the app was sent to the background). What was captured is kept below.
              </p>
            )}
            {audio.url && audio.blob && (
              <div className="mt-3">
                <audio src={audio.url} controls className="w-full" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {clock(audio.seconds)} · {formatBytes(audio.blob.size)} · not uploaded yet
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={audio.discard} className="surface-raised flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
                    <X className="size-4" /> Discard
                  </button>
                  <button
                    type="button"
                    disabled={uploading !== null}
                    onClick={() => void upload('audio')}
                    className="gradient-success flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-60"
                  >
                    {uploading === 'audio' ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Upload
                  </button>
                </div>
              </div>
            )}
          </section>
        </FadeIn>

        {/* Saved */}
        <FadeIn delay={0.15}>
          <section aria-labelledby="saved-heading">
            <h2 id="saved-heading" className="mb-3 flex items-center gap-2 px-1 font-serif text-xl font-semibold">
              <CheckCircle2 className="size-5 text-success" /> Saved to your account
            </h2>
            {loadingList ? (
              <div className="flex h-20 items-center justify-center" role="status">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : listError ? (
              <p role="alert" className="surface rounded-2xl p-4 text-sm text-danger">
                {listError}{' '}
                <button type="button" onClick={() => void refresh()} className="font-semibold underline">
                  Retry
                </button>
              </p>
            ) : items.length === 0 ? (
              <p className="surface rounded-2xl py-6 text-center text-sm text-muted-foreground">Nothing uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="surface rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', item.kind === 'photo' ? 'gradient-sky' : item.kind === 'video' ? 'gradient-primary' : 'gradient-warm')}>
                        {item.kind === 'photo' ? <ImageIcon className="size-5" /> : item.kind === 'video' ? <Video className="size-5" /> : <Mic className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.kind === 'photo' ? 'Photo' : item.kind === 'video' ? 'Video' : 'Audio'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString()} · {formatBytes(item.size_bytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void view(item)}
                        disabled={previewing === item.id}
                        aria-label={`View ${item.kind}`}
                        className="flex size-11 items-center justify-center rounded-xl text-primary active:bg-primary/10"
                      >
                        {previewing === item.id ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void save(item)}
                        disabled={downloading === item.id}
                        aria-label={`Download ${item.kind}`}
                        className="flex size-11 items-center justify-center rounded-xl text-primary active:bg-primary/10"
                      >
                        {downloading === item.id ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                      </button>
                      <button type="button" onClick={() => void remove(item)} aria-label={`Delete ${item.kind}`} className="flex size-11 items-center justify-center rounded-xl text-danger active:bg-danger/10">
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                    {preview?.id === item.id &&
                      (preview.kind === 'photo' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt="Uploaded photo" className="mt-3 max-h-72 w-full rounded-2xl bg-muted object-contain" />
                      ) : preview.kind === 'video' ? (
                        <video src={preview.url} controls playsInline className="mt-3 max-h-72 w-full rounded-2xl bg-muted" />
                      ) : (
                        <audio src={preview.url} controls className="mt-3 w-full" />
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </FadeIn>
      </div>
    </AppShell>
  )
}
