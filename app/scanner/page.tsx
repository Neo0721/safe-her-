'use client'

import {
  Camera,
  Copy,
  Cpu,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  ScanText,
  Smartphone,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import { blobToBase64, formatBytes, getPhoto, PhotoError } from '@/lib/media'
import {
  extractEmergencyInfo,
  textScanner,
  type EmergencyInfoSummary,
  type ScanResult,
} from '@/lib/native/text-scanner'
import { imageClassifier, type ClassifyResult } from '@/lib/native/image-classifier'

export default function ScannerPage() {
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [summary, setSummary] = useState<EmergencyInfoSummary | null>(null)
  const [script, setScript] = useState<'latin' | 'devanagari'>('latin')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [labelling, setLabelling] = useState(false)
  const [labels, setLabels] = useState<ClassifyResult | null>(null)

  const native = textScanner.available()

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl])

  const runScan = async (blob: Blob) => {
    setScanning(true)
    setPhotoError(null)
    setResult(null)
    setSummary(null)
    try {
      const base64 = await blobToBase64(blob)
      const scanned = await textScanner.recognize(base64, script)
      setResult(scanned)
      setSummary(extractEmergencyInfo(scanned.text))
    } catch (error) {
      setPhotoError(errorMessage(error, 'Text recognition failed.'))
    } finally {
      setScanning(false)
    }
  }

  const runClassify = async (blob: Blob) => {
    setLabelling(true)
    setPhotoError(null)
    setLabels(null)
    try {
      setLabels(await imageClassifier.classify(await blobToBase64(blob), 0.5))
    } catch (error) {
      setPhotoError(errorMessage(error, 'Image classification failed.'))
    } finally {
      setLabelling(false)
    }
  }

  const pickImage = async (source: 'camera' | 'gallery') => {
    setPhotoError(null)
    try {
      const blob = await getPhoto(source)
      setPhoto(blob)
      setLabels(null)
      setPhotoUrl(URL.createObjectURL(blob))
      if (native) void runScan(blob)
    } catch (error) {
      if (error instanceof PhotoError && error.code === 'cancelled') return
      setPhotoError(errorMessage(error, 'Could not get an image.'))
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  const applyBloodGroup = async (group: string) => {
    setSavingProfile(true)
    try {
      await apiJson('/api/profile', { method: 'POST', json: { bloodGroup: group } })
      toast.success(`Saved blood group ${group} to your profile.`)
    } catch (e) {
      toast.error(`Could not save to profile: ${errorMessage(e)}`)
    } finally {
      setSavingProfile(false)
    }
  }

  const addScannedContact = async (phone: string, label = 'Emergency contact') => {
    setSavingContact(true)
    try {
      await apiJson('/api/contacts', {
        method: 'POST',
        json: { name: summary?.name || 'Emergency contact', relationship: label, phone, priority: 'High' },
      })
      toast.success(`Added ${phone} to your trusted circle.`)
    } catch (e) {
      toast.error(`Could not add contact: ${errorMessage(e)}`)
    } finally {
      setSavingContact(false)
    }
  }

  return (
    <AppShell title="Card scanner" subtitle="On-device ML Kit text recognition" showBack>
      <div className="space-y-5 py-1">
        <FadeIn>
          <div className="surface flex items-start gap-3 rounded-3xl p-4">
            <span className="gradient-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
              <ScanText className="size-5" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Private, on-device OCR</p>
              <p className="text-xs text-muted-foreground">
                Google ML Kit reads text directly on this phone. The image is never uploaded anywhere, and recognition works without
                an internet connection.
              </p>
            </div>
          </div>
        </FadeIn>

        {!native && (
          <FadeIn delay={0.05}>
            <div role="note" className="surface-raised flex items-start gap-3 rounded-3xl border-warning/30 p-4 text-sm">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Runs in the SafeHer Android app</p>
                <p className="text-xs text-muted-foreground">
                  The ML Kit engine is bundled into the Android APK. In a browser you can still choose photos, but scanning needs the
                  Android app.
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Input */}
        <FadeIn delay={0.1}>
          <section className="surface rounded-3xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-semibold">Choose an image</h2>
              <div className="flex gap-1 rounded-xl bg-muted p-1 text-xs font-semibold" role="group" aria-label="Script">
                <button
                  type="button"
                  onClick={() => setScript('latin')}
                  aria-pressed={script === 'latin'}
                  className={`rounded-lg px-2.5 py-1 transition-colors ${script === 'latin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  Latin
                </button>
                <button
                  type="button"
                  onClick={() => setScript('devanagari')}
                  aria-pressed={script === 'devanagari'}
                  className={`rounded-lg px-2.5 py-1 transition-colors ${script === 'devanagari' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  Devanagari
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Scan an ID card, medical bracelet, blood donor card, or prescription.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void pickImage('camera')}
                disabled={scanning}
                className="gradient-primary flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95 disabled:opacity-50"
              >
                <Camera className="size-5" /> Take photo
              </button>
              <button
                type="button"
                onClick={() => void pickImage('gallery')}
                disabled={scanning}
                className="surface-raised flex min-h-14 items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-95 disabled:opacity-50"
              >
                <ImageIcon className="size-5 text-muted-foreground" /> Gallery
              </button>
            </div>

            {photoError && (
              <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">
                {photoError}
              </p>
            )}

            {photoUrl && photo && (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Document to scan" className="max-h-72 w-full rounded-2xl bg-muted object-contain" />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(photo.size)}</span>
                  {native && (
                    <button
                      type="button"
                      disabled={scanning}
                      onClick={() => void runScan(photo)}
                      className="flex min-h-11 items-center gap-1 font-semibold text-primary"
                    >
                      <RefreshCw className={`size-3.5 ${scanning ? 'animate-spin' : ''}`} /> Scan again
                    </button>
                  )}
                </div>
                {native && (
                  <button
                    type="button"
                    disabled={labelling}
                    onClick={() => void runClassify(photo)}
                    className="surface-raised mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold active:scale-[0.98] disabled:opacity-50"
                  >
                    {labelling ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4 text-primary" />} What is in this photo?
                  </button>
                )}
                {labels && (
                  <div className="mt-3 rounded-2xl bg-muted/60 p-3" role="status">
                    <p className="text-xs font-semibold">Image classification</p>
                    {labels.labels.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">The model did not recognise anything with enough confidence.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {labels.labels.map((l) => (
                          <li key={l.label} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 truncate font-medium">{l.label}</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(l.confidence * 100)}%` }} />
                            </span>
                            <span className="w-9 text-right tabular-nums text-muted-foreground">{Math.round(l.confidence * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {labels.engine} · {labels.elapsedMs} ms. These are general labels, not a safety judgement.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </FadeIn>

        {scanning && (
          <FadeIn>
            <div className="surface flex items-center justify-center gap-3 rounded-3xl p-6 text-sm" role="status">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Running on-device ML Kit text recognition…</span>
            </div>
          </FadeIn>
        )}

        {/* Structured summary */}
        {summary && (
          <FadeIn delay={0.15}>
            <section className="surface space-y-3 rounded-3xl p-4" aria-labelledby="summary-heading">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h2 id="summary-heading" className="font-serif text-xl font-semibold">
                  Detected emergency fields
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Extracted from the real text recognized by the model. Review before applying.
              </p>

              {summary.bloodGroup && (
                <FieldRow
                  label="Blood group"
                  value={summary.bloodGroup}
                  action={
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => void applyBloodGroup(summary.bloodGroup!)}
                      className="gradient-primary flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
                    >
                      {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Save to profile
                    </button>
                  }
                />
              )}

              {summary.emergencyContact && (
                <FieldRow
                  label={summary.emergencyContact.label || 'Emergency phone'}
                  value={summary.emergencyContact.phone}
                  action={
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={() => void addScannedContact(summary.emergencyContact!.phone, summary.emergencyContact?.label)}
                      className="gradient-primary flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
                    >
                      {savingContact ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} Add to circle
                    </button>
                  }
                />
              )}

              {summary.phone && summary.phone !== summary.emergencyContact?.phone && (
                <FieldRow
                  label="Phone number"
                  value={summary.phone}
                  action={
                    <button
                      type="button"
                      disabled={savingContact}
                      onClick={() => void addScannedContact(summary.phone!, 'Primary phone')}
                      className="gradient-primary flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
                    >
                      {savingContact ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} Add to circle
                    </button>
                  }
                />
              )}

              {summary.idNumber && <FieldRow label="ID number" value={summary.idNumber} />}
              {summary.name && <FieldRow label="Name (detected)" value={summary.name} />}
              {summary.allergies && <FieldRow label="Allergies" value={summary.allergies} />}

              {!summary.bloodGroup && !summary.emergencyContact && !summary.phone && !summary.idNumber && (
                <p className="rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                  No standard emergency fields (blood group, phone number, ID) were spotted in this text, but the raw text is below.
                </p>
              )}
            </section>
          </FadeIn>
        )}

        {/* Full recognized text */}
        {result && (
          <FadeIn delay={0.2}>
            <section className="surface rounded-3xl p-4" aria-labelledby="raw-heading">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <h2 id="raw-heading" className="font-serif text-xl font-semibold">
                    Recognized text
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(result.text)}
                  className="surface-raised flex min-h-10 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
                >
                  <Copy className="size-3.5" /> Copy
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                  <Cpu className="size-3" /> {result.engine}
                </span>
                <span className="rounded-lg bg-muted px-2 py-1">{result.elapsedMs} ms</span>
                <span className="rounded-lg bg-muted px-2 py-1">{result.lineCount} lines</span>
                <span className="rounded-lg bg-muted px-2 py-1">
                  {result.imageWidth}×{result.imageHeight} px
                </span>
              </div>

              {result.text ? (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-muted/60 p-3 text-xs font-mono leading-relaxed text-foreground">
                  {result.text}
                </pre>
              ) : (
                <p className="mt-3 rounded-2xl bg-muted/60 p-4 text-center text-xs text-muted-foreground">
                  No text was found in this photo. Make sure the text is clearly focused and well-lit.
                </p>
              )}
            </section>
          </FadeIn>
        )}
      </div>
    </AppShell>
  )
}

function FieldRow({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="surface-raised flex items-center justify-between gap-3 rounded-2xl p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
      {action}
    </div>
  )
}
