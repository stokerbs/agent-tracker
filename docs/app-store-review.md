# App Store submission — Detective Pulse Field

Reference for submitting the iOS app (`app.detectivepulse.field`) for App Store review.
The app is a Capacitor shell that loads the live operations site and adds native
camera, background GPS, and push. It is a **B2B tool used only by the agency's own
licensed field investigators** — not a consumer app.

---

## 0. Resubmission — response to the 2026-06-28 rejection

Build 1.0 (6) was rejected on two guidelines (submission `f34b072a-f02c-43e6-978c-0c284fc337b9`):

- **Guideline 1.5 (Support URL)** — the Support URL had no support content. **Fixed:** a
  public support page is now LIVE at `https://detectivepulse.app/support`
  (`src/app/support/page.tsx`). Set this as the Support URL in App Store Connect.
- **Guideline 3.2 (Business)** — the app is org-specific but was submitted for public
  distribution. **Decision:** move to **Unlisted App Distribution** (request via Apple's
  unlisted-distribution form; it stays on the App Store via a private link, not search).

**Paste this into App Store Connect → Resolution Center (reply to the review thread):**

> Hello, and thank you for the detailed review.
>
> We have addressed both items.
>
> Guideline 1.5 — Support URL
> We have published a dedicated support page with contact information, getting-started
> guidance, and an FAQ (sign-in help, location/notification permissions, and account
> deletion). It is publicly accessible without login:
>
> https://detectivepulse.app/support
>
> We have updated the Support URL in App Store Connect to point to this page, and the
> support inbox (detectivepluse@gmail.com) is actively monitored.
>
> Guideline 3.2 — Business
> Thank you for the guidance. Detective Pulse is intended for a single
> private-investigation organization (its staff and that organization's clients), not for
> a general public audience. We agree the App Store's public distribution is not the right
> fit, and we are moving to Unlisted App Distribution. We have submitted a request for
> unlisted distribution for this app and will distribute it via the private link rather
> than public search.
>
> Please let us know if anything further is needed for the unlisted distribution review.
> We're happy to provide additional details.
>
> Thank you,
> Detective Pulse

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
> Phone: `0900000001`
> Verification code: `123456`
> This account ("Apple Reviewer") is scoped to a single isolated demo case
> (CASE-DEMO-0001) containing a sample timeline, target details, and location, so
> the core screens have data — without exposing any real investigations.
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
> **Account deletion (Guideline 5.1.1(v))**
> In-app at **Settings → Profile → Delete account**. After typing "DELETE" to
> confirm, it permanently deletes the account and associated personal data and
> signs the user out. Note: doing this on the demo account permanently removes it —
> contact us (below) and we will re-provision the demo if you need to re-test.
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
> Contact for review questions: thedemonking001@gmail.com

---

## 2. Things YOU must fill in before submitting
- [ ] **Support URL** (Guideline 1.5): set to `https://detectivepulse.app/support`
      (page is LIVE; source `src/app/support/page.tsx`).
- [ ] **Distribution** (Guideline 3.2): request **Unlisted App Distribution** via Apple's
      form — do NOT resubmit as public. See section 0.
- [x] Demo account created: **"Apple Reviewer"** — phone `+66900000001`, agent code
      `DEMO-001`, scoped to the isolated demo case **CASE-DEMO-0001** only (re-scoped
      off real cases per security review; RLS limits it to its assigned case).
- [ ] **Configure the Test OTP** (the login is phone + SMS code; the reviewer
      cannot receive your SMS). Supabase Dashboard → Authentication →
      Sign In / Providers → Phone → **Test OTP**: add `+66900000001` → `123456`.
      This logs the demo account in without sending a real SMS. **Without this the
      reviewer cannot get past login — App Review will fail.** (The reviewer types
      `0900000001`; the app normalizes it to `+66900000001`.)
- [x] Contact email set: `thedemonking001@gmail.com`.
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
- [ ] Bump the build number for each upload (TestFlight is at **build 8** as of
      2026-06-28; the next App Store submission must be a higher number).
- [ ] Xcode → "Any iOS Device" → Product → Archive → Distribute → App Store Connect → Upload
- [ ] In App Store Connect, attach the build, paste the Review Notes (section 1),
      fill section 2, submit.
