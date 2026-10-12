#!/usr/bin/env node
/**
 * End-to-end API test: authentication, per-user data isolation and the SOS lifecycle.
 *
 * Runs against a live dev server that is wired to the Firebase Auth *Emulator* and a scratch
 * SQLite file, so it never creates accounts in your real Firebase project or touches data/safeher.db:
 *
 *   firebase emulators:start --only auth --project <your-project-id>
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 SAFEHER_DB_PATH=/tmp/safeher-test.db npm run dev
 *   npm run test:api
 *
 * Env: API_BASE (default http://127.0.0.1:3000), AUTH_EMULATOR (default http://127.0.0.1:9099)
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000'
const EMU = process.env.AUTH_EMULATOR || 'http://127.0.0.1:9099'

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL  ${name} ${detail}`)
  }
}

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function signUp(email, password = 'test-password-1') {
  const res = await fetch(`${EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const data = await res.json()
  if (!data.idToken) throw new Error(`Emulator signUp failed: ${JSON.stringify(data)}`)
  return { token: data.idToken, uid: data.localId, email }
}

async function signIn(email, password = 'test-password-1') {
  const res = await fetch(`${EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  return res.json()
}

async function main() {
  const stamp = Date.now()
  const A = await signUp(`alice.${stamp}@example.test`)
  const B = await signUp(`bob.${stamp}@example.test`)

  console.log('\n[1] Authentication is enforced on every protected route')
  const routes = [
    ['GET', '/api/profile'], ['POST', '/api/profile'], ['GET', '/api/contacts'], ['POST', '/api/contacts'],
    ['PUT', '/api/contacts/x'], ['DELETE', '/api/contacts/x'], ['GET', '/api/settings'], ['PUT', '/api/settings'],
    ['GET', '/api/sos'], ['POST', '/api/sos'], ['PUT', '/api/sos'], ['POST', '/api/sos/actions'],
    ['GET', '/api/history'], ['GET', '/api/activity'], ['POST', '/api/activity'],
    ['POST', '/api/location'], ['GET', '/api/location?sos_event_id=x'], ['POST', '/api/trips'], ['PUT', '/api/trips'],
  ]
  for (const [m, p] of routes) {
    const none = await call(null, m, p, m === 'GET' || m === 'DELETE' ? undefined : {})
    const bad = await call('not-a-real-token', m, p, m === 'GET' || m === 'DELETE' ? undefined : {})
    check(`${m} ${p} rejects missing + invalid token`, none.status === 401 && bad.status === 401, `(${none.status}/${bad.status})`)
  }
  const forged = await call(`Bearer ${A.token}`, 'GET', '/api/profile')
  check('malformed bearer value rejected', forged.status === 401)

  console.log('\n[2] Profile: identity comes from the verified token, not the client')
  check('profile 404 before creation', (await call(A.token, 'GET', '/api/profile')).status === 404)
  const pa = await call(A.token, 'POST', '/api/profile', {
    fullName: 'Alice Test', email: 'attacker@evil.test', firebase_uid: B.uid, uid: B.uid, phone: '+91 98765 43210', bloodGroup: 'O+',
  })
  check('profile created (201/200)', pa.status === 200, JSON.stringify(pa.json))
  check('stored uid is the token uid (client uid ignored)', pa.json?.firebase_uid === A.uid)
  check('stored email is the token email (client email ignored)', pa.json?.email === A.email)
  check('no password field anywhere in profile', !JSON.stringify(pa.json).toLowerCase().includes('password'))
  check('invalid phone rejected', (await call(A.token, 'POST', '/api/profile', { fullName: 'X', phone: 'abc' })).status === 400)
  check('invalid blood group rejected', (await call(A.token, 'POST', '/api/profile', { fullName: 'X', bloodGroup: 'Z9' })).status === 400)
  check('missing name rejected', (await call(A.token, 'POST', '/api/profile', { fullName: '   ' })).status === 400)
  const pb = await call(B.token, 'POST', '/api/profile', { fullName: 'Bob Test' })
  check('second user profile created', pb.status === 200 && pb.json?.firebase_uid === B.uid)
  check('profile update persists', (await call(A.token, 'POST', '/api/profile', { fullName: 'Alice Renamed', phone: '+91 90000 11111' })).json?.full_name === 'Alice Renamed')
  const relogin = await signIn(A.email)
  check('login (fresh token) returns same profile', (await call(relogin.idToken, 'GET', '/api/profile')).json?.full_name === 'Alice Renamed')
  check('each user sees only their own profile', (await call(B.token, 'GET', '/api/profile')).json?.full_name === 'Bob Test')

  console.log('\n[3] Contacts CRUD + isolation')
  const c1 = await call(A.token, 'POST', '/api/contacts', { name: 'Test Contact', relationship: 'Friend', phone: '+91 98111 22222', priority: 'High', firebase_uid: B.uid })
  check('contact created', c1.status === 201 && c1.json?.id, JSON.stringify(c1.json))
  check('contact owner is caller (client uid ignored)', c1.json?.firebase_uid === A.uid)
  const cid = c1.json?.id
  check('contact validation: bad phone', (await call(A.token, 'POST', '/api/contacts', { name: 'N', relationship: 'R', phone: 'zzz' })).status === 400)
  check('contact validation: bad priority', (await call(A.token, 'POST', '/api/contacts', { name: 'N', relationship: 'R', phone: '12345', priority: 'Urgent' })).status === 400)
  check('contact validation: missing fields', (await call(A.token, 'POST', '/api/contacts', { name: 'N' })).status === 400)
  check('A lists own contact', (await call(A.token, 'GET', '/api/contacts')).json?.length === 1)
  check('B lists NO contacts (isolation)', (await call(B.token, 'GET', '/api/contacts')).json?.length === 0)
  check('B cannot update A contact', (await call(B.token, 'PUT', `/api/contacts/${cid}`, { name: 'Hacked', relationship: 'x', phone: '12345' })).status === 404)
  check('B cannot delete A contact', (await call(B.token, 'DELETE', `/api/contacts/${cid}`)).status === 404)
  const upd = await call(A.token, 'PUT', `/api/contacts/${cid}`, { name: 'Renamed Contact', relationship: 'Sister', phone: '+91 98111 22222', priority: 'Medium' })
  check('A updates own contact', upd.status === 200 && upd.json?.name === 'Renamed Contact' && upd.json?.priority === 'Medium')
  check('contact unchanged by B attempt', (await call(A.token, 'GET', '/api/contacts')).json?.[0]?.name === 'Renamed Contact')
  const c2 = await call(B.token, 'POST', '/api/contacts', { name: 'Bob Contact', relationship: 'Mom', phone: '+91 97000 00000' })
  check('B creates own contact', c2.status === 201)

  console.log('\n[4] SOS settings')
  const s0 = await call(A.token, 'GET', '/api/settings')
  check('default settings created', s0.status === 200 && s0.json?.hold_duration === 3 && s0.json?.audio_recording === 0)
  check('invalid hold_duration rejected', (await call(A.token, 'PUT', '/api/settings', { hold_duration: 7 })).status === 400)
  check('invalid flag rejected', (await call(A.token, 'PUT', '/api/settings', { audio_recording: 'yes' })).status === 400)
  const s1 = await call(A.token, 'PUT', '/api/settings', { hold_duration: 5, audio_recording: true, location_sharing: true, notify_contacts: false })
  check('settings saved', s1.json?.hold_duration === 5 && s1.json?.audio_recording === 1 && s1.json?.notify_contacts === 0)
  check('settings isolated per user', (await call(B.token, 'GET', '/api/settings')).json?.hold_duration === 3)
  await call(A.token, 'PUT', '/api/settings', { hold_duration: 3, audio_recording: false, notify_contacts: true })

  console.log('\n[5] SOS lifecycle with real coordinates')
  const sosId = `sos-${stamp}-real`
  const start = await call(A.token, 'POST', '/api/sos', { id: sosId })
  check('SOS starts as Active without GPS yet', start.status === 201 && start.json?.status === 'Active' && start.json?.latitude === null)
  check('SOS start is idempotent for owner', (await call(A.token, 'POST', '/api/sos', { id: sosId })).status === 200)
  check('other user cannot hijack SOS id', (await call(B.token, 'POST', '/api/sos', { id: sosId })).status === 409)
  check('invalid coordinates rejected', (await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 999, longitude: 0 })).status === 400)
  check('non-numeric coordinates rejected', (await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: '19.07', longitude: '72.8' })).status === 400)
  check('needs exactly one parent id', (await call(A.token, 'POST', '/api/location', { latitude: 1, longitude: 1 })).status === 400)
  check('B cannot write location into A SOS', (await call(B.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 10, longitude: 10 })).status === 404)
  const l1 = await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 12.9716, longitude: 77.5946, accuracy: 8.5 })
  check('A writes first GPS fix', l1.status === 201)
  await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 12.9718, longitude: 77.5948, accuracy: 6 })
  const one = await call(A.token, 'GET', `/api/sos?id=${sosId}`)
  check('first fix becomes the SOS headline location', one.json?.latitude === 12.9716 && one.json?.longitude === 77.5946)
  const old = new Date(Date.now() - 60_000).toISOString()
  check('buffered point keeps device fix time', (await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 12.97, longitude: 77.59, recorded_at: old })).status === 201)
  check('implausible recorded_at rejected', (await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 12.97, longitude: 77.59, recorded_at: '2001-01-01T00:00:00Z' })).status === 400)
  const pts = await call(A.token, 'GET', `/api/location?sos_event_id=${sosId}`)
  check('A reads back 3 stored points', pts.json?.length === 3, JSON.stringify(pts.json))
  check('B reads NO points of A SOS', (await call(B.token, 'GET', `/api/location?sos_event_id=${sosId}`)).json?.length === 0)
  check('B cannot fetch A SOS event', (await call(B.token, 'GET', `/api/sos?id=${sosId}`)).status === 404)

  const act1 = await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, contact_id: cid, kind: 'sms_contact' })
  check('SMS composer opening recorded (status "opened", not "sent")', act1.status === 201 && act1.json?.status === 'opened')
  check('call action recorded', (await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, contact_id: cid, kind: 'call_contact' })).status === 201)
  check('emergency call action recorded', (await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, kind: 'call_emergency' })).status === 201)
  check('B cannot log actions on A SOS', (await call(B.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, kind: 'call_emergency' })).status === 404)
  check('A cannot reference B contact', (await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, contact_id: c2.json?.id, kind: 'call_contact' })).status === 404)
  check('unknown action kind rejected', (await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, kind: 'notified_everyone' })).status === 400)

  check('B cannot end A SOS', (await call(B.token, 'PUT', '/api/sos', { id: sosId, status: 'Completed' })).status === 404)
  check('invalid end status rejected (cannot forge "Test"/"Active")', (await call(A.token, 'PUT', '/api/sos', { id: sosId, status: 'Test' })).status === 400)
  const ended = await call(A.token, 'PUT', '/api/sos', { id: sosId, status: 'Completed' })
  check('A ends SOS -> Completed with ended_at', ended.json?.status === 'Completed' && !!ended.json?.ended_at)
  check('ending twice is idempotent', (await call(A.token, 'PUT', '/api/sos', { id: sosId, status: 'Cancelled' })).json?.status === 'Completed')
  check('no location accepted after SOS ended', (await call(A.token, 'POST', '/api/location', { sos_event_id: sosId, latitude: 1, longitude: 1 })).status === 409)
  check('no actions accepted after SOS ended', (await call(A.token, 'POST', '/api/sos/actions', { sos_event_id: sosId, kind: 'call_emergency' })).status === 409)

  console.log('\n[6] Cancellation and no-GPS SOS')
  const noGps = `sos-${stamp}-nogps`
  await call(A.token, 'POST', '/api/sos', { id: noGps })
  const cancelled = await call(A.token, 'PUT', '/api/sos', { id: noGps, status: 'Cancelled' })
  check('SOS without GPS can be cancelled; coordinates stay NULL (not faked)', cancelled.json?.status === 'Cancelled' && cancelled.json?.latitude === null)

  console.log('\n[7] Drill / test mode')
  const drillId = `sos-${stamp}-drill`
  const drill = await call(A.token, 'POST', '/api/sos', { id: drillId, is_test: true })
  check('drill starts (is_test=1) - previously violated DB CHECK', drill.status === 201 && drill.json?.is_test === 1)
  check('drill ends', (await call(A.token, 'PUT', '/api/sos', { id: drillId, status: 'Completed' })).json?.status === 'Completed')

  console.log('\n[8] Trips / live tracking')
  const tripId = `trip-${stamp}`
  check('trip started', (await call(A.token, 'POST', '/api/trips', { id: tripId })).status === 201)
  check('B cannot hijack trip id', (await call(B.token, 'POST', '/api/trips', { id: tripId })).status === 409)
  check('B cannot write into A trip', (await call(B.token, 'POST', '/api/location', { trip_id: tripId, latitude: 5, longitude: 5 })).status === 404)
  check('unknown trip rejected (no auto-create hijack)', (await call(A.token, 'POST', '/api/location', { trip_id: 'no-such-trip', latitude: 5, longitude: 5 })).status === 404)
  check('A writes trip point', (await call(A.token, 'POST', '/api/location', { trip_id: tripId, latitude: 19.076, longitude: 72.877, accuracy: 12 })).status === 201)
  check('B cannot end A trip', (await call(B.token, 'PUT', '/api/trips', { id: tripId })).status === 404)
  check('A ends trip', (await call(A.token, 'PUT', '/api/trips', { id: tripId })).json?.status === 'Ended')
  check('no trip points after end', (await call(A.token, 'POST', '/api/location', { trip_id: tripId, latitude: 5, longitude: 5 })).status === 409)

  console.log('\n[9] History and activity')
  const hist = await call(A.token, 'GET', '/api/history')
  check('history has 3 events (real, no-GPS, drill)', hist.json?.length === 3)
  const real = hist.json?.find((e) => e.id === sosId)
  check('history counts real GPS points and opened composers', real?.points_count === 3 && real?.actions_count === 3, JSON.stringify(real))
  check('history flags the drill', hist.json?.find((e) => e.id === drillId)?.is_test === 1)
  check('B history is empty (isolation)', (await call(B.token, 'GET', '/api/history')).json?.length === 0)
  const act = await call(A.token, 'GET', '/api/activity?limit=50')
  const titles = (act.json || []).map((a) => a.title)
  check('activity logged for SOS start/end, drill, contacts, settings', ['SOS Started', 'SOS Ended', 'SOS Cancelled', 'SOS Drill Started', 'Contact Added', 'Settings Changed', 'SMS Composer Opened'].every((t) => titles.includes(t)), JSON.stringify(titles))
  check('B activity has no A entries', !(await call(B.token, 'GET', '/api/activity')).json?.some((a) => a.title === 'SOS Started'))
  check('activity type is validated', (await call(A.token, 'POST', '/api/activity', { type: 'bogus', title: 'x' })).status === 400)

  console.log('\n[10] Input hardening')
  const bad = await fetch(BASE + '/api/contacts', { method: 'POST', headers: { Authorization: `Bearer ${A.token}`, 'Content-Type': 'application/json' }, body: '{not json' })
  check('malformed JSON -> 400, not 500', bad.status === 400)
  const sql = await call(A.token, 'POST', '/api/contacts', { name: "x'); DROP TABLE users;--", relationship: 'r', phone: '12345' })
  check('SQL metacharacters stored as data', sql.status === 201 && (await call(A.token, 'GET', '/api/profile')).status === 200)

  console.log('\n[11] Power-button trigger settings and SOS source')
  const ps0 = await call(B.token, 'GET', '/api/settings')
  check('power trigger is off by default, 5 presses', ps0.json?.power_trigger === 0 && ps0.json?.power_presses === 5)
  const ps1 = await call(A.token, 'PUT', '/api/settings', { power_trigger: true, power_presses: 4 })
  check('power trigger saved (on, 4 presses)', ps1.json?.power_trigger === 1 && ps1.json?.power_presses === 4)
  check('hold duration untouched by partial update', ps1.json?.hold_duration === 3)
  check('invalid press count rejected', (await call(A.token, 'PUT', '/api/settings', { power_presses: 9 })).status === 400)
  check('non-boolean trigger flag rejected', (await call(A.token, 'PUT', '/api/settings', { power_trigger: 'yes' })).status === 400)
  check('power settings are per user', (await call(B.token, 'GET', '/api/settings')).json?.power_trigger === 0)
  const pwrId = `sos-${stamp}-power`
  const pwr = await call(A.token, 'POST', '/api/sos', { id: pwrId, source: 'power' })
  check('SOS records the power-button source', pwr.status === 201 && pwr.json?.trigger_source === 'power')
  check('default SOS source is "hold"', (await call(A.token, 'GET', `/api/sos?id=${sosId}`)).json?.trigger_source === 'hold')
  check('unknown SOS source rejected', (await call(A.token, 'POST', '/api/sos', { id: `sos-${stamp}-bad`, source: 'telepathy' })).status === 400)
  await call(A.token, 'PUT', '/api/sos', { id: pwrId, status: 'Completed' })
  check('history exposes the source', (await call(A.token, 'GET', '/api/history')).json?.find((e) => e.id === pwrId)?.trigger_source === 'power')

  console.log('\n[12] Pagination, limits and operational endpoints')
  const page1 = await call(A.token, 'GET', '/api/history?limit=2')
  check('history honours limit', page1.json?.length === 2)
  const cursor = page1.json?.[1]?.started_at
  const page2 = await call(A.token, 'GET', `/api/history?limit=50&before=${encodeURIComponent(cursor)}`)
  check('history cursor returns only older events', page2.status === 200 && page2.json?.every((e) => e.started_at < cursor) && page2.json.length >= 1)
  check('history rejects a bad cursor', (await call(A.token, 'GET', '/api/history?before=notadate')).status === 400)
  const big = await fetch(BASE + '/api/contacts', { method: 'POST', headers: { Authorization: `Bearer ${A.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(40_000), relationship: 'r', phone: '12345' }) })
  check('oversized body rejected (400, not stored)', big.status === 400)
  const health = await fetch(BASE + '/api/health')
  const healthJson = await health.json()
  check('/api/health is public and reports ok', health.status === 200 && healthJson.status === 'ok' && healthJson.database === 'ok', JSON.stringify(healthJson))
  check('health exposes no user data', !JSON.stringify(healthJson).includes('@'))
  check('security headers present', health.headers.get('x-content-type-options') === 'nosniff' && health.headers.get('cache-control') === 'no-store')
  check('X-Powered-By is hidden', !health.headers.get('x-powered-by'))

  if (process.env.TEST_RATE_LIMIT === '1') {
    console.log('\n[13] Rate limiting (opt-in: blocks this client for up to a minute afterwards)')
    let limited = 0
    let retryAfter = null
    for (let i = 0; i < 700 && !limited; i++) {
      const r = await fetch(BASE + '/api/profile')
      if (r.status === 429) {
        limited = i
        retryAfter = r.headers.get('retry-after')
      }
    }
    check('flooding is answered with 429 + Retry-After', limited > 0 && Number(retryAfter) >= 1, `(after ${limited}, retry-after ${retryAfter})`)
    check('health probe is never rate limited', (await fetch(BASE + '/api/health')).status === 200)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log('Failures:\n - ' + failures.join('\n - '))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
