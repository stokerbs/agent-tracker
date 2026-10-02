# Consolidation redirects (Appendix C.3) — runbook

**Status:** implemented, **gated off**. Nothing redirects until the owner flips the flag.

Code: `src/lib/marketing/redirects.ts` (map + gate), wired into `next.config.ts` → `redirects()`.
Tests: `src/lib/marketing/redirects.test.ts` (off by default; destinations are live registry pages; no chains; nav/related links never point at a source; sources percent-encoded).
Sitemap: once the flag is on, redirected sources drop out of `sitemap.xml` automatically.

## Why gated

The audit (Appendix C.3) says: *before redirecting, check GSC for any of these URLs with meaningful impressions and move their unique sentences into the target page.* Flipping 27 permanent redirects without that check could lose rankings the thin pages still hold. The map is therefore shipped dark so Dev and Owner can turn it on in one deploy once the checklist below is done.

## Checklist before enabling

1. **GSC → Performance → Pages**, last 3 months, filter each source URL below. For any source with > 50 impressions or any clicks: read the page, move the sentences that are unique and useful into the destination page's registry entry (`src/lib/marketing/pages/th.ts` / `en.ts`), then continue.
2. Confirm the destinations are **indexed** (GSC URL inspection) — the new pages `/ราคานักสืบ`, `/นักสืบกรุงเทพ`, `/เกี่ยวกับเรา`, `/en/pricing`, `/en/private-investigator-bangkok`, `/en/about` went live with the registry; give them ~2 weeks and submit them in GSC first (see `gsc-reindex-checklist.md`).
3. Search the codebase and the published AI articles for internal links to the sources (`grep -rn "<slug>" src/content src/lib`) and re-point them to the destinations. The registry pages and nav already comply (tested).
4. Set the environment variable in Vercel (Production + Preview): `MARKETING_CONSOLIDATION_REDIRECTS=1`, redeploy.
5. Verify a Thai and an English source return `308/301 → destination` with `curl -I`, then **re-submit the sitemap** in GSC and request indexing for the six destination pages.
6. Two weeks later: check GSC coverage for "Page with redirect" on the sources (expected) and that destination impressions ≥ previous source + destination combined.

## Rollback

Unset the variable and redeploy. Sources serve again unchanged (they are still in the repo and the sitemap logic restores them).

## The map

| From (decoded) | To |
|---|---|
| `/นักสืบคดีชู้สาว-รับสืบค` | `/นักสืบชู้สาว` |
| `/บริการตรวจสอบประวัติบุ` | `/เช็คประวัติบุคคล` |
| `/บริการสืบประวัติบุคคลด` | `/สืบทรัพย์สิน` |
| `/จ้างนักสืบตามหาคน` | `/สืบตามหาคน` |
| `/บริการสืบค้นข้อมูลไอที`, `/บริการตรวจสอบการใช้โทร` | `/นักสืบไอที` |
| `/จ้างนักสืบ-ราคาถูก`, `/วิธีการคิดราคาจ้างนักส` | `/ราคานักสืบ` |
| `/การหานักสืบเชี่ยวชาญ-คำ` | `/จ้างนักสืบ` |
| `/บริษัทนักสืบมืออาชีพที`, `/บริการนักสืบชั้นนำเพื่` | `/เกี่ยวกับเรา` |
| `/en/private-investigator` | `/en` |
| `/en/catch-a-cheating-partner` | `/en/cheating-spouse-investigator` |
| `/en/personal-background-check-service` | `/en/background-check` |
| `/en/asset-background-check`, `/en/trace-assets-before-lawsuit` | `/en/asset-investigation` |
| `/en/trace-people-and-debtors` | `/en/find-missing-person` |
| `/en/social-media-investigation`, `/en/phone-usage-investigation` | `/en/cyber-investigation` |
| `/en/hire-a-detective-online`, `/en/how-to-find-a-good-detective` | `/en/hire-a-private-detective` |
| `/en/private-detective-pricing`, `/en/affordable-private-detective` | `/en/pricing` |
| `/en/trusted-detective-agency`, `/en/leading-detective-services`, `/en/detective-services-overview` | `/en/about` |

**Deliberately not redirected**

- `/วิธีสืบทรัพย์ก่อนฟ้อง-เ` and `/en/evidence-for-adultery-lawsuit` — kept as supporting articles (the audit allowed either); the service pages link to them.
- `/en/investigate-partner-before-marriage` → `/en/thai-partner-verification` — the partner page was rebuilt in the registry at its **existing** URL instead of moving; revisit only if a separate verification page ships (Days 31–90).

## Thai summary / สรุปภาษาไทย

สร้างแผนที่ 301 ตามภาคผนวก C.3 ไว้แล้วแต่ **ปิดอยู่** จะทำงานเมื่อตั้งค่า `MARKETING_CONSOLIDATION_REDIRECTS=1` ใน Vercel เท่านั้น ก่อนเปิดให้ (1) เช็ค GSC ว่าหน้าเก่าหน้าไหนยังมี impressions แล้วย้ายประโยคที่มีประโยชน์ไปหน้าปลายทาง (2) ยืนยันว่าหน้าปลายทางใหม่ถูก index แล้ว (3) เปิดธง (4) ตรวจด้วย `curl -I` และส่ง sitemap ใหม่ใน GSC ย้อนกลับได้ทันทีด้วยการลบตัวแปรแล้ว deploy ใหม่
