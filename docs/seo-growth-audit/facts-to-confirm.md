# Facts to confirm — decision form (roadmap item 9)

ภาษาไทยอยู่ด้านล่าง · Owner action. Every fact below drives something visible on detectivepulse.com. The code reads them from **one file**: `src/lib/marketing/facts.ts`. Until a pending fact is filled in, the site simply does not make that claim (the old unverifiable copy — "many awards", "freelance, no office" — has already been removed). Fill the right-hand column, send this file back (or edit `facts.ts` directly), and engineering ships it in one commit.

## A. Already displayed on the site — confirm or correct

| # | Fact | Current value | Where it shows | Your answer |
|---|---|---|---|---|
| A1 | Operating since | 2016 | status strip, stat band, footer, schema `foundingDate` | ☐ correct ☐ change to: ____ |
| A2 | Closed cases | 1,953+ | stat band (TH/EN/ZH), Ads landing pages | ☐ correct ☐ change to: ____ ☐ remove tile |
| A3 | Provinces covered | 77 | stat band | ☐ correct ☐ change |
| A4 | Review rating / count / source | 4.8 / 63 / Fastwork | stat band, reviews section, schema `aggregateRating` | ☐ correct ☐ update to: ____ |
| A5 | Fastwork profile URL | *(none — badge is unlinked)* | TH/EN reviews badge becomes a link (ZH follows) | URL: ______________________ |
| A6 | Six testimonials (names, dates, text) | as on the homepage | reviews carousel | ☐ permission confirmed ☐ remove: ____ |
| A7 | Deposit rule | 50 % before work, balance before delivery, non-refundable on client cancellation | process section, FAQ, pricing pages | ☐ correct ☐ change |
| A8 | Phone / WhatsApp | +66 96 846 1406 | everywhere | ☐ correct |
| A9 | Email | detectivepluse@gmail.com | everywhere | ☐ correct ☐ use a branded mailbox: ____ |
| A10 | LINE Official Account link | https://lin.ee/SSqk98x (id @detectivepluse) | every LINE button and content link | ☐ correct ☐ change to: ____ |
| A11 | Facebook page | facebook.com/Detectivepluse.th | contact sections, schema `sameAs` | ☐ correct |
| A12 | YouTube intro video | youtube.com/watch?v=-sYx6i8OBF0 | homepage video block, schema `sameAs` | ☐ correct |

## B. Not displayed yet — supply to unlock

| # | Fact | Why it matters | What appears once supplied | Your answer |
|---|---|---|---|---|
| B1 | Registered legal entity name (Thai) + DBD registration no. | #1 trust gap for foreign and B2B clients; required for Google Business Profile verification | schema `legalName` now; About page + footer line when those pages ship; GBP | ____________________ |
| B2 | Address usable for Google verification (can stay hidden from the public) | GBP as a service-area business needs it | GBP only (not shown on site unless you want it) | **Send privately (LINE/phone), not in this file or in facts.ts** |
| B3 | How clients meet you | FAQ currently says briefings happen online, by phone or in person in Bangkok | replaces the FAQ "office" answer in TH/EN/ZH | TH: ______ EN: ______ ZH: ______ |
| B4 | Response-time commitment (e.g. "within 1 hour, 08:00–22:00") | strongest conversion lever after price | trust bar, contact pages, exit popup | ☐ 1 h ☐ 3 h ☐ same day ☐ other: ____ hours: ____ |
| B5 | Accepted payment methods (Thai bank transfer, Wise, PayPal, card, …) and whether a company receipt/invoice is issued | foreign clients ask before they contact | pricing + how-it-works pages | ______________________ |
| B6 | Named awards or memberships (name, issuer, year) | the old "many awards" line was removed; only named awards return | schema `award` now; Why-us section when supplied | ☐ none ☐ list: ______ |
| B7 | Lead investigator public first name + role; team size; languages | author entity for articles, About page, E-E-A-T | About page, article author box, Person schema | ______________________ |
| B8 | Price bands you are willing to publish (per service or per day) | competitors publish EN prices; the Thai SERP says "depends" | pricing pages TH/EN/ZH | ______________________ |
| B9 | Six anonymised cases for the first case-study batch | case studies are the strongest trust + SEO asset | /ผลงาน, /en/case-studies, /zh/case-studies (indexed at ≥3) | ☐ will supply by: ____ |
| B10 | Redacted sample report (PDF/image) | shows deliverable quality | how-it-works pages | ☐ will supply |

## C. Decisions that unblock engineering work already specified

| # | Decision | Reference | Your answer |
|---|---|---|---|
| C1 | Approve the 301 consolidation map (merge duplicate Thai/English pages into the core pages) | audit Appendix C | ☐ approve ☐ changes: ____ |
| C2 | Approve a marketing privacy notice (TH/EN/ZH) replacing the app policy behind the lead-form consent | audit §3 M2 | ☐ approve draft ☐ counsel review first |
| C3 | Confirm the Google Ads / GTM owner who will mark `contact_click`, `lead_submitted`, `assistant_lead_created` as conversions | audit §12.7 | name: ____ |
| C4 | Run migration 0127 on Supabase before the next deploy | docs/DATABASE.md | ☐ done on: ____ |

---

# ข้อเท็จจริงที่ต้องยืนยัน — แบบฟอร์มตัดสินใจ (roadmap ข้อ 9)

งานของเจ้าของธุรกิจ ทุกข้อด้านล่างควบคุมสิ่งที่แสดงบน detectivepulse.com โค้ดอ่านค่าทั้งหมดจากไฟล์เดียวคือ `src/lib/marketing/facts.ts` ถ้าข้อใดยังไม่ยืนยัน เว็บจะไม่กล่าวอ้างข้อนั้นเลย (ข้อความเดิมที่ยืนยันไม่ได้ เช่น “รางวัลการันตีมากมาย” และ “ฟรีแลนซ์ ไม่มีสำนักงาน” ถูกถอดออกแล้ว) กรอกคอลัมน์ขวาแล้วส่งไฟล์กลับ ทีมวิศวกรรมจะใส่ให้ในคอมมิตเดียว

## A. แสดงอยู่บนเว็บแล้ว — ยืนยันหรือแก้ไข

A1 ก่อตั้ง/เปิดดำเนินการตั้งแต่ปี 2016 · A2 ปิดเคสแล้ว 1,953+ · A3 ครอบคลุม 77 จังหวัด · A4 คะแนนรีวิว 4.8 จาก 63 รีวิวบน Fastwork · A5 ลิงก์โปรไฟล์ Fastwork (ยังไม่มี — ใส่แล้วป้ายรีวิวจะกลายเป็นลิงก์) · A6 รีวิว 6 รายการที่แสดงอยู่ (ยืนยันว่าได้รับอนุญาต) · A7 มัดจำ 50% ก่อนเริ่มงาน ชำระส่วนที่เหลือก่อนรับข้อมูล ยกเลิกไม่คืนมัดจำ · A8 เบอร์ +66 96 846 1406 · A9 อีเมล detectivepluse@gmail.com (หรือจะใช้อีเมลโดเมนบริษัท) · A10 ลิงก์ LINE OA https://lin.ee/SSqk98x · A11 เพจ Facebook · A12 วิดีโอ YouTube

## B. ยังไม่แสดง — ส่งข้อมูลเพื่อปลดล็อก

B1 ชื่อนิติบุคคลและเลขทะเบียน DBD (ช่องว่างความน่าเชื่อถืออันดับหนึ่งสำหรับลูกค้าต่างชาติและองค์กร และจำเป็นต่อการยืนยัน Google Business Profile) · B2 ที่อยู่สำหรับยืนยัน GBP (ซ่อนจากสาธารณะได้ — ส่งทางช่องทางส่วนตัว ห้ามกรอกในไฟล์นี้หรือใน facts.ts) · B3 วิธีนัดพบลูกค้า (จะแทนคำตอบ FAQ เรื่องสำนักงาน 3 ภาษา) · B4 เวลาตอบกลับที่รับปากได้ เช่น “ภายใน 1 ชั่วโมง 08:00–22:00” · B5 ช่องทางชำระเงินสำหรับลูกค้าต่างประเทศ และออกใบเสร็จ/ใบกำกับได้หรือไม่ · B6 รางวัลหรือสมาชิกภาพที่ระบุชื่อ ผู้มอบ และปีได้ (ถ้าไม่มี ให้ตอบว่าไม่มี) · B7 ชื่อเล่น/บทบาทของหัวหน้านักสืบที่เปิดเผยได้ ขนาดทีม ภาษาที่ให้บริการ · B8 ช่วงราคาที่ยินดีเผยแพร่ · B9 เคสจริงแบบไม่ระบุตัวตน 6 เคสสำหรับชุดแรกของ case study · B10 ตัวอย่างรายงานที่ปกปิดข้อมูลแล้ว

## C. การตัดสินใจที่ปลดล็อกงานวิศวกรรมที่ออกแบบไว้แล้ว

C1 อนุมัติแผนรวมหน้า 301 (ภาคผนวก C) · C2 อนุมัติข้อความนโยบายความเป็นส่วนตัวสำหรับเว็บการตลาด (หรือให้ที่ปรึกษากฎหมายตรวจก่อน) · C3 ระบุผู้ดูแล Google Ads/GTM ที่จะตั้ง conversion · C4 รัน migration 0127 บน Supabase ก่อน deploy ครั้งถัดไป
