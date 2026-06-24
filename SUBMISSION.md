# App Store pre-submission checklist — Detective Pulse Field (iOS)

App facts (from the project): bundle id `app.detectivepulse.field`, display name
**Detective Pulse Field**, version **1.0 (build 1)**, Team `3N6ASD49Q2`,
Capacitor remote-URL shell loading `https://detectivepulse.app/field`.
Uses: **camera**, **photo library**, **background location (GPS)**, **push (APNs)**.

---

## 0. Blockers — fix before you archive a build

- [ ] **🚫 Add the missing privacy usage strings to `ios/App/App/Info.plist`.**
      The app accesses camera and (background) location, but **none** of the
      `NS*UsageDescription` keys are present. iOS **hard-crashes** on first access
      and App Review rejects under Guideline 5.1.1. Required:
  - `NSCameraUsageDescription` — "Capture evidence photos for your assigned cases."
  - `NSPhotoLibraryUsageDescription` — "Attach photos from your library to case evidence."
  - `NSPhotoLibraryAddUsageDescription` — "Save captured evidence photos to your library." *(only if the app writes to the library; drop otherwise)*
  - `NSLocationWhenInUseUsageDescription` — "Report your position to the operations map while on duty."
  - `NSLocationAlwaysAndWhenInUseUsageDescription` — "Continue reporting your position to dispatch while on assignment, even in the background."
- [ ] **Finish APNs key** (separate track): create the APNs Auth Key (.p8), enable
      Push on the App ID, set `APNS_KEY_ID` + `APNS_PRIVATE_KEY` in Vercel. Push is
      not required to ship, but the Push capability is in the entitlements, so the
      App ID **must** have Push enabled or signing/upload may warn.

## 1. Apple Developer / App Store Connect setup

- [ ] Apple Developer Program active ($99/yr), Team `3N6ASD49Q2`.
- [ ] App ID `app.detectivepulse.field` registered with **Push Notifications** capability.
- [ ] App record created in App Store Connect (name, primary language, bundle id).
- [ ] Distribution signing: automatic signing with a Distribution certificate +
      App Store provisioning profile (Xcode → Signing & Capabilities).

## 2. App Privacy (nutrition labels) — questionnaire in App Store Connect

Declare every data type the app collects. Based on the code:
- [ ] **Precise Location** — collected, **used in background**, *linked to identity*,
      purpose: App Functionality. (Background location draws extra scrutiny — see §5.)
- [ ] **Photos** (evidence uploads) — *linked to identity*, App Functionality.
- [ ] **Phone Number** (OTP login / contact) — *linked to identity*, App Functionality / Authentication.
- [ ] **User ID / account** — *linked to identity*.
- [ ] Tracking: confirm there is **no cross-app tracking SDK** → "Data is **not** used
      to track you" and **no ATT prompt**. (No analytics/ads SDK detected; re-verify
      before submitting.)
- [ ] Privacy Policy URL: `https://detectivepulse.app/privacy` (route exists).

## 3. Guideline risk areas — prepare answers in the App Review notes

- [ ] **4.2 Minimum Functionality** (highest risk for a WebView wrapper). Lean on the
      native integrations already built — camera evidence capture, background GPS,
      push — and the native-feel polish already shipped. In Review Notes, explicitly
      list the native features so it doesn't read as "just a website."
- [ ] **2.5.4 / background location.** Justify persistent location: field agents are
      tracked on the live operations map while on assignment. Confirm the blue
      location indicator / expected behavior matches the usage string.
- [ ] **5.1.1 data + permissions.** Each permission prompt must have a clear,
      specific purpose string (see §0) and be requested in context.

## 4. Build & upload

- [ ] Bump build number if re-uploading (`CURRENT_PROJECT_VERSION`); 1.0 (1) is fine first time.
- [ ] `npm run build` (web) is deployed to `detectivepulse.app` — the shell loads it live.
- [ ] `npm run cap:sync` after the Info.plist edits.
- [ ] Xcode → **Product → Archive** (Any iOS Device / Distribution), then upload to
      App Store Connect (or `xcodebuild -exportArchive`).
- [ ] TestFlight: install and smoke-test on a real device before submitting.
      ⚠️ When you move from dev to TestFlight, **drop `APNS_PRODUCTION=false`** in
      Vercel — TestFlight/App Store use the **production** APNs gateway.

## 5. App Review access (login is phone-OTP gated)

- [ ] Reviewers can't get SMS OTP — demo access is set up per **`REVIEW.md`**
      (Supabase test number `+66800000000` / code `000000` + seeded demo agent).
- [ ] Confirm the test number is still configured in Supabase and the seed has run.
- [ ] Put the demo phone + code in **App Review Notes**.

## 6. Store listing assets

- [ ] Listing copy ready in **`STORE.md`**.
- [ ] App icon 1024×1024 present (`AppIcon-512@2x.png`). Verify no alpha/transparency.
- [ ] Screenshots for required device sizes (6.7" / 6.9" iPhone at minimum) — capture
      from the running app (login, field case list, evidence capture, map).
- [ ] Support URL, marketing URL, category, age rating questionnaire completed.

---

### Immediate next action
The only code-fixable blocker is §0 — the Info.plist usage strings. Everything else
is App Store Connect data entry or the APNs key. Once §0 is in and a build is archived,
the realistic rejection risks are **4.2** (mitigated by native features) and
**background-location justification** (§3) — have the Review Notes ready for both.
