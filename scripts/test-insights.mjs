#!/usr/bin/env node
/**
 * Unit tests for lib/insights.ts (battery regression + tip recommender). Pure functions, no server needed.
 *   npm run test:insights        (needs Node 22.6+ for --experimental-strip-types, or Node 23.6+)
 */
import { fitBatteryDrain, latestDischargeRun, minutesUntil, recommendTips, formatDuration } from '../lib/insights.ts'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name} ${detail}`)
  }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

const MIN = 60_000
const start = 1_700_000_000_000
const series = (levels, stepMin, charging = false) => levels.map((level, i) => ({ t: start + i * stepMin * MIN, level, charging }))

console.log('\n[battery regression]')
const exact = series([80, 78, 76, 74, 72, 70], 12) // 2% per 12 min = 10%/h, perfectly linear
const fit = fitBatteryDrain(exact)
check('recovers a known 10%/h drain rate', fit && near(fit.ratePerHour, 10, 0.01), JSON.stringify(fit))
check('perfect line has R² = 1', fit && near(fit.r2, 1, 1e-9))
check('predicts minutes to 10% from 70% (= 6 h)', fit && near(minutesUntil(70, 10, fit), 360, 0.5))
check('no prediction when already at/below target', fit && minutesUntil(8, 10, fit) === null)

const noisy = fitBatteryDrain(series([80, 79, 77, 76, 73, 72, 69], 10))
check('noisy data still gives a plausible positive rate', noisy && noisy.ratePerHour > 8 && noisy.ratePerHour < 14 && noisy.r2 > 0.9, JSON.stringify(noisy))

check('too few readings -> no forecast', fitBatteryDrain(series([80, 78, 76], 20)) === null)
check('readings spanning < 15 min -> no forecast', fitBatteryDrain(series([80, 79, 78, 77], 3)) === null)
check('flat battery -> no forecast', fitBatteryDrain(series([80, 80, 80, 80, 80], 10)) === null)
check('rising battery -> no forecast', fitBatteryDrain(series([50, 52, 54, 56, 58], 10)) === null)

const withCharge = [...series([30, 40, 50], 10, true), ...series([90, 88, 86, 84, 82], 10).map((s) => ({ ...s, t: s.t + 100 * MIN }))]
check('charging readings are excluded from the discharge run', latestDischargeRun(withCharge).length === 5)
check('forecast uses only the unplugged run', near(fitBatteryDrain(withCharge)?.ratePerHour ?? -1, 12, 0.01))
check('formatDuration', formatDuration(45) === '45 min' && formatDuration(125) === '2 h 5 min' && formatDuration(120) === '2 h')

console.log('\n[recommender]')
const base = {
  contactCount: 3, hasBloodGroup: true, hasPhone: true, powerTrigger: true, motionDetection: true,
  drillsDone: 2, mediaCount: 1, hour: 12, batteryLevel: 80, batteryRatePerHour: 5,
}
check('fully set-up user at noon gets no suggestions', recommendTips(base).length === 0, JSON.stringify(recommendTips(base).map((t) => t.id)))
const noContacts = recommendTips({ ...base, contactCount: 0 })
check('no contacts -> "add contacts" ranks first', noContacts[0]?.id === 'add-contacts', JSON.stringify(noContacts.map((t) => t.id)))
check('every suggestion carries a reason', noContacts.every((t) => t.because.length > 0))
check('power trigger off -> suggested', recommendTips({ ...base, powerTrigger: false }).some((t) => t.id === 'power-trigger'))
check('no drill yet -> drill suggested', recommendTips({ ...base, drillsDone: 0 }).some((t) => t.id === 'run-drill'))
check('missing blood group -> profile suggested', recommendTips({ ...base, hasBloodGroup: false })[0]?.id === 'complete-profile')
const night = recommendTips({ ...base, hour: 22 })
check('after dark -> route planning suggested', night.some((t) => t.id === 'night-route'), JSON.stringify(night.map((t) => t.id)))
check('low battery -> charge tip', recommendTips({ ...base, batteryLevel: 15 }).some((t) => t.id === 'charge-up'))
check('fast drain -> charge tip', recommendTips({ ...base, batteryRatePerHour: 20 }).some((t) => t.id === 'charge-up'))
const many = recommendTips({ ...base, contactCount: 0, powerTrigger: false, drillsDone: 0, hasBloodGroup: false, hour: 23 }, 3)
check('limit is respected and scores are sorted', many.length === 3 && many.every((t, i) => i === 0 || many[i - 1].score >= t.score))
check('scores are within 0..1', many.every((t) => t.score >= 0 && t.score <= 1))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
