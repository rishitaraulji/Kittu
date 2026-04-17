# 💕 Krisha — Love Knows No Distance

A beautiful, mobile-first web application built for long-distance couples. Krisha keeps partners emotionally close through real-time mood syncing, secret sharing, quick love interactions, and emergency features — all wrapped in a romantic dark UI.

---

## 🌟 App Overview

**App Name:** Krisha  
**Tagline:** *Love knows no distance 💕*  
**Design Theme:** Deep dark background (#0a0a0f) with pinkish-red glow accents (#ff2d6f), glassmorphism cards, floating particles  
**Font:** Poppins + Dancing Script  
**Layout:** Mobile-first, max-width 430px, centered SPA  

---

## ✅ Completed Features

### 🔐 Authentication
- **Create Account** — Full name, email, password, partner email, profile photo upload
- **Login** — Email + password validation
- **Touch ID (Fingerprint)** — WebAuthn / simulated biometric login
- **Face ID** — Animated face scan simulation
- **Forgot Password** — Email-based reset (demo mode)
- **Quick Login Buttons** — One-tap demo account login (Alex / Jordan)
- **Auto-login** — Returns logged-in users directly to Home

### 🏠 Home Dashboard
- Krisha logo top bar with notification bell + badge
- **Partner Status Card** — Avatar, name, live mood display, "Connected 💚" pulse indicator
- **Miss/Love counters** — Tracks how many times you've sent love today
- **Mood Selector** (8 moods) — 😊 Happy, 😢 Sad, 😍 In Love, 😤 Angry, 😴 Sleepy, 🥰 Missing You, 😌 Peaceful, 🥳 Excited
- **Quick Action Grid:**
  - 💌 **I Miss You** — Sends notification to partner, increments counter
  - ❤️ **I Love You** — Triggers full-screen floating hearts animation + notification
  - 🔐 **Share Secret** — Opens secret editor modal
  - 🆘 **Emergency** — Opens emergency alert modal

### 🔐 Secrets Screen
- List of all shared secrets with glassmorphism cards
- **Blurred by default** — Tap any secret to reveal it
- **Category tags** — 💕 Romantic, 😄 Funny, 🌟 Dream, 🙏 Wish, 💭 Thought
- **Add Secret Modal** — Category selector + text area (500 char limit) + send button
- Partner is notified when a secret is added

### 💫 Mood Tracker Screen
- Your current mood with animated emoji + glow aura
- Partner's live mood (syncs every 3 seconds)
- 7-day mood history timeline
- Mood statistics (most frequent mood, days tracked, miss count)

### 👤 Profile Screen
- Large avatar with tap-to-change photo
- Partner connection card (shows partner name + email)
- Connect / disconnect partner
- Settings: Change Password, Notifications toggle, Privacy, Help
- Sign Out button

### 🔔 Notifications
- In-app notification panel (slide-in from right)
- Unread count badge on bell icon
- Notification types: mood change, miss you, love you, secret added, emergency, partner connect
- Clear all notifications

### 🚨 Emergency Feature
- Big 🆘 pulsing icon
- **Call Partner** button (tel: link)
- **Send SOS Alert** button
- 3 pre-written emergency message templates

### ✨ Animations
- Floating particles/stars on background (canvas-based)
- Orbiting sparkle dots on splash screen logo
- Full-screen floating hearts when "I Love You" is pressed
- Fingerprint glow pulse animation
- Face ID scan line animation
- Smooth screen fade/slide transitions
- Mood aura breathing animation
- Emergency icon bounce

---

## 🗂️ Data Models (localStorage)

```javascript
// Users Table
users: {
  "email@example.com": {
    email, password, name, avatar, avatarEmoji,
    partnerEmail, mood, moodEmoji, moodUpdated,
    moodHistory: [{ mood, emoji, day, time }],  // last 7 days
    missCount, loveCount, joinedAt
  }
}

// Secrets
secrets: [
  { id, fromUser, fromEmail, toEmail, text, category, timestamp, revealed }
]

// Notifications
notifications: [
  { id, toEmail, type, icon, message, timestamp, read }
]

// Session
currentUser: "email@example.com"  // currently logged-in user's email
```

---

## 🧪 Demo Accounts

| Name | Email | Password | Partner |
|------|-------|----------|---------|
| Alex Rivera | user1@test.com | pass123 | Jordan Lee |
| Jordan Lee | user2@test.com | pass123 | Alex Rivera |

> Use the **"Login as Alex"** or **"Login as Jordan"** quick-login buttons on the Login screen.

---

## 📂 File Structure

```
index.html    — Complete single-file SPA (HTML + CSS + JS embedded)
README.md     — This documentation
```

---

## 🚀 Entry Points

| Screen | How to Access |
|--------|--------------|
| Splash | First load / sign out |
| Register | "Get Started" on Splash |
| Login | "Sign In" on Splash |
| Home | After successful login |
| Secrets | Bottom nav → lock icon |
| Mood | Bottom nav → heart icon |
| Profile | Bottom nav → user icon |
| Notifications | Bell icon in top bar |
| Emergency Modal | 🆘 button on Home |
| Secret Modal | 🔐 button on Home or FAB on Secrets |
| Partner Connect | Home partner card or Profile |

---

## 🔮 Recommended Next Steps

1. **Real Firebase Integration** — Replace localStorage with Firestore for true real-time sync
2. **Push Notifications** — Firebase Cloud Messaging for background alerts
3. **Real Biometric Auth** — WebAuthn Credential API with server storage
4. **Voice Messages** — Record and send short audio secrets
5. **Couple Timeline** — Photo/memory journal shared between partners
6. **Anniversary Countdown** — Days together counter widget
7. **Love Letters** — Long-form formatted letters feature
8. **Video Call** — WebRTC-based in-app video calling
9. **Dark Mode Toggle** — While it's dark by default, add light mode option
10. **PWA Support** — Add manifest.json + service worker for installable app

---

## 📱 Android APK Build (Capacitor)

This project is now configured to build an Android app using Capacitor.

### Added Setup

- `package.json` with Capacitor dependencies and build scripts
- `capacitor.config.json` (`appId: com.krisha.app`, `appName: Krisha`, `webDir: web`)
- `android/` native Android project
- `web/index.html` as the mobile web asset entry

### Build Commands

```bash
npm run apk:debug
```

This command will:

1. Copy latest `index.html` to `web/index.html`
2. Sync Capacitor assets/plugins into Android project
3. Build debug APK with Gradle

### Output APK Path

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### If Build Fails with "SDK location not found"

Install Android Studio + Android SDK, then create `android/local.properties` with:

```properties
sdk.dir=C:\\Users\\<YourUser>\\AppData\\Local\\Android\\Sdk
```

Or set environment variable:

```bash
ANDROID_HOME=C:\Users\<YourUser>\AppData\Local\Android\Sdk
```

## Important: Partner Sync on Different Phones

This version stores app data in `localStorage` only. That means:

- Partner sync works only for accounts available on the same app storage.
- Two different physical phones cannot live-sync with each other yet.

For real cross-phone partner connection, replace localStorage with a cloud backend (Firebase Firestore / Supabase / your own API).

## iOS Build (Capacitor)

Added iOS support scripts in `package.json`.

1. Install dependencies:

```bash
npm install
```

2. Add iOS platform (run once):

```bash
npm run ios:add
```

3. Sync web assets to iOS project:

```bash
npm run ios:sync
```

4. Open in Xcode:

```bash
npm run ios:open
```

5. In Xcode, choose simulator/device and build.

Note: iOS build requires macOS + Xcode.

## iOS .ipa Build via GitHub Actions

This repository now includes [`.github/workflows/build-ios-ipa.yml`](.github/workflows/build-ios-ipa.yml) to build an `.ipa` on GitHub-hosted macOS.

### Required GitHub Secrets

- `IOS_CERT_BASE64`: Base64 of your `.p12` iOS distribution certificate
- `IOS_CERT_PASSWORD`: Password for the `.p12` certificate
- `IOS_PROVISIONING_PROFILE_BASE64`: Base64 of your `.mobileprovision` profile
- `KEYCHAIN_PASSWORD`: Any strong temporary password used by the CI keychain

### How to run

1. Push your code to GitHub.
2. Add the secrets in your GitHub repository settings.
3. Run workflow: **Actions -> Build iOS IPA -> Run workflow**.
4. Download artifact: `ios-ipa` (contains the built `.ipa`).

Because `.ipa` packaging requires Xcode, it cannot be generated locally from Windows.

## MongoDB Live Sync (Android + iOS)

This project now includes MongoDB sync for users, secrets, and notifications using MongoDB Data API.

### 1. Create MongoDB setup

- Create a MongoDB Atlas cluster
- Create an App Services app and enable Data API
- Create API key and allow access to your database

### 2. Add config in app

In `index.html`, define this global before app startup:

window.KRISHA_MONGO_CONFIG = {
  baseUrl: "https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1",
  apiKey: "YOUR_DATA_API_KEY",
  dataSource: "Cluster0",
  database: "krisha",
  collections: {
    users: "users",
    secrets: "secrets",
    notifications: "notifications"
  }
};

Alternative: save JSON in localStorage under key `krisha_mongo_config`.

### 3. MongoDB collections used

- users (document `_id`: URL-encoded email)
- secrets (document `_id`: secret id)
- notifications (document `_id`: notification id)

### 4. Sync model

- Local app writes are upserted to MongoDB Data API
- App polls cloud every 3 seconds and merges updates
- Works across Android and iOS when both use same MongoDB project

### 5. Security note

Do not ship production API keys directly in client code.
For production, use a secure backend proxy with user auth and scoped permissions.

---

## 💡 Tech Stack

- **Frontend:** Pure HTML5 + CSS3 + Vanilla JavaScript
- **Storage:** localStorage + MongoDB Data API (optional cloud sync)
- **Fonts:** Google Fonts (Poppins + Dancing Script)
- **Icons:** Font Awesome 6.4.0
- **Animations:** CSS keyframes + Canvas particles
- **Architecture:** Single-page application (SPA) with screen routing
