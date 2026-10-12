'use client'

import { Calendar, Clock, FlaskConical, MapPin, PhoneCall, ShieldAlert, Timer, Route, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { FadeIn } from '@/components/motion'
import { MapView } from '@/components/map-view'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { apiJson, errorMessage } from '@/lib/api-fetch'
import type { ActivityLog, SosEvent } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

interface RoutePoint {
  latitude: number
  longitude: number
  accuracy: number | null
  recorded_at: string
}

const PAGE_SIZE = 30

const STATUS_LABEL: Record<string, string> = {
  Active: 'Active',
  Completed: 'Ended safely',
  Cancelled: 'Cancelled',
  Failed: 'Failed',
}

function statusVariant(event: SosEvent): 'success' | 'emergency' | 'secondary' | 'muted' {
  if (event.status === 'Active') return 'emergency'
  if (event.status === 'Completed') return 'success'
  if (event.status === 'Cancelled') return 'muted'
  return 'secondary'
}

function duration(startStr: string, endStr: string | null) {
  if (!endStr) return 'In progress'
  const sec = Math.max(Math.floor((Date.parse(endStr) - Date.parse(startStr)) / 1000), 0)
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<SosEvent[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routeFor, setRouteFor] = useState<SosEvent | null>(null)
  const [route, setRoute] = useState<RoutePoint[] | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [events, logs] = await Promise.all([
        apiJson<SosEvent[]>(`/api/history?limit=${PAGE_SIZE}`),
        apiJson<ActivityLog[]>('/api/activity?limit=20'),
      ])
      setHistory(events)
      setHasMore(events.length === PAGE_SIZE)
      setActivity(logs)
    } catch (err) {
      setError(errorMessage(err, 'Could not load your history.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void load()
  }, [user, load])

  const loadMore = async () => {
    const oldest = history[history.length - 1]
    if (!oldest) return
    setLoadingMore(true)
    try {
      const more = await apiJson<SosEvent[]>(`/api/history?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest.started_at)}`)
      setHistory((h) => [...h, ...more])
      setHasMore(more.length === PAGE_SIZE)
    } catch (err) {
      setError(errorMessage(err, 'Could not load more events.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const openRoute = async (event: SosEvent) => {
    setRouteFor(event)
    setRoute(null)
    setRouteError(null)
    try {
      setRoute(await apiJson<RoutePoint[]>(`/api/location?sos_event_id=${encodeURIComponent(event.id)}`))
    } catch (err) {
      setRouteError(errorMessage(err))
    }
  }

  return (
    <AppShell title="History" subtitle="Every SOS and drill, with its route" showBack>
      <div className="mx-auto w-full max-w-2xl py-2">
        {loading ? (
          <div className="flex h-64 items-center justify-center" role="status">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm">
            <p className="font-medium">Could not load your history</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <button type="button" onClick={() => { setLoading(true); void load() }} className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 font-semibold">
              Try again
            </button>
          </div>
        ) : (
          <>
            <FadeIn>
              <div className="gradient-primary glow-primary relative mb-6 overflow-hidden rounded-[2rem] p-5">
                <ShieldAlert className="pointer-events-none absolute -right-5 -top-5 size-32 opacity-15" strokeWidth={1.3} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">Safety log</p>
                <p className="mt-1 font-serif text-4xl font-semibold">
                  {history.length} <span className="text-lg font-bold">event{history.length === 1 ? '' : 's'}</span>
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                  <span className="rounded-2xl bg-white/15 py-2">{history.filter((e) => e.is_test !== 1).length} SOS</span>
                  <span className="rounded-2xl bg-white/15 py-2">{history.filter((e) => e.is_test === 1).length} drills</span>
                  <span className="rounded-2xl bg-white/15 py-2">{history.filter((e) => e.trigger_source === 'power').length} power</span>
                </div>
              </div>
            </FadeIn>

            {history.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" />
                <div className="space-y-5">
                  {history.map((event, i) => {
                    const drill = event.is_test === 1
                    const hasLoc = event.latitude !== null && event.longitude !== null
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.05 }}
                        className="relative"
                      >
                        <span
                          className={`absolute -left-6 top-1.5 size-4 rounded-full ring-4 ring-background ${
                            drill ? 'bg-amber-500' : event.status === 'Completed' ? 'bg-success' : 'bg-destructive'
                          }`}
                        />
                        <div className="surface rounded-3xl p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Calendar className="size-4 shrink-0 text-primary" />
                              {new Date(event.started_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {event.trigger_source === 'power' && !drill && (
                                <Badge variant="warning">
                                  <Zap className="mr-1 size-3" /> Power button
                                </Badge>
                              )}
                              {drill && (
                                <Badge variant="secondary">
                                  <FlaskConical className="mr-1 size-3" /> Drill
                                </Badge>
                              )}
                              <Badge variant={statusVariant(event)}>{STATUS_LABEL[event.status] ?? event.status}</Badge>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <Detail icon={Clock} label="Started" value={new Date(event.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                            <Detail icon={Timer} label="Duration" value={duration(event.started_at, event.ended_at)} />
                            <Detail
                              icon={PhoneCall}
                              label="Call/SMS opened"
                              value={drill ? 'n/a (drill)' : `${event.actions_count ?? 0} time${event.actions_count === 1 ? '' : 's'}`}
                            />
                            <Detail
                              icon={MapPin}
                              label="Location"
                              value={hasLoc ? `${Number(event.latitude).toFixed(4)}, ${Number(event.longitude).toFixed(4)}` : 'No GPS fix'}
                            />
                          </div>

                          {(event.points_count ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => void openRoute(event)}
                              className="gradient-primary mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-transform active:scale-[0.98]"
                            >
                              <Route className="size-4" />
                              View recorded route ({event.points_count} point{event.points_count === 1 ? '' : 's'})
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="surface flex flex-col items-center rounded-3xl px-6 py-10 text-center">
                <span className="gradient-success mb-4 flex size-16 items-center justify-center rounded-3xl"><ShieldAlert className="size-8" /></span>
                <p className="font-serif text-2xl font-semibold">Nothing here yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">That is a good thing. Every SOS and practice drill will appear here with its route.</p>
              </div>
            )}

            {hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="surface-raised mt-6 min-h-12 w-full rounded-2xl text-sm font-bold disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load older events'}
              </button>
            )}

            <FadeIn delay={0.1} className="mt-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity log</h2>
              {activity.length > 0 ? (
                <ul className="surface divide-y divide-border/70 rounded-3xl">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        {a.detail && <p className="break-words text-xs text-muted-foreground">{a.detail}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
              )}
            </FadeIn>
          </>
        )}
      </div>

      <Dialog
        open={!!routeFor}
        onOpenChange={(open) => !open && setRouteFor(null)}
        title="Recorded route"
        description="GPS points saved during this SOS."
      >
        {routeError ? (
          <p role="alert" className="text-sm text-danger">{routeError}</p>
        ) : !route ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading route…</p>
        ) : (
          <div className="h-72 overflow-hidden rounded-2xl border border-border">
            <MapView
              latitude={route.length ? route[route.length - 1].latitude : null}
              longitude={route.length ? route[route.length - 1].longitude : null}
              markerLabel="Last recorded position"
              follow={false}
              path={route.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
            />
          </div>
        )}
      </Dialog>
    </AppShell>
  )
}

function Detail({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words font-medium">{value}</p>
      </div>
    </div>
  )
}
