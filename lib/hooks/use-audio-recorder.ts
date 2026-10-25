'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_SECONDS = 600

export type RecorderState = 'idle' | 'recording' | 'stopped'

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t))
}

/**
 * Microphone recording with explicit start/stop. The microphone is released as soon as recording
 * stops, when the component unmounts, or when the page is hidden mid-recording (Android may cut
 * the microphone then); whatever was captured up to that point is kept and flagged as interrupted.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interrupted, setInterrupted] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlRef = useRef<string | null>(null)

  const release = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stop = useCallback((wasInterrupted = false) => {
    if (wasInterrupted) setInterrupted(true)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else release()
  }, [release])

  const discard = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setUrl(null)
    setBlob(null)
    setSeconds(0)
    setInterrupted(false)
    setError(null)
    setState('idle')
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not available here. It needs the SafeHer app or a page served over HTTPS.')
      return
    }
    discard()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 })
      chunksRef.current = []
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      recorder.onerror = () => {
        setError('The recording was interrupted by the device.')
        setInterrupted(true)
      }
      recorder.onstop = () => {
        release()
        if (chunksRef.current.length > 0) {
          const result = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
          const objectUrl = URL.createObjectURL(result)
          urlRef.current = objectUrl
          setBlob(result)
          setUrl(objectUrl)
        } else {
          setError('Nothing was recorded.')
        }
        setState('stopped')
      }
      recorder.start(1000)
      recorderRef.current = recorder
      setSeconds(0)
      setState('recording')
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch (e) {
      release()
      const name = (e as { name?: string }).name
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access was denied. Allow it for SafeHer in your phone settings.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'The microphone could not be started.'
      )
      setState('idle')
    }
  }, [discard, release, stop])

  // Release the microphone if the page is hidden or the screen is left mid-recording.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && recorderRef.current?.state === 'recording') stop(true)
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      release()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [release, stop])

  return { state, seconds, blob, url, error, interrupted, start, stop: () => stop(), discard }
}
