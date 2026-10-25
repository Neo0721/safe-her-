/**
 * Small, honest "AI" helpers that run on the phone with no network:
 *
 *  - fitBatteryDrain: ordinary least-squares linear regression on real battery readings, used to
 *    predict how long the charge will last.
 *  - recommendTips: content-based recommender. The user's current situation and each tip are both
 *    vectors over the same topics; tips are ranked by cosine similarity.
 *
 * They are classic statistical methods, not neural networks, and the UI says so.
 */

// ------------------------------------------------------------------ battery prediction

export interface BatterySample {
  /** Epoch milliseconds. */
  t: number
  /** 0-100. */
  level: number
  charging: boolean
}

export interface DrainFit {
  /** Percentage points lost per hour (positive number). */
  ratePerHour: number
  /** Goodness of fit, 0-1. */
  r2: number
  samples: number
  spanMinutes: number
}

const MIN_SAMPLES = 4
const MIN_SPAN_MINUTES = 15

/** The most recent run of readings taken while NOT charging (a charge or a reboot resets the trend). */
export function latestDischargeRun(samples: BatterySample[]): BatterySample[] {
  const run: BatterySample[] = []
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]
    if (s.charging) break
    // A level that jumps UP while "not charging" means we missed a charge; stop at the discontinuity.
    if (run.length && s.level < run[0].level - 1) break
    run.unshift(s)
  }
  return run
}

/** Least-squares line level = a + b * hours. Returns null until there is enough real data to say anything. */
export function fitBatteryDrain(samples: BatterySample[]): DrainFit | null {
  const run = latestDischargeRun(samples)
  if (run.length < MIN_SAMPLES) return null
  const t0 = run[0].t
  const xs = run.map((s) => (s.t - t0) / 3_600_000)
  const ys = run.map((s) => s.level)
  const spanMinutes = xs[xs.length - 1] * 60
  if (spanMinutes < MIN_SPAN_MINUTES) return null

  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2
    sxy += (xs[i] - meanX) * (ys[i] - meanY)
    syy += (ys[i] - meanY) ** 2
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  if (slope >= 0) return null // not draining: nothing to predict
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { ratePerHour: -slope, r2, samples: n, spanMinutes }
}

/** Minutes until the battery reaches `target` percent at the fitted rate, or null if already below it. */
export function minutesUntil(level: number, target: number, fit: DrainFit): number | null {
  if (level <= target) return null
  return ((level - target) / fit.ratePerHour) * 60
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

// ------------------------------------------------------------------ recommendations

export const TOPICS = ['contacts', 'profile', 'power', 'motion', 'drill', 'night', 'battery', 'evidence', 'tracking'] as const
export type Topic = (typeof TOPICS)[number]
type Vector = Record<Topic, number>

export interface Situation {
  contactCount: number
  hasBloodGroup: boolean
  hasPhone: boolean
  powerTrigger: boolean
  motionDetection: boolean
  drillsDone: number
  mediaCount: number
  hour: number
  batteryLevel: number | null
  batteryRatePerHour: number | null
}

export interface RecommendedTip {
  id: string
  title: string
  body: string
  href: string
  cta: string
  score: number
  because: string[]
}

interface TipDef {
  id: string
  title: string
  body: string
  href: string
  cta: string
  topics: Partial<Vector>
}

const TIPS: TipDef[] = [
  {
    id: 'add-contacts',
    title: 'Build your trusted circle',
    body: 'SOS shortcuts are only as good as the people in your circle. Add at least two people who answer their phone.',
    href: '/contacts',
    cta: 'Add contacts',
    topics: { contacts: 1 },
  },
  {
    id: 'complete-profile',
    title: 'Complete your medical details',
    body: 'Blood group and phone appear on your Emergency Card so a helper can read them without unlocking anything else.',
    href: '/profile',
    cta: 'Open profile',
    topics: { profile: 1 },
  },
  {
    id: 'power-trigger',
    title: 'Turn on the power-button trigger',
    body: 'Press the power button several times quickly to start SOS without opening the app or unlocking the phone.',
    href: '/sos-settings',
    cta: 'SOS settings',
    topics: { power: 1, night: 0.3 },
  },
  {
    id: 'fall-check',
    title: 'Try the fall check-in',
    body: 'If the phone detects a hard fall and then stillness, it asks "are you OK?" first. Nothing is sent without your answer.',
    href: '/sos-settings',
    cta: 'SOS settings',
    topics: { motion: 1 },
  },
  {
    id: 'run-drill',
    title: 'Practise with an SOS drill',
    body: 'A drill runs the whole SOS flow without contacting anyone, so it is familiar if you ever need it.',
    href: '/emergency',
    cta: 'Start a drill',
    topics: { drill: 1 },
  },
  {
    id: 'night-route',
    title: 'Plan your route before dark',
    body: 'Pick a walking route along busy, well-lit roads and note the nearest police station and hospital on the way.',
    href: '/navigate',
    cta: 'Plan a route',
    topics: { night: 1, tracking: 0.4 },
  },
  {
    id: 'share-live',
    title: 'Share live location on unfamiliar trips',
    body: 'Start live tracking when you travel alone so your recorded route exists if something goes wrong.',
    href: '/tracking',
    cta: 'Open tracking',
    topics: { tracking: 1, night: 0.5 },
  },
  {
    id: 'charge-up',
    title: 'Charge before you head out',
    body: 'GPS tracking drains the battery faster. Top up, or carry a power bank, so SafeHer can keep recording.',
    href: '/insights',
    cta: 'See battery forecast',
    topics: { battery: 1, tracking: 0.3 },
  },
  {
    id: 'evidence',
    title: 'Know how to capture evidence',
    body: 'Photos, short videos and audio you choose to upload are saved to your own account, never shared automatically.',
    href: '/evidence',
    cta: 'Open evidence',
    topics: { evidence: 1 },
  },
]

function emptyVector(): Vector {
  return Object.fromEntries(TOPICS.map((t) => [t, 0])) as Vector
}

/** How much each topic matters right now, 0-1, derived only from the user's real state. */
export function situationVector(s: Situation): Vector {
  const v = emptyVector()
  v.contacts = s.contactCount === 0 ? 1 : s.contactCount === 1 ? 0.6 : 0.05
  v.profile = (s.hasBloodGroup ? 0 : 0.6) + (s.hasPhone ? 0 : 0.4)
  v.power = s.powerTrigger ? 0 : 0.8
  v.motion = s.motionDetection ? 0 : 0.45
  v.drill = s.drillsDone === 0 ? 0.7 : 0.05
  v.evidence = s.mediaCount === 0 ? 0.3 : 0
  const dark = s.hour >= 19 || s.hour < 5
  v.night = dark ? 0.9 : 0.15
  v.tracking = dark ? 0.5 : 0.2
  const lowBattery = s.batteryLevel !== null && s.batteryLevel <= 30
  const fastDrain = s.batteryRatePerHour !== null && s.batteryRatePerHour >= 15
  v.battery = lowBattery ? 1 : fastDrain ? 0.8 : 0
  return v
}

function cosine(a: Vector, b: Partial<Vector>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const t of TOPICS) {
    const x = a[t]
    const y = b[t] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

const REASONS: Record<Topic, string> = {
  contacts: 'your circle is small',
  profile: 'your profile is incomplete',
  power: 'the power-button trigger is off',
  motion: 'fall check-in is off',
  drill: "you haven't practised a drill",
  night: 'it is dark or getting dark',
  battery: 'your battery is low or draining fast',
  evidence: "you haven't saved any evidence yet",
  tracking: 'you may be travelling',
}

/** Top `limit` tips for this situation, best match first. Tips with no relevance are dropped. */
export function recommendTips(situation: Situation, limit = 4): RecommendedTip[] {
  const user = situationVector(situation)
  return TIPS.map((tip) => {
    const score = cosine(user, tip.topics)
    const because = TOPICS.filter((t) => (tip.topics[t] ?? 0) > 0 && user[t] >= 0.4)
      .sort((a, b) => user[b] - user[a])
      .map((t) => REASONS[t])
    return { id: tip.id, title: tip.title, body: tip.body, href: tip.href, cta: tip.cta, score, because }
  })
    .filter((t) => t.score >= 0.25 && t.because.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
