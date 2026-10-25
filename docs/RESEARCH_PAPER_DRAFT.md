# SafeHer: A Privacy-Conscious, Offline-Resilient Women's Safety Application with On-Device Intelligence

> **Draft for editing.** Everything about the system and every measurement below comes from the SafeHer codebase and the tests run on it (Section 8 says exactly which). Items in **[brackets]** are things only you can supply: citations, crime statistics, author details, and any user study. Nothing in brackets has been invented. Remove this note before submitting.

**Authors:** [Names, department, institution, email]
**Keywords:** women's safety, emergency SOS, mobile application, Android, hybrid application, Capacitor, SQLite, on-device machine learning, fall detection, privacy

---

## Abstract

Women's personal-safety applications are widely available, but many depend on a constant network connection, overstate what they do (for example, implying that an alert was delivered when only a message screen was opened), or collect more personal data than the task requires. This paper presents **SafeHer**, an Android safety application designed around three principles: *honest reporting* of what the system actually did, *resilience* when connectivity or the web layer is unavailable, and *minimal, user-owned data*. SafeHer combines a hold-to-activate SOS with real GPS tracking, a power-button quick trigger implemented as a foreground service, a rule-based fall check-in that only ever asks "are you OK?", evidence capture (photo, audio, video), walking-route guidance with nearby help points, and an AI safety assistant behind a server proxy. Identity is handled by Firebase Authentication, while all application data lives in SQLite on the server, with a read-only SQLite mirror on the phone that powers a native Emergency Card that works with no network. On-device machine learning (text recognition and image labelling), a content-based tip recommender and a regression-based battery forecast provide the intelligent features. We describe the architecture, security model and implementation, and report results from 192 automated checks, an emulator evaluation of each native module, and a containerised production-mode test. We also state the limitations plainly, including that the fall detector and recommender have not yet been validated with real users or datasets.

---

## 1. Introduction

Personal safety is a daily concern for many women, particularly when travelling alone or at night. **[Insert one or two sentences with the latest national statistic on crimes against women and its citation, e.g. from NCRB. Do not quote a figure without a source.]** Smartphones are the one device most people carry at all times, which makes them a natural platform for safety tools: they can obtain a location fix, contact trusted people, and record evidence.

Existing applications, however, have recurring weaknesses that motivated this work:

1. **Overstated outcomes.** Some apps imply that an alert reached a contact when the app only opened a message screen. On Android, sending an SMS or placing a call without user action requires privileged permissions that are restricted by platform policy, so an honest application must say what it actually did.
2. **Network dependence.** A safety tool that shows an empty screen when the connection drops fails when it is needed most.
3. **Over-collection of personal data.** Location history, contacts and recordings are sensitive. Systems that upload them automatically or store them in third-party databases increase risk.
4. **Hard-to-trigger interfaces.** In danger, unlocking a phone and finding a button is slow; discreet quick triggers matter.

**Contributions.** This paper (i) presents the design of an Android safety application built on honest-by-design principles; (ii) describes a hybrid architecture in which a web application runs inside an Android shell with native modules for the parts the web layer cannot do (a power-button trigger, sensors, an offline screen); (iii) describes a privacy-oriented data model with a server-side SQLite database, identity-only use of Firebase, and a wipe-on-logout phone mirror; (iv) integrates on-device machine learning and lightweight statistical models, each labelled for what it is; and (v) reports an honest evaluation including defects found by testing.

## 2. Related Work

**[Add 8 to 15 real references here. Suggested structure and search terms are given so you can find genuine papers; do not copy citations you have not read.]**

- *Women's safety mobile applications:* surveys and comparisons of SOS apps (search: "women safety mobile application survey", "panic button application Android", "IoT women safety system").
- *Commercial and government apps:* e.g. national emergency-response apps and commercial personal-safety apps. **[Verify each app's current features from its own store page before describing it.]**
- *Fall and impact detection from smartphone sensors:* threshold-based and machine-learning approaches (search: "smartphone accelerometer fall detection", and the public datasets used for it **[verify names and licences before citing]**).
- *Hybrid mobile frameworks:* WebView-based hybrid apps versus native and cross-platform frameworks (search: "hybrid mobile application performance Capacitor Cordova").
- *On-device machine learning on Android:* ML Kit and similar frameworks; privacy benefits of on-device inference.
- *Recommender systems:* content-based filtering with cosine similarity (a standard reference text suffices).
- *Mobile privacy and data minimisation:* guidance on handling location and sensor data.

**Positioning.** SafeHer does not claim a new detection algorithm or a new learning method. Its contribution is the *combination and discipline* of the design: truthful status reporting, offline resilience and data minimisation, implemented and tested end to end.

## 3. Problem Statement and Objectives

**Problem.** Design and implement a mobile safety application that lets a user raise an emergency quickly, record where she is, reach trusted people, and keep useful information available even without a network, while never claiming outcomes it cannot verify and keeping the user's data under her control.

**Objectives.**
1. Provide a fast, accidental-press-resistant SOS with real GPS tracking.
2. Provide discreet triggers that work without opening the app.
3. Keep key information (identity, blood group, emergency contacts) available offline.
4. Support evidence capture and safe-route planning.
5. Add intelligent assistance (guidance, recommendations, forecasts) without sending sensitive data to unnecessary third parties.
6. Enforce strict per-user data isolation and server-side authentication.
7. Report every action and its limits truthfully.

## 4. System Architecture

SafeHer uses a layered hybrid architecture:

```
Android (Capacitor shell + native Kotlin/Java modules)
   └─ WebView loads → Next.js frontend (React 19, Tailwind)
         └─ HTTPS → Next.js API routes (/api/*)
               ├─ Firebase Admin SDK  → verifies the ID token, yields the user id
               └─ better-sqlite3      → SQLite database (WAL mode) + media files on disk
Phone:  local SQLite mirror (read-only copy) → native Emergency Card (no network)
```

**Components.**
- **Client shell.** Capacitor 8 hosts the web application in a WebView and exposes native modules to it through a plugin bridge.
- **Frontend.** A Next.js 16 / React 19 application with about 19 screens: home, SOS, live tracking, contacts, history, evidence, safe route, scanner, assistant, insights, settings and profile.
- **API layer.** 13 route handlers (profile, contacts, settings, SOS and SOS actions, location, trips, history, activity, media, assistant, health).
- **Identity.** Firebase Authentication (email/password and Google) is used **only** to establish identity; the server verifies the Firebase ID token on every request.
- **Application database.** SQLite with nine tables: users, emergency contacts, trips, SOS events, location points, SOS settings, activity logs, SOS actions and media metadata. Schema changes are additive and idempotent so existing data survives upgrades.
- **Native modules (Kotlin/Java).** A foreground service for the power-button trigger and fall detection, an Emergency Card Activity built from XML layouts, a local SQLite helper, ML Kit wrappers, a notification module and a WorkManager health check.
- **Deployment.** A Docker image running a single server instance with a persistent volume; HTTPS terminates at a reverse proxy.

**Why a hybrid design.** A single web codebase serves the interface and the API, which speeds development and keeps behaviour consistent. The capabilities a WebView cannot provide, namely observing hardware keys, running a background service, sensors with the screen off and a screen that works without the network, are implemented natively and exposed through a narrow bridge.

## 5. Methodology and Implementation

### 5.1 SOS and real location
The user holds the SOS control for 3, 5 or 10 seconds (configurable) to avoid accidental activation. The SOS record is created immediately; GPS fixes then attach as they arrive. Fixes are timestamped on the device and buffered, then replayed in order if the server is temporarily unreachable, so the recorded route reflects what happened rather than when the upload succeeded. A real SOS cannot be ended for the first 10 seconds, guarding against a panicked mis-tap, and **drills** run the identical flow with a flag so nobody is contacted.

### 5.2 Truthful contact actions
SafeHer opens the phone's dialer or SMS composer with the number and message filled in, and records that it was *opened*. It never records that a call connected or a message was delivered, because the operating system, not the app, controls that. This also means the app needs neither telephony nor SMS permissions.

### 5.3 Power-button quick trigger
Android does not deliver the power key to applications. SafeHer instead counts rapid screen-on/screen-off transitions inside a foreground service. After a configurable number of presses (3 to 6) in a short window, it raises a high-priority notification with a full-screen intent, wakes the device and opens the emergency screen, including from the lock screen. The feature is opt-in and best-effort: manufacturer battery savers can stop background services.

### 5.4 Fall check-in (rule-based)
The accelerometer is monitored only while the user has enabled the feature. A detection requires, in order: **free fall** (total acceleration below 4 m/s² for at least 100 ms), an **impact** (above 26 m/s² within 1 s), a short settling period, then **stillness** (within 1.8 m/s² of gravity for 2.5 s). Any real movement cancels it, and there is a 120-second cool-down. The result is a notification, "Are you OK?", reporting the measured values, with *I'm OK* and *Get help* actions. **Nothing is sent to anyone without the user's answer.** The detector is explicitly a threshold rule, not a learned model.

### 5.5 Offline Emergency Card and local database
After sign-in, on app resume and after profile or contact edits, the app copies the user's profile and contacts into a SQLite database on the phone. A second Android Activity, built from XML layouts (ConstraintLayout, LinearLayout, RelativeLayout with TextView, EditText, Button and ImageView), reads this mirror, so it opens instantly with no network and is reachable from a launcher shortcut. Calls from it use an `ACTION_DIAL` intent. The mirror is read-only apart from one user-typed medical note that never leaves the phone, and it is wiped on logout together with cached evidence and the battery log.

### 5.6 Evidence capture
Photos, audio and short video clips (up to 8 MB) are uploaded only when the user presses *Upload*. The server validates the declared type against the file's leading bytes (magic numbers), stores files under server-generated names, scopes each item to the verified user, and supports download through the system share sheet, so the user chooses the destination.

### 5.7 Navigation
The safe-route screen combines place search (Nominatim), walking directions with turn-by-turn steps (OSRM), nearby police stations, hospitals and pharmacies (Overpass, with mirror fallback), Leaflet/OpenStreetMap rendering, and a hand-off link to Google Maps.

### 5.8 Intelligent features
- **AI safety assistant.** A server proxy to the Gemini API keeps the key off the device. The system prompt forbids claiming that the assistant can contact anyone, and a separate keyword rule, independent of the model, pushes the emergency numbers to the front for messages that suggest danger. Requests are authenticated and rate limited (15 per minute per user). If the service is unavailable, the app shows a clearly labelled fixed-text guide.
- **On-device image classification and text recognition.** Google ML Kit models bundled in the app label photos and read text from identity or medical cards (Latin and Devanagari scripts) without uploading the image. A rule-based extractor then proposes the blood group, phone numbers, emergency contact, name, ID number and allergies for the user to confirm before saving.
- **Recommendation.** A content-based recommender represents the user's current situation (for example, no contacts, power trigger off, no drill practised, after dark, low battery) and each tip as vectors over nine topics, and ranks tips by cosine similarity. Every suggestion states its reason.
- **Prediction.** An ordinary-least-squares line is fitted to real battery readings taken while the user is not charging, giving a drain rate (% per hour) and a time to 10%. It requires at least four readings spanning at least 15 minutes, otherwise it says it is still collecting data.
- **Smart alerts.** An opt-in notification warns when the forecast puts the battery at 10% within about 45 minutes. It runs only while the app is open and contacts no one.

## 6. Security and Privacy Design

| Concern | Design |
|---|---|
| Authentication | Firebase ID token verified server-side on every protected route; the user id is taken **only** from the verified token, never from the request |
| Authorisation | Every query is scoped to that user id; tests confirm one user cannot read, modify or delete another's contacts, SOS, media or settings |
| Credentials | Passwords are never stored in SQLite; Firebase Admin and Gemini keys exist only in the server environment, never in the client or APK |
| Input handling | JSON bodies limited to 32 KB; parameterised SQL (a test stores an injection string as inert data); strict validation of enumerations and ranges |
| Transport and headers | HTTPS required for release builds; `nosniff`, HSTS and `no-store` headers; per-client rate limiting |
| Test hooks | Emulator tokens are ignored when running in production (verified) |
| Data minimisation | Evidence uploads are manual; ML runs on the device; the phone mirror is wiped on logout; the AI assistant never receives location or contacts |
| Honest reporting | Outcomes are recorded as *opened*, never *sent*; fixes are never fabricated; battery, network and GPS values are read from the device |

## 7. Experimental Setup

- **Environments.** Android emulator (Android API level 37, Pixel 8 profile) with a simulated GPS fix and accelerometer; Firebase Authentication Emulator and a scratch database for tests; a production-mode Docker container using the real Firebase project configuration.
- **Not used:** physical devices and real users. **[If you test on a real phone or run a user study, add it here.]**

## 8. Results

### 8.1 Automated tests
| Suite | Scope | Result |
|---|---|---|
| API end-to-end | Authentication, per-user isolation, SOS lifecycle, power-trigger and motion settings, pagination, size limits, security headers, evidence upload/validation/isolation, assistant authentication | **141 of 141** checks passed |
| Insights unit tests | Battery regression (known rate recovered exactly, noisy data, insufficient or rising data rejected, charging excluded) and recommender (ranking, reasons, no suggestions for a fully set-up user) | **23 of 23** |
| Scanner parser tests | Blood-group, name, phone and ID extraction, including the real recognised text and false-positive cases | **28 of 28** |

### 8.2 Native and system verification (emulator)
| Module | Observation |
|---|---|
| Emergency Card | Opened from the app and from a launcher shortcut with the server switched off; showed profile and contacts from the phone's SQLite; a typed note persisted across a force-stop; *Call* opened the dialer with the number filled in and placed no call |
| Sync and wipe | Mirror created after sign-in and updated after an edit; **contents, note, cached evidence and battery log were all cleared on logout** |
| Offline fallback | With the contacts API forced to fail, the page showed the saved copy with an explanatory banner |
| Image classification | Returned labels with confidence and timing for real photographs (73 and 258 ms on 640 px images); invalid input was rejected cleanly |
| Text recognition | Read all six lines of a rendered identity card in 228 ms |
| Fall check-in | A simulated sequence (510 ms free fall, a 30.1 m/s² impact, then stillness) produced the "Are you OK?" notification reporting those values; *Get help* opened the emergency screen and recorded an SOS with the `motion` source and the real GPS coordinates |
| Evidence | A real video recorded with the system camera was uploaded (stored as a valid MP4), previewed, and offered to the system share sheet; a 7.9 MB upload round-tripped byte-for-byte |
| Safe route | Place search and a 2.5 km walking route with 15 turn-by-turn steps from live services |
| AI assistant | Live responses in 2.1 to 3.7 s; a danger message returned the emergency numbers first and set the urgent flag |
| Smart alert | A synthetic low-battery history triggered the local notification (the history was injected for the test and removed) |
| Deployment | Docker image built; the container reported healthy, answered 401 on every protected endpoint without a token, and rejected emulator tokens |

### 8.3 Defects found by testing
Testing found and fixed several defects, which we report because they show where honest verification matters:
- The card parser returned *no blood group* for the line "Blood Group: B+" because a word-boundary pattern cannot match after a "+" sign, and ignored labelled names; both were fixed, including the common "B+ve" notation.
- A local-notification library opened the system "Alarms & reminders" screen and added an unneeded exact-alarm permission; it was replaced by a small native notifier.
- Uploaded evidence was not excluded from version control by default; it now is.
- The map-lookup service for nearby help was unavailable during testing and the app had no fallback; mirror fallback was added.

## 9. Discussion

**Honest reporting as a design constraint.** Treating "opened" and "sent" as different facts changed the data model (actions are recorded as *opened*), the interface wording and the permissions requested. We found this easier to maintain from the start than to retrofit.

**Offline resilience.** A hybrid app that loads its interface from a server shows nothing when the server is unreachable. The native Emergency Card is a deliberate answer: the most critical information has a path that does not depend on the web layer.

**Rule-based versus learned models.** Where a rule suffices (fall check-in, urgent-keyword detection), we used one and labelled it as such; where a pretrained model adds clear value (text recognition, image labelling), we used a bundled on-device model. We avoided presenting statistical methods as more than they are.

## 10. Limitations

- **Evaluation scope.** Testing used an emulator and simulated sensors; there has been no physical-device battery study, no field trial and no user study.
- **Fall detector.** Thresholds were chosen from standard reasoning and verified for logic, but **false-positive and false-negative rates have not been measured** against real fall and daily-activity recordings.
- **Recommender and forecast.** The recommender is unvalidated with users, and the battery forecast only runs while the app is open and needs about 15 minutes of unplugged data.
- **Quick trigger.** Best-effort: manufacturer battery optimisation can stop the background service.
- **Messaging.** The app does not send SMS or place calls itself; it opens the system apps, so the user must complete the action.
- **Storage.** SQLite and evidence files are not encrypted at rest on the server, email verification is not implemented, and a single SQLite instance does not scale horizontally.
- **Third-party services.** Maps, geocoding and the AI assistant depend on external services whose availability and policies can change; in testing one public map server was temporarily down.
- **Firebase usage.** Firebase is used only for identity; the application does not use Firestore or Realtime Database for synchronisation, which is a deliberate privacy and simplicity choice rather than an omission.

## 11. Future Work

1. A user study with a standard usability instrument (e.g. the System Usability Scale) and task-completion timing. **[Plan: N participants, tasks such as "start and cancel a drill", "add a contact", "find the nearest police station".]**
2. Measure fall-detection accuracy against public smartphone fall datasets and replace the thresholds with a validated or learned model if warranted.
3. A background location service with clear user control, and measured battery cost.
4. Optional end-to-end or at-rest encryption for evidence; email verification; a networked database for multi-instance deployment.
5. Optional cloud synchronisation for users who want it, with explicit consent.
6. Multilingual interface and assistant, and accessibility evaluation.

## 12. Conclusion

SafeHer demonstrates that a women's safety application can be fast, offline-resilient and privacy-conscious without overstating what it does. Its hybrid architecture places critical capabilities in native modules, keeps identity separate from application data, runs intelligent features on the device wherever possible, and reports each action truthfully. The automated tests and emulator evaluation support the correctness of the implementation, and the limitations identify the evidence still needed before claims about real-world effectiveness can be made.

## References

**[Add your real references here in your target format (IEEE / APA).]**

---

## Appendix A: Measurements you can still collect (to strengthen the Results section)

These need a running build and are not yet in this draft:

| Metric | How to collect |
|---|---|
| SOS activation latency (hold complete → record saved) | Add timestamps in the client and server logs; repeat 30 times, report mean and standard deviation |
| Time to first GPS fix | Record per attempt on a physical device outdoors |
| Power-trigger reliability | N presses per attempt, count successes, on 2 or more phone brands |
| Fall-detector false alarms | Carry the phone through daily activities for a day with the feature on; count alerts |
| Battery cost of protection service | Compare drain with and without it over equal periods |
| Usability | System Usability Scale with a small group |

## Appendix B: Feature-to-requirement summary

| Requirement | Feature |
|---|---|
| Quick, safe activation | Hold-to-activate SOS, cancellation guard, drills |
| Discreet trigger | Power-button trigger, fall check-in |
| Offline availability | Native Emergency Card, phone SQLite mirror, offline contacts |
| Evidence | Photo, audio, video upload, download and share |
| Navigation | Walking routes, nearby help, Google Maps hand-off |
| Intelligence | Assistant, text recognition, image labelling, recommender, battery forecast, smart alerts |
| Privacy and security | Server-side token verification, per-user scoping, wipe on logout, on-device ML |
