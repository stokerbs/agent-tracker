# Search Console — re-index & data checklist (roadmap item 8)

ภาษาไทยอยู่ด้านล่าง · This is an owner action: the engineering session has no access to Search Console, so nothing here was executed — it is the exact to-do list, in order.

Why now: commits 2ee412e → f769978 changed titles, descriptions, canonical link targets, the business schema and the copy of ~60 pages, and Google's cached snippets still show the retired phone number 080 918 8324 (seen in `site:detectivepulse.com` results on 2026-10-02). Re-indexing shortens the time until the new titles, descriptions and the lawful-scope copy appear in results.

## 1. Request indexing (URL Inspection → "Request indexing"), in this order

Quota is roughly 10–12 requests per day per property; do the first block today, the rest tomorrow.

Day 1 (highest value):
1. https://detectivepulse.com/
2. https://detectivepulse.com/en
3. https://detectivepulse.com/ติดต่อนักสืบ
4. https://detectivepulse.com/en/contact
5. https://detectivepulse.com/นักสืบชู้สาว
6. https://detectivepulse.com/เช็คประวัติบุคคล
7. https://detectivepulse.com/สืบตามหาคน
8. https://detectivepulse.com/สืบทรัพย์สิน
9. https://detectivepulse.com/นักสืบไอที
10. https://detectivepulse.com/จ้างนักสืบ

Day 2:
11. https://detectivepulse.com/en/cheating-spouse-investigator
12. https://detectivepulse.com/en/background-check
13. https://detectivepulse.com/en/find-missing-person
14. https://detectivepulse.com/en/asset-investigation
15. https://detectivepulse.com/en/cyber-investigation
16. https://detectivepulse.com/en/hire-a-private-detective
17. https://detectivepulse.com/บริการตรวจสอบการใช้โทร  (rewritten page — old "call history" copy must leave the index)
18. https://detectivepulse.com/en/phone-usage-investigation  (same)
19. https://detectivepulse.com/จ้างนักสืบตามแฟน
20. https://detectivepulse.com/บริการตรวจสอบประวัติบุ

Then: Sitemaps → re-submit `https://detectivepulse.com/sitemap.xml` (it no longer emits fake lastmod dates, so Google will trust the real ones on articles).

## 2. Coverage / Pages report — what to look for

| Report row | Expected | Action |
|---|---|---|
| "Page with redirect" for `…/%e0…/` trailing-slash URLs | Expected: old WordPress URLs 308 → slash-free. Internal links no longer point at them. | None. Count should fall over the next weeks. |
| "Duplicate without user-selected canonical" or "Duplicate, Google chose different canonical" on `/en/` or `/en` | Possible (Google indexed `/en/` with the Thai home title). | Inspect `/en` — confirm Google-selected canonical = `https://detectivepulse.com/en`. If not, request indexing again after 1 week. |
| "Not found (404)" for `/blog/*`, `/author/*`, `/category/*`, `/feed` | Should now be "Page with redirect" (301s in next.config). | If any 404 remains, send the URL to engineering. |
| "Excluded by 'noindex' tag" for `/lp/*`, `/review/*`, `/zh/case-studies` | Expected. | None. |
| "Crawled – currently not indexed" on thin Thai pages (the consolidation candidates in Appendix C of the audit) | Likely. | Decide on the 301 consolidation list (audit Appendix C) — engineering can ship it in one commit once approved. |
| `/privacy`, `/support` | Removed from the sitemap this cycle (app-only pages). They may stay indexed until a marketing privacy notice replaces them. | Approve the marketing privacy-notice copy (TH/EN/ZH) → engineering. |

## 3. Performance report — export the queries that feed the content plan

Performance → Search results → last 3 months → filter Country = Thailand (and separately: not Thailand) → Export (Google Sheets):
- Tab "Queries": sort by impressions. Any query with position 8–20 and ≥ 50 impressions goes to the top of `KEYWORD_TOPICS` in `src/lib/marketing/article-gen.ts` (send the sheet to engineering).
- Tab "Pages": pages with impressions but CTR < 1 % → title/description rewrite candidates (several were already rewritten this cycle; compare after 4 weeks).
- Save the export in the shared drive as `gsc-queries-YYYY-MM.csv`; repeat monthly.

## 4. Also while in the console

- Settings → verify the property is the **Domain** property (covers http/https/www). If only a URL-prefix property exists, add the Domain property via DNS.
- Enhancements → check "Structured data" has no errors after the new ProfessionalService/LocalBusiness schema goes live (allow a few days).
- Links → export "Top linking sites" and send it to engineering for the backlink baseline (the audit had no backlink data).
- Removals → do **not** use it for the old phone number; re-indexing is the correct fix.

## 5. Related owner decisions still open

- Confirm the canonical LINE OA link `https://lin.ee/SSqk98x` (all content now uses it).
- Approve the 301 consolidation map (audit Appendix C) and the marketing privacy notice.
- Provide the facts in audit Appendix D (entity, awards, response time, payment methods, pricing bands).

---

# เช็กลิสต์ Search Console — ขอ re-index และดึงข้อมูล (roadmap ข้อ 8)

งานนี้ต้องทำโดยเจ้าของบัญชี Search Console (ทีมวิศวกรรมไม่มีสิทธิ์เข้าถึง) รายการด้านล่างคือสิ่งที่ต้องทำตามลำดับ

เหตุผล: มีการเปลี่ยน title, description, ลิงก์ canonical, schema ของธุรกิจ และเนื้อหาราว 60 หน้า และ snippet ที่ Google แคชไว้ยังแสดงเบอร์เก่า 080 918 8324 อยู่ การขอ re-index จะช่วยให้ผลใหม่ขึ้นเร็วขึ้น

## 1. ขอ index ใหม่ (URL Inspection → Request indexing) ตามลำดับ

โควตาประมาณ 10–12 URL ต่อวัน: วันแรกทำข้อ 1–10 ด้านบน (หน้าแรก, /en, หน้าติดต่อ, 6 หน้าบริการหลักภาษาไทย) วันที่สองทำข้อ 11–20 (6 หน้าบริการภาษาอังกฤษ, 2 หน้า "ตรวจสอบโทรศัพท์" ที่เขียนใหม่, สืบแฟน, ตรวจสอบประวัติ) จากนั้นไปที่ Sitemaps และส่ง `https://detectivepulse.com/sitemap.xml` ใหม่

## 2. รายงาน Pages (Coverage) — ดูอะไรบ้าง

- "Page with redirect" ของ URL ที่ลงท้ายด้วย `/` แบบเก่า: ปกติ ไม่ต้องทำอะไร ตัวเลขควรลดลง
- "Duplicate … canonical" ที่ `/en/`: ตรวจว่า Google เลือก canonical เป็น `https://detectivepulse.com/en` ถ้าไม่ใช่ ขอ index อีกครั้งใน 1 สัปดาห์
- "Not found (404)" ของ `/blog/*`, `/author/*`, `/category/*`, `/feed`: ควรกลายเป็น redirect แล้ว ถ้ายังมีให้ส่ง URL ให้ทีมวิศวกรรม
- "Excluded by noindex" ของ `/lp/*`, `/review/*`, `/zh/case-studies`: ถูกต้องตามที่ตั้งใจ
- "Crawled – currently not indexed" ของหน้าไทยที่เนื้อหาบาง: ให้ตัดสินใจเรื่องการรวมหน้า (ภาคผนวก C ของรายงาน) แล้วทีมวิศวกรรมจะทำ 301 ให้ในคอมมิตเดียว

## 3. รายงาน Performance — ส่งออกคำค้นเพื่อป้อนแผนคอนเทนต์

Performance → Search results → 3 เดือนล่าสุด → กรองประเทศไทย (และแยกอีกชุดที่ไม่ใช่ไทย) → Export เป็น Google Sheets
- แท็บ Queries: คำค้นที่อันดับ 8–20 และ impressions ≥ 50 ให้ส่งทีมวิศวกรรมเพื่อเลื่อนขึ้นต้นรายการ `KEYWORD_TOPICS`
- แท็บ Pages: หน้าที่มี impressions แต่ CTR < 1% คือหน้าที่ควรแก้ title/description ต่อ (เปรียบเทียบอีกครั้งใน 4 สัปดาห์)
- บันทึกไฟล์เป็น `gsc-queries-YYYY-MM.csv` และทำซ้ำทุกเดือน

## 4. ตรวจเพิ่มเติม

- Settings: ยืนยันว่าเป็น property แบบ Domain (ครอบคลุม http/https/www) ถ้าไม่ใช่ให้เพิ่มผ่าน DNS
- Enhancements → Structured data: ไม่ควรมี error หลัง schema ใหม่ขึ้น (รอ 2–3 วัน)
- Links → export "Top linking sites" ส่งทีมวิศวกรรมเป็นฐานข้อมูล backlink
- ห้ามใช้ Removals กับเบอร์เก่า — การ re-index คือวิธีที่ถูกต้อง

## 5. การตัดสินใจของเจ้าของที่ยังค้าง

- ยืนยันลิงก์ LINE OA `https://lin.ee/SSqk98x`
- อนุมัติแผนรวมหน้า 301 (ภาคผนวก C) และข้อความนโยบายความเป็นส่วนตัวสำหรับเว็บการตลาด
- ส่งข้อเท็จจริงตามภาคผนวก D (ชื่อนิติบุคคล รางวัล เวลาตอบกลับ ช่องทางชำระเงิน ช่วงราคา)
