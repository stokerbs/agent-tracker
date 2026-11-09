# Legacy page consolidation

Updated 2026-11-09. Canonical consolidation is active for **20 legacy URLs**. Original copy remains readable with HTTP 200 and a visible primary-service link. Only primary pages appear in sitemap, article cards and related recommendations. Internal Markdown and language-switch links point at primary pages.

Permanent redirects remain **off** unless `MARKETING_CONSOLIDATION_REDIRECTS=1` is explicitly configured. This release does not change that variable. No connected Search Console report was available for this cleanup, so it does not claim to have checked impressions, clicks or indexing and does not automatically activate permanently cached redirects.

Code: `src/lib/marketing/redirects.ts` contains the reviewed map and optional redirect gate. `src/lib/marketing/seo-canonical.ts` supplies the active canonical/link policy. The separate database-article families are documented in `docs/marketing/seo-organization.md`.

## Reviewed map

| Source | Primary |
|---|---|
| `/นักสืบคดีชู้สาว-รับสืบค` | `/นักสืบชู้สาว` |
| `/บริการตรวจสอบประวัติบุ` | `/เช็คประวัติบุคคล` |
| `/บริการสืบประวัติบุคคลด` | `/สืบทรัพย์สิน` |
| `/จ้างนักสืบตามหาคน` | `/สืบตามหาคน` |
| `/บริการสืบค้นข้อมูลไอที` | `/นักสืบไอที` |
| `/จ้างนักสืบ-ราคาถูก` | `/ราคานักสืบ` |
| `/วิธีการคิดราคาจ้างนักส` | `/ราคานักสืบ` |
| `/การหานักสืบเชี่ยวชาญ-คำ` | `/จ้างนักสืบ` |
| `/บริษัทนักสืบมืออาชีพที` | `/เกี่ยวกับเรา` |
| `/บริการนักสืบชั้นนำเพื่` | `/เกี่ยวกับเรา` |
| `/en/catch-a-cheating-partner` | `/en/cheating-spouse-investigator` |
| `/en/personal-background-check-service` | `/en/background-check` |
| `/en/asset-background-check` | `/en/asset-investigation` |
| `/en/trace-people-and-debtors` | `/en/find-missing-person` |
| `/en/social-media-investigation` | `/en/cyber-investigation` |
| `/en/how-to-find-a-good-detective` | `/en/hire-a-private-detective` |
| `/en/private-detective-pricing` | `/en/pricing` |
| `/en/affordable-private-detective` | `/en/pricing` |
| `/en/trusted-detective-agency` | `/en/about` |
| `/en/leading-detective-services` | `/en/about` |

## Supporting guides retained

- Online hiring: `/จ้างนักสืบออนไลน์`, `/en/hire-a-detective-online`.
- Preparing an asset inquiry before filing suit: `/วิธีสืบทรัพย์ก่อนฟ้อง-เ`, `/en/trace-assets-before-lawsuit`.
- Unknown/scam numbers: `/บริการตรวจสอบการใช้โทร`, `/en/phone-usage-investigation`.
- Investigator definitions: `/private-investigator`, `/en/private-investigator`.
- Service overview: `/บริการนักสืบ`, `/en/detective-services-overview`.
- Adultery-evidence preparation, investigator qualities, agency definitions and online-fraud guidance remain supporting articles.

The pre-marriage page remains a service at its existing URL. Contact pages remain reachable but are excluded from article cards.

## Optional permanent-redirect rollout

1. Check Search Console Performance → Pages for source URLs and URL inspection for destinations. Do not infer rankings/indexing from HTTP 200.
2. Retain useful unique copy in the destination before retiring source content. Original Markdown remains in the repository.
3. Verify incoming links, translated counterparts and contact anchors.
4. If permanent redirects are appropriate, set `MARKETING_CONSOLIDATION_REDIRECTS=1` in the intended Vercel environment and redeploy. Verify 308 → 200 with no chain or loop.
5. Re-submit the sitemap and monitor source/destination performance together.

To undo canonical consolidation, revert the reviewed source map/code. To undo the optional permanent-redirect setting, unset its variable and redeploy; clients may retain previously cached permanent redirects.
