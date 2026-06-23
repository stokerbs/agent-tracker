# App Store / Play Store review access

Reviewers can't receive your SMS OTP, so they need a way to sign in. This uses a
**Supabase test phone number** (fixed code, no SMS) + a **seeded demo agent** with a
populated case — no auth-bypass code in the app.

## One-time setup

### 1. Add a Supabase test OTP number
Supabase Dashboard → **Authentication → Sign In / Providers → Phone → Test OTP**
(a.k.a. "Test phone numbers"). Add:

| Phone (E.164) | Code |
|---------------|------|
| `+66800000000` | `000000` |

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
This app signs in with a phone number + SMS code. Use this demo account
(no real SMS is sent):

  Phone: +66 80 000 0000
  Code:  000000

Steps: open the app → enter the phone number → tap "Send code" →
enter 000000 → you'll land on the Field dashboard with a sample case
(timeline, target vehicle/location, and evidence capture).
```

Convenience deep link (prefills the number): `https://detectivepulse.app/login?phone=%2B66800000000`

## Verify before submitting
1. Test number added (step 1) and seed run (step 2).
2. Visit `/login?phone=+66800000000` → Send code → enter `000000` → lands on `/field`
   with `CASE-DEMO-0001` visible (timeline + intel populated). No real SMS sent.
3. Confirm the demo agent sees **only** the demo case (RLS), not real cases.

## After launch
Deactivate or remove the demo account when no longer needed: set
`agents`/`profiles.is_active = false`, or use Settings → Profile → Delete account while
signed in as the demo agent. You can also remove the Supabase test number.
