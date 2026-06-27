# App Store submission — Detective Pulse Field

Reference for submitting the iOS app (`app.detectivepulse.field`) for App Store review.
The app is a Capacitor shell that loads the live operations site and adds native
camera, background GPS, and push. It is a **B2B tool used only by the agency's own
licensed field investigators** — not a consumer app.

---

## 1. App Review Information → Review Notes (paste this verbatim)

> **What this app is**
> Detective Pulse Field is an internal workforce app for a licensed private
> investigation agency. It is used only by the agency's own employed field
> investigators to do their job: receive case assignments, report their on-duty
> GPS position to dispatch, capture case evidence (photos/notes), review
> case intelligence, and trigger an SOS during fieldwork. It is distributed to
> staff, not to the general public.
>
> **Demo account (required to review — the app is login-gated)**
> Login is by **phone number + 6-digit SMS code**. A fixed test code is
> configured for this number, so no real SMS is needed:
> Phone: `<DEMO_PHONE>` (enter exactly as shown)
> Verification code: `<DEMO_TEST_OTP>`
> This account is a supervisor pre-seeded with a sample case, so every screen has data.
>
> **How to exercise the core native features**
> 1. Sign in with the demo account above → you land on the Field screen.
> 2. Background GPS: tap a status (e.g. "On duty"). The app reports the device
>    location to dispatch every ~55s and continues while backgrounded — this is
>    the core of a field-investigation workforce app (dispatch must know where
>    on-duty staff are for coordination and safety). Allow the "Always" location
>    permission when prompted to see this.
> 3. Camera: open a case → "Log observation" → "Camera" to capture case evidence.
> 4. Push: assignment / SOS / geofence alerts are delivered via APNs.
> 5. SOS: the red SOS button alerts supervisors — a lone-worker safety feature.
>
> **Why background location ("Always")**
> The app's primary purpose is real-time field-staff coordination and lone-worker
> safety. Supervisors must see the live location of on-duty investigators (and
> receive SOS), which requires location updates while the app is backgrounded.
> Location is only reported while the user sets themselves "on duty"; going
> "off duty" stops reporting.
>
> **Native functionality (re: Guideline 4.2)**
> Beyond web content, the app provides native iOS capabilities that are essential
> to the workflow: continuous background Core Location reporting, native camera
> capture into the case file, and APNs push for assignments / SOS / geofence
> alerts.
>
> **Privacy / lawful use**
> All subject data is entered by licensed, employed investigators in the course of
> lawful, contracted investigations and is access-controlled per case assignment.
> The app is not offered to consumers and is not intended for tracking people one
> is not lawfully authorized to investigate.
>
> Contact for review questions: `<CONTACT_EMAIL>`

---

## 2. Things YOU must fill in before submitting
- [ ] **Configure a deterministic test OTP** (the login is phone + SMS code; the
      reviewer cannot receive your SMS). Supabase Dashboard → Authentication →
      Sign In / Providers → Phone → **Test OTP**: add the demo phone (e.g.
      `+66968461406`) → fixed code (e.g. `123456`). This logs in without sending SMS.
- [ ] Fill `<DEMO_PHONE>`, `<DEMO_TEST_OTP>`, `<CONTACT_EMAIL>` in the notes above.
      The demo account should be a **supervisor/admin** with a sample case so all
      screens (incl. Map/Alerts) have data.
- [ ] **Privacy Policy URL**: `https://detectivepulse.app/privacy` (page already
      exists at `src/app/privacy/page.tsx` — confirm its content matches what the
      app collects: location, photos, account/contact).
- [ ] **Screenshots** (6.7" required; 6.5" recommended) of the Field, Case Intel,
      and Map screens. Easiest: run on an iOS Simulator of that size, log in with
      the test phone/OTP, navigate, and press Cmd+S to capture.
- [ ] **App Privacy ("nutrition labels")** — see section 3.
- [ ] Export compliance: now auto-answered by `ITSAppUsesNonExemptEncryption=false`
      in Info.plist (no manual prompt).

## 3. App Privacy answers (data the app collects)
Declare honestly based on what the app stores server-side:
- **Location (Precise)** — collected, linked to the user, used for *App Functionality*
  (field-staff coordination). Background location reported while on duty.
- **Photos** — case evidence captured/uploaded, linked to the user/case, *App Functionality*.
- **Contact info / Identifiers** — account email + user profile, *App Functionality*.
- **User Content** — observations/notes and subject (case) data.
- Not used for tracking across other companies' apps; no third-party advertising.

## 4. Likely reviewer pushback + ready answers
1. **4.2 "web wrapper"** → point to background Core Location + native camera + APNs
   (see notes). These cannot be done by a plain website.
2. **Background location** → lone-worker safety + dispatch coordination; opt-in via
   on/off duty; "Always" string explains it.
3. **Tracking third parties / surveillance** → licensed PI agency, lawful contracted
   work, internal staff only, per-case access control. Have the business license /
   company info ready if asked.

## 5. Build / upload checklist (Mac)
- [ ] `git pull` (main has the readiness fixes), then `npm run cap:sync`
- [ ] Build number is **3** (bumped in this change). Bump again for each future upload.
- [ ] Xcode → "Any iOS Device" → Product → Archive → Distribute → App Store Connect → Upload
- [ ] In App Store Connect, attach the build, paste the Review Notes (section 1),
      fill section 2, submit.
