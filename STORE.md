# Store listing copy — Detective Pulse Field

Paste-ready copy for App Store Connect and Google Play. Character limits are noted;
trim if you edit. This is a **B2B tool for licensed/authorized investigation teams** —
keep that framing so reviewers understand the login gate (use the demo account in
`REVIEW.md`). Replace bracketed placeholders before submitting.

---

## App name / title
- **iOS app name** (≤30): `Detective Pulse Field`
- **iOS subtitle** (≤30): `Field ops for investigators`
- **Google Play title** (≤30): `Detective Pulse Field`

## Google Play short description (≤80)
```
Case assignments, timeline, evidence and live GPS for field surveillance teams.
```

## iOS promotional text (≤170)
```
The field companion for licensed investigation teams: see assigned cases, log timed observations, capture evidence, and stay on the live operations map.
```

## iOS keywords (≤100, comma-separated, no spaces)
```
surveillance,field agent,investigation,case management,GPS,evidence,private investigator,ops,detective
```

## Full description (App Store & Google Play, ≤4000)
```
Detective Pulse Field is the mobile companion for licensed private-investigation and
surveillance teams. Field agents receive their case assignments, log timed
observations from the ground, capture photo evidence, and report their position to
the operations map in real time — all in one secure app.

ACCESS IS RESTRICTED. Detective Pulse Field is intended for authorized members of
investigation agencies that use the Detective Pulse platform. Accounts are provisioned
by your agency; you sign in with your phone number.

FOR FIELD AGENTS
• My Cases — see only the cases you're assigned to, with target intelligence at a glance
• Timeline — log timed surveillance observations with one tap; works in professional Thai
• Evidence — capture photos with the camera and attach them straight to a case
• Live position — share your GPS location with your operations center while on duty
• Target intelligence — review the target dossier: photos, vehicles, locations, notes
• Messages & alerts — stay in sync with your team and receive assignment and emergency
  notifications

BUILT FOR THE FIELD
• Fast, focused mobile interface
• Thai and English
• Secure by design — sensitive details are encrypted and access is limited to the cases
  you're assigned to

Detective Pulse Field requires an account with an agency using the Detective Pulse
operations platform.

Privacy policy: https://detectivepulse.app/privacy
Support: [your support URL or email]
```

## What's New / release notes (v1.0.0)
```
First release of Detective Pulse Field:
• Assigned cases, timeline logging, and photo evidence capture
• Live GPS reporting to the operations map
• Target intelligence dossier
• Team messages and push notifications
```

---

## App Review information

### Demo account (required — app is login-gated by SMS OTP)
See `REVIEW.md`. Paste into App Store Connect → App Review Information → Sign-In, and
Google Play → App access → "All functionality requires login":
```
This app signs in with a phone number + SMS code. Use this demo account
(no real SMS is sent):
  Phone: +66 80 000 0000
  Code:  000000
Steps: open the app → enter the phone → tap "Send code" → enter 000000 →
you'll land on the Field dashboard with a sample case (timeline, target
vehicle/location, evidence capture).
```

### Background location justification (both stores scrutinize this)
```
Field agents are surveillance operatives on active assignments. The app reports the
signed-in agent's location to their agency's operations center so supervisors can
coordinate the team and respond to emergencies. Location is collected only while the
agent is signed in and on duty, a persistent notification is shown while tracking is
active, and data is visible only to the agent's own agency. Background location is
essential to the core purpose of the product.
```
(Google Play also requires the **Location permissions declaration** form + a short
demo video showing the in-app disclosure and the feature.)

---

## Metadata
- **Category**: Business (primary) · Productivity (secondary)
- **Age rating**: 17+ / "Unrestricted Web Access" is not used; no objectionable content,
  but it's a professional surveillance tool — rate 17+ to be safe.
- **Privacy Policy URL**: https://detectivepulse.app/privacy
- **Support URL**: [add]
- **Marketing URL** (optional): https://detectivepulse.app

## App Privacy / Data safety — declare collection of:
- **Location** (precise) — app functionality; linked to identity; not for tracking/ads
- **Photos** (user content / evidence) — app functionality; linked to identity
- **Contact info** — name, phone, email (account) — app functionality; linked to identity
- **Identifiers** — push notification token — app functionality
- Not sold; not used for third-party advertising. Encrypted in transit; sensitive
  fields encrypted at rest.

## Screenshots to capture (on device/simulator, signed in as the demo agent)
1. My Cases list  2. Case timeline  3. Target intelligence dossier
4. Evidence capture (camera)  5. (optional) Messages
Sizes: iPhone 6.7" + 6.5" (required), iPad if you enable iPad; Android phone + 7"/10" tablet.

## Compliance reminders
- Replace placeholder app icon (`assets/`) with final artwork before generating.
- Update the privacy-policy contact email and have the policy reviewed by counsel.
- iOS export compliance: uses standard HTTPS/encryption — typically "exempt", confirm.
