# Case-study template (TH / EN / ZH) — owner form

**Where it lives:** `src/lib/marketing/case-studies.ts` → `CASE_STUDIES` (one trilingual entry per case). Rendered at `/กรณีศึกษา`, `/en/case-studies`, `/zh/case-studies` and on the Chinese home. **Empty by design** until you supply real cases. The three pages stay `noindex` and out of the sitemap until **3** cases exist (`CASE_STUDY_INDEX_MIN`); target for the first batch is **6**.

## Rules (non-negotiable)

1. Real cases only. Nothing invented, nothing "composited" from several cases without saying so.
2. Written client consent to anonymised publication (`consentConfirmed: true` is your attestation). Keep the consent on file; it is not committed.
3. Remove: names, nicknames, employers, addresses, condo/village names, vehicle makes/plates, phone numbers, account numbers, exact dates, photos. Location = province only ("กรุงเทพฯ / Bangkok / 曼谷"). Timeline rounded ("5 วัน / 5 days / 5 天").
4. Approach is **high level only** ("observation in public places over several days", "verification from public registry and a site visit"). Never tactics, team size, vehicles, positions or equipment.
5. No restricted-data claims (bank, credit, telecom, immigration, civil registry) — if the case needed court process, say "through the client's lawyer and the court".
6. Outcome is factual; never "we always…", never a figure the client did not confirm. Include at least one "nothing unusual found" case: it is honest and it sells.
7. Service key must match the registry/analytics keys: `infidelity`, `partner`, `background`, `find_person`, `asset`, `cyber`, `due_diligence`, `surveillance`, `employment_screening`, `romance_scam`.

## Form — fill one block per case (Thai first, we translate EN/ZH, or supply all three)

```
id: cs-2026-01          # sequential; never an ops case number
service:                # see rule 7
consentConfirmed: true  # your attestation; consent kept on file

location  (province):            TH: ______  EN: ______  ZH: ______
timeline  (rounded):             TH: ______  EN: ______  ZH: ______
title     (≤ 70 chars):          TH: ______
situation (2–3 sentences, what the client faced, no identifiers):
objective (what they needed to know / decide):
challenges (what made it hard: little starting info, subject cautious, remote client…):
approach (high level, lawful, no tactics):
deliverables (report, timeline, photos from public places, registry extracts…):
outcome (factual; "confirmed", "not confirmed", "handed to lawyer"…):
lessons (one paragraph the next client can use):
```

## How Dev adds it

Append to `CASE_STUDIES` with all three languages; run `npx vitest run src/lib/marketing/case-studies.test.ts` (checks consent flag, id format, trilingual completeness, obvious PII patterns). When the 3rd case lands the pages index automatically; re-submit the sitemap in GSC and request indexing for the three URLs.

## สรุปภาษาไทย

ส่งเคสจริง 6 เคสตามฟอร์มด้านบน (เริ่มภาษาไทยได้ เราแปล EN/ZH) ต้องมีความยินยอมของลูกค้าเป็นลายลักษณ์อักษร ปกปิดชื่อ สถานที่ ยานพาหนะ เบอร์ วันที่ และห้ามเล่าเทคนิค หน้า กรณีศึกษา จะเริ่มถูก index เองเมื่อครบ 3 เคส
