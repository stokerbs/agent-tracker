# Detective Pulse — Native Field Agent App (Capacitor)

The native iOS/Android app is a **Capacitor remote-URL shell**: it loads the live
site (`https://detectivepulse.app/field`) in the system WebView and bridges in native
camera, GPS, and push. The web app is unchanged for browser users — all native code
is guarded by `isNative()` (`src/lib/native/index.ts`).

This file is the runbook for the parts that must run on **your Mac** (native SDKs and
accounts aren't available in CI). Phase A below gets a real app on a device.

## Prerequisites
- macOS with **Xcode** (iOS) and **Android Studio** + JDK 17 (Android).
- CocoaPods (`sudo gem install cocoapods`).
- Node deps installed: `npm install`.

## Phase A — first device build

```bash
# 1. Generate the native projects (creates ios/ and android/). One-time.
npx cap add ios
npx cap add android

# 2. Sync web config + plugins into the native projects (re-run after any
#    capacitor.config.ts or plugin change).
npm run cap:sync

# 3. Run on a device/simulator.
npm run cap:ios       # or: npx cap open ios   (then Run in Xcode)
npm run cap:android   # or: npx cap open android
```

By default the app loads `https://detectivepulse.app/field`. To point at a local dev
server during development:

```bash
CAP_SERVER_URL=http://<your-LAN-ip>:3000/field npm run cap:sync
```

### Native permission strings (required or the app crashes on first use)

**iOS** — add to `ios/App/App/Info.plist`:
- `NSCameraUsageDescription` — "Capture evidence photos for your assigned cases."
- `NSPhotoLibraryUsageDescription` — "Attach photos from your library to case evidence."
- `NSLocationWhenInUseUsageDescription` — "Report your position to the operations map while on duty."
- (Phase B) `NSLocationAlwaysAndWhenInUseUsageDescription` + enable the **Location updates** Background Mode.

**Android** — add to `android/app/src/main/AndroidManifest.xml`:
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.CAMERA`
- `android.permission.POST_NOTIFICATIONS` (Android 13+)
- (Phase B) `android.permission.ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE`

### Database
Apply the device-token migration before testing push registration:
```bash
supabase db push     # applies supabase/migrations/0068_device_tokens.sql
```

### What works after Phase A
- App boots into `/field`; SMS-OTP login + session persist in the WebView.
- **Camera**: the green "Camera" button in the log-observation sheet captures a photo
  via the native camera and attaches it to the timeline entry's evidence.
- **GPS (foreground)**: the app reports position to `/api/agents/location` while open.
- **Push token**: on launch the device token is stored in `device_tokens`
  (delivery is wired in Phase B).

## Phase B — background GPS, push delivery, store submission (not built yet)
- Background GPS: add `@capacitor-community/background-geolocation`; add a Bearer
  device-token auth branch to `/api/agents/location` (background HTTP has no webview
  cookies); iOS background mode + Android foreground service.
- Push delivery: Firebase project (FCM) with an APNs `.p8` key; add
  `google-services.json` / `GoogleService-Info.plist`; `src/lib/push/send.ts` (FCM
  HTTP v1) hooked into `notifyUsers()`.
- Store: Apple Developer ($99/yr) + Google Play ($25 once); app icons/splash,
  screenshots, privacy (location/camera) declarations; TestFlight / internal testing.

## Notes
- Re-run `npm run cap:sync` after changing `capacitor.config.ts`, adding plugins, or
  upgrading Capacitor.
- The native projects (`ios/`, `android/`) are conventionally committed so native
  config (permission strings, icons) is versioned — commit them after `cap add`.
- CSP in `next.config.ts` already allows the `capacitor:` scheme for the bridge and
  camera previews.
