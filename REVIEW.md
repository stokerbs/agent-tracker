# App Store / Play Store review access

Reviewers can't receive your SMS OTP, so they need a way to sign in. This uses a
**Supabase test phone number** (fixed code, no SMS) + a **seeded demo agent** with a
populated case — no auth-bypass code in the app.

## One-time setup

### 1. Add a Supabase test OTP number
Supabase Dashboard → **Authentication → Sign In / Providers → Phone → Test OTP**
(a.k.a. "Test phone numbers"). Add:

| Phone (E.164) | Code | Use |
|---------------|------|-----|
| `+66900000001` | `123456` | **Active App Store reviewer account** (build 1.0 (8) onward) |
| `+66800000000` | `000000` | Seed-script default (`Demo Agent` + `CASE-DEMO-0001`) — alternative |

**Currently submitted to Apple:** `+66900000001` / `123456` (profile "Apple Reviewer",
agent code `DEMO-001`). It is assigned to active cases `CASE-2026-0002` / `CASE-2026-0003`,
so signing in lands on the Field dashboard with real case content. The `+66800000000`
Demo Agent below (created by the seed script) remains as a clean single-case alternative.

The phone **must** be E.164 (`+66…`) — it has to match `normalizeThaiPhone`
(`src/app/(auth)/actions.ts`), which outputs `+66XXXXXXXXX`. Test numbers bypass the
SMS provider and accept the fixed code.

### 2. Seed the demo agent + case
```bash
node scripts/seed-demo-agent.mjs        # uses .env.local service-role key
# custom number: DEMO_PHONE=+66800000000 node scripts/seed-demo-agent.mjs
```
Idempotent. Creates a `role='agent'` profile for the demo phone, a linked agent
(`DEMO01`), and an assigned demo case (`CASE-DEMO-0001`) with sample timeline, vehicle,
and location so the Field app shows real content. Use the **same** phone in steps 1 & 2.

## Reviewer notes (paste into the store consoles)

App Store Connect → **App Review Information → Sign-In required** (and Google Play →
**App access → All functionality** with login instructions):

```
This app is for a single private-investigation organization and is intended
for Unlisted App Distribution (not a public audience).

Sign-in uses a phone number + SMS code. Please use this review account
(no real SMS is sent):

  Phone: +66 90 000 0001
  Code:  123456

Steps: open the app → enter the phone number → tap "Send code" →
enter 123456 → you'll land on the Field dashboard showing the assigned
case(s), including timeline, target details, and evidence capture.

Support page:   https://detectivepulse.app/support
Privacy policy: https://detectivepulse.app/privacy
```

Convenience deep link (prefills the number): `https://detectivepulse.app/login?phone=%2B66900000001`

## Verify before submitting
1. Supabase test OTP `+66900000001` / `123456` is set (Auth → Phone → Test OTP).
2. Visit `/login?phone=+66900000001` → Send code → enter `123456` → lands on `/field`
   with the assigned cases visible (`CASE-2026-0002` / `CASE-2026-0003`, timeline + intel
   populated). No real SMS sent.
3. Confirm the account sees **only** its assigned cases (RLS), not the full case list.
4. Support URL in App Store Connect points to `https://detectivepulse.app/support`.

## After launch
Deactivate or remove the demo account when no longer needed: set
`agents`/`profiles.is_active = false`, or use Settings → Profile → Delete account while
signed in as the demo agent. You can also remove the Supabase test number.
