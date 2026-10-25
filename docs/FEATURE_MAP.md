# Feature map: course tasks vs. SafeHer

Status is given honestly: **Verified** means it was run and observed (emulator or tests); **Implemented, not verified** means the code builds but was not exercised end to end.
Architecture rules that shape these choices: Firebase is used for sign-in only, the application database is SQLite, and there is no Firestore / Realtime Database.

## Task 1: UI and multi-screen navigation

| Item | Where | Status |
|---|---|---|
| Multi-screen navigation | ~20 routes in `app/` (home, contacts, SOS, history, map, evidence, scanner, insights...), bottom nav, back handling (`components/android-back-handler.tsx`) | Verified on emulator |
| Activities and Intents | `MainActivity` (WebView) and `EmergencyCardActivity`: explicit Intent from the app (`LocalStorePlugin.openEmergencyCard`) and from a launcher shortcut; Intent back to `MainActivity`; `ACTION_DIAL` Intents to call | Verified: card opened from bridge and from the shortcut, dialer opened with the number filled in |
| XML layouts | `res/layout/activity_emergency_card.xml` (ConstraintLayout + ScrollView + LinearLayout + RelativeLayout footer), `item_card_contact.xml` (RelativeLayout) | Verified (screenshots) |
| TextView / EditText / Button / ImageView | All four on the Emergency Card; the EditText note is saved to SQLite | Verified: note survives a force-stop |

## Task 2: Database and cloud synchronisation

| Item | Where | Status |
|---|---|---|
| SQLite on the server | `backend/db/schema.cjs`, better-sqlite3; CRUD for profile, contacts, settings, SOS, trips, media | Verified: `npm run test:api` (142 checks) |
| SQLite on the device | `android/.../LocalDb.kt` (`SQLiteOpenHelper`): contacts, profile mirror, local-only medical note | Verified: mirror written after login, updated on edits, survives app reinstall, wiped on logout |
| Sync | `components/offline-sync.tsx`: after sign-in, on app resume and after profile/contact edits, the server copy is mirrored to the phone. The phone copy is read-only; the server stays the source of truth | Verified (sign-in sync and edit-event sync) |
| Offline use | Contacts page falls back to the phone copy when the API is unreachable; the Emergency Card works with no network | Verified (API forced to fail; card opened with the server off) |
| Firebase Realtime Database / Firestore | **Not implemented, deliberately.** The project rule is Firebase for authentication only, and the phone-to-server sync above covers the same need. Adding either is a decision for the project owner | n/a |
| Room | Plain `SQLiteOpenHelper` was used instead (no annotation-processor dependency); same SQLite engine | n/a |

## Task 3: Multimedia, network and location

| Item | Where | Status |
|---|---|---|
| REST API | `app/api/*`, all authenticated with a verified Firebase ID token | Verified (tests) |
| Upload | `app/api/media` (photo / audio / video, magic-byte checks, 8 MB limit, per-user isolation) | Verified: tests, plus a real video recorded on the emulator and uploaded |
| Download | Evidence page: browser download, or Android share sheet (`lib/media.ts#downloadMedia`); cached copies purged on next download and on logout | Verified: share sheet opened with the real MP4 |
| Camera / gallery | `@capacitor/camera` for photos; system file chooser for video | Camera video verified on emulator; gallery pickers use the same code paths (not separately exercised) |
| Audio | `lib/hooks/use-audio-recorder.ts` | Implemented. **Not verified**: browsers and WebViews only expose the microphone on HTTPS, and the test server was plain HTTP. Verify it once on your HTTPS deployment |
| Video | Record or choose a clip, preview, upload, play back, download | Verified (record, upload; playback in the preview) |
| GPS | `lib/location.ts`, real fixes only | Verified in earlier sessions |
| Maps | Leaflet + OpenStreetMap (chosen in the original brief), not the Google Maps SDK | n/a |
| Campus / route navigation | `app/navigate`: place search (Nominatim), OSRM walking route with turn-by-turn steps, **Open in Maps** (Google Maps walking-directions link), nearby police / hospital / pharmacy (Overpass, with mirror fallback) | Verified on emulator: search, a 2.5 km route with 15 steps, live GPS marker. Nearby search showed its error message correctly while the public Overpass server was down (HTTP 502); it succeeding was not seen |

## Task 4: AI

| Item | Where | Status |
|---|---|---|
| Chatbot | `app/assistant` + `app/api/assistant` (Gemini through a server proxy; key stays on the server). Without a key it answers 503 and the app shows a clearly labelled fixed-text guide (`lib/offline-guide.ts`) | Verified live with a real key: normal answers in 2 to 4 s, and an emergency message returns the emergency numbers first with `urgent: true`. Auth, rate limit and the not-configured path are covered by tests |
| Image classification | `ImageClassifierPlugin.kt`: ML Kit Image Labeling (bundled model, on-device), used in the Scanner | Verified on emulator with real photos; invalid images are rejected. Labels are general and can be wrong |
| Text recognition | `TextScannerPlugin.kt` (ML Kit OCR) + `lib/emergency-info.ts` (field extraction) | Verified: on a rendered test card the model read all 6 lines in 228 ms. Testing the extractor on that real output found two bugs (blood group and name came back empty); both fixed, and 28 unit tests now cover it |
| Recommendation | `lib/insights.ts#recommendTips`: content-based, cosine similarity between the user's real state and tip topics | Verified: 11 unit tests, and on the device with real account data |
| Prediction | `lib/insights.ts#fitBatteryDrain`: least-squares linear regression on real battery readings | Verified: 12 unit tests; the page shows "collecting data" until there are enough readings |
| Smart alerts / notifications | Battery-forecast notification (`SmartAlertPlugin.kt`, opt-in, only while the app is open); fall check-in (`MotionAnomalyDetector.kt`, rule-based, asks "are you OK?") | Both verified on the emulator. Battery alert used an injected test history. Fall check-in: simulated accelerometer free-fall, impact and stillness produced the "Are you OK?" notification with the measured values, and "Get help" opened the emergency screen with a `motion` SOS and real GPS. The "I'm OK" answer was not separately exercised |

These are classic statistical methods and a bundled pretrained model. Nothing here is trained on user data, and the UI labels each method for what it is.
