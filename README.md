# SafeHer – Women Safety Application

SafeHer is a secure, full-stack personal safety companion application designed to keep users protected and within reach of their emergency networks. This version has been fully integrated with Firebase Authentication (for credentials and session handling) and a local SQLite database (for profiles, settings, and SOS logging), prioritizing **Trustworthy Behaviour over Visual Simulation**.

---

## Key Features

1. **Secure Registration & Logins**: Fully handled via Firebase Authentication. Supports Email/Password signup/login and Google Sign-In. Apple Sign-In is disabled for this self-hosted version due to configuration limits.
2. **Indian Helpline Standard**: Auto-configured to connect to India's unified helpline **112**.
3. **Emergency Actions**: Dynamically loads contacts from SQLite. Pre-fills standard calling (`tel:`) and text messaging (`sms:`) clients with Google Maps coordinates. The UI accurately records statuses like "SMS Pre-filled" and "Call Dialing" rather than claiming delivery.
4. **Interactive Mapping**: Implements a real Leaflet + OpenStreetMap canvas focused on the user's actual browser GPS location (showing an accuracy radius). Displays empty/loading states instead of faking coordinates if GPS is unavailable.
5. **Real-Time GPS Tracking**: Foreground tracking updates are throttled using time and distance thresholds before being saved to SQLite.
6. **Battery & Network Integration**: Queries native browser APIs directly and shows "Unavailable" if unsupported.
7. **Drill Mode / Silent Test**: Lets users practice triggering the SOS flow. Records a mock SOS session inside SQLite marked as a `Test` event, without attempting external alerts.
8. **In-Memory Audio Recording**: Records surrounding audio context using `MediaRecorder` and displays a session playback element. The UI clearly warns that recordings are stored temporarily in-memory and will be lost on tab exit.

---

## System Architecture

```
Client (Next.js App)
  │
  ├─► Geolocation watchPosition (Foreground)
  ├─► Leaflet Map + OpenStreetMap
  ├─► Firebase Auth Client SDK (Google Sign-In / ID Token)
  │
  ▼ (Authorization: Bearer <ID_Token>)
Next.js Route Handlers / API Layer (Server-Side)
  │
  ├─► Firebase Admin SDK (ID Token Verification & UID extraction)
  │
  ▼ (Queries scoped by verified UID)
Local SQLite Database (data/safeher.db)
```

---

## Setup Instructions

### 1. Environment Variables
Create a file named `.env.local` in the root directory (this file is gitignored). Populate it with your Firebase configuration parameters:

```env
# --- Application Configuration ---
NEXT_PUBLIC_APP_NAME=SafeHer
NEXT_PUBLIC_EMERGENCY_NUMBER=112
NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL_MS=5000
NEXT_PUBLIC_LOCATION_MIN_DISTANCE_METERS=5

# --- Firebase Client SDK Configuration ---
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# --- Firebase Admin SDK Configuration ---
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ...\n-----END PRIVATE KEY-----\n"
```

### 2. Manual Firebase Console Steps
1. Navigate to the **Firebase Console** and create a project.
2. Under **Build -> Authentication**, enable **Email/Password** and **Google** as Sign-in providers.
3. Under Project Settings -> General -> Your Apps, click the **Web icon** (`</>`) to register a web app and copy the config values.
4. Under Project Settings -> Service Accounts, click **Generate New Private Key** to download the JSON service account. Copy the `client_email` and `private_key` fields to your `.env.local`.

---

## Commands to Run

### Install Dependencies
```bash
npm install
```

### Initialize SQLite Database
```bash
npm run db:init
```

### Start Development Server
```bash
npm run dev
```

---

## Database Schemas

### `users`
Stores user profile information synced to the Firebase UID.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `firebase_uid` (TEXT UNIQUE NOT NULL)
- `full_name` (TEXT NOT NULL)
- `email` (TEXT UNIQUE NOT NULL)
- `phone` (TEXT)
- `blood_group` (TEXT)
- `language` (TEXT DEFAULT 'English')
- `photo_url` (TEXT)
- `created_at` (TEXT)
- `updated_at` (TEXT)

### `emergency_contacts`
Stores trusted contacts created by each user. Scoped to the owner's Firebase UID.
- `id` (TEXT PRIMARY KEY)
- `firebase_uid` (TEXT NOT NULL, FOREIGN KEY)
- `name` (TEXT NOT NULL)
- `relationship` (TEXT NOT NULL)
- `phone` (TEXT NOT NULL)
- `email` (TEXT)
- `priority` (TEXT CHECK(priority IN ('High', 'Medium', 'Low')))
- `created_at` (TEXT)
- `updated_at` (TEXT)

### `sos_events`
Logs safety drills or real SOS activations.
- `id` (TEXT PRIMARY KEY)
- `firebase_uid` (TEXT NOT NULL, FOREIGN KEY)
- `started_at` (TEXT NOT NULL)
- `ended_at` (TEXT)
- `latitude` (REAL)
- `longitude` (REAL)
- `accuracy` (REAL)
- `status` (TEXT CHECK(status IN ('Preparing', 'Activating', 'Active', 'Attempted', 'Completed', 'Failed', 'Cancelled', 'Unavailable')))
- `contacts_notified` (INTEGER DEFAULT 0)

### `location_points`
Stores location history coordinates throttled during trips or active SOS sessions.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `firebase_uid` (TEXT NOT NULL, FOREIGN KEY)
- `sos_event_id` (TEXT, FOREIGN KEY)
- `trip_id` (TEXT, FOREIGN KEY)
- `latitude` (REAL NOT NULL)
- `longitude` (REAL NOT NULL)
- `accuracy` (REAL)
- `recorded_at` (TEXT NOT NULL)

### `sos_settings`
Configures preferences per user profile.
- `firebase_uid` (TEXT PRIMARY KEY, FOREIGN KEY)
- `hold_duration` (INTEGER DEFAULT 3)
- `location_sharing` (INTEGER DEFAULT 1)
- `audio_recording` (INTEGER DEFAULT 0)
- `notify_contacts` (INTEGER DEFAULT 1)
- `updated_at` (TEXT)

---

## Known Browser Restrictions
- **Background Location**: Standard web browsers restrict GPS tracking once the application tab is minimized or closed. True background execution requires a native mobile wrapper.
- **Auto-SMS / Auto-Calling**: Web applications cannot programmatically dial or send text messages silently due to browser sandboxing. Clicking actions pre-fills the system's dialer (`tel:`) or messaging client (`sms:`), prompting the user to send or dial manually.
- **Ephemeral Database Warning**: Since this uses local SQLite (`data/safeher.db`), data is persistent on self-hosted instances. However, deploying to serverless platforms with ephemeral file storage (like Vercel or Netlify) will result in database state resets on redeployment or server sleep.
