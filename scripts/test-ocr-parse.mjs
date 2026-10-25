#!/usr/bin/env node
/**
 * Unit tests for lib/emergency-info.ts (field extraction from OCR text).
 *   npm run test:ocr        (needs Node 22.6+)
 * The first case is the exact text ML Kit returned for a rendered test card on the Android emulator.
 */
import { extractEmergencyInfo } from '../lib/emergency-info.ts'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`) } else { failed++; console.log(`  FAIL  ${name} ${detail}`) }
}
const x = extractEmergencyInfo

const real = x('MEDICAL ID CARD\nName: Priya Sharma\nBlood Group: B+\nPhone: 98765 43210\nEmergency Contact: 91234 56780\nAllergic to penicillin')
console.log('\n[real ML Kit output]')
check('blood group B+ from "Blood Group: B+" (end of line)', real.bloodGroup === 'B+', JSON.stringify(real.bloodGroup))
check('labelled name', real.name === 'Priya Sharma', JSON.stringify(real.name))
check('own phone', real.phone === '9876543210', real.phone)
check('emergency contact phone', real.emergencyContact?.phone === '9123456780')
check('allergy', real.allergies === 'penicillin', real.allergies)

console.log('\n[blood group variants]')
for (const [text, want] of [
  ['Blood Group: O-', 'O-'], ['Blood group AB+ve', 'AB+'], ['Blood Group: O-ve', 'O-'], ['B+ve', 'B+'], ['B.Group : AB-', 'AB-'], ['Blood: A POSITIVE', 'A+'],
  ['Blood Group: O NEG', 'O-'], ['blood group: a+', 'A+'], ['DONOR CARD\nB+', 'B+'], ['Blood Group: B+ Rh', 'B+'],
]) {
  const got = x(text).bloodGroup
  check(`${JSON.stringify(text)} -> ${want}`, got === want, `got ${got}`)
}

console.log('\n[no false positives]')
check('"Plan A - review" is not a blood group', x('Plan A - review the notes').bloodGroup === null)
check('"to-do" is not a blood group', x('to-do list and a-b testing').bloodGroup === null)
check('"O Level" is not a blood group', x('O Level certificate').bloodGroup === null)
check('"Vitamin B+ complex" without label is tight-matched (acceptable)', ['B+', null].includes(x('Vitamin B complex').bloodGroup))
check('"AB123" is not a blood group', x('Ref AB123').bloodGroup === null)

console.log('\n[names]')
check('"Name: Dr. Asha Rao"', x('Name: Dr. Asha Rao').name === 'Dr. Asha Rao')
check('unlabelled capitalised name on a card', x('Priya Sharma\n+91 98765 43210').name === 'Priya Sharma')
check('government header is not a name', x('Government Republic\nIdentity Card').name === null)
check('labelled but garbage value rejected', x('Name: 12345 !!!').name === null)

console.log('\n[ids and phones]')
check('Aadhaar', x('1234 5678 9012').idNumber === 'Aadhaar: 1234 5678 9012')
check('PAN', x('ABCDE1234F').idNumber === 'PAN: ABCDE1234F')
check('+91 phone normalised', x('Mobile +91 98765-43210').phone === '+919876543210' || x('Mobile +91 98765-43210').phone === '9876543210')
check('empty text -> all null', (() => { const e = x(''); return !e.bloodGroup && !e.phone && !e.name && !e.idNumber && !e.allergies && !e.emergencyContact })())

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
