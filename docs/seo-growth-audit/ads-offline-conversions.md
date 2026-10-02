# Google Ads offline conversions — runbook

**What it does:** turns leads that *actually* became business into Google Ads conversions, so Smart Bidding optimises for qualified and paid cases rather than every form fill. Source of truth is `/leads` (lead quality, stage, revenue); the export lives at `/marketing-insights` → "ดาวน์โหลด CSV".

## One-time setup (Agency + Owner, item C8)

1. In Google Ads → Goals → Conversions → **New conversion action → Import → Other data sources or CRMs → Track conversions from clicks**. Create two actions with these exact names:
   - `Qualified lead` — category Submit lead form / Qualified lead, count **One**, value: *Don't use a value*, click-through window 90 days.
   - `Paid case` — category Purchase, count **One**, value: *Use different values for each conversion*, default currency THB.
2. Set `Qualified lead` and `Paid case` as **Primary** for bidding; demote the website "Lead form" conversion to **Secondary** once ≥ 30 qualified uploads/month exist.
3. Confirm the Ads account's auto-tagging is on (it is; `gclid` is captured on first touch — migration 0127).

## Weekly routine (Owner or Agency, 5 minutes)

1. In `/leads`, rate each new lead: **คุณภาพลีด** (`qualified` / `high_value` when a real consultation happened; `spam` / `unqualified` otherwise) and, when a quote did not close, **เหตุผลที่ไม่ปิดการขาย**. Mark payment by moving the stage to `paid` (sets `converted_at`) and fill **รายได้จริง**.
2. In `/marketing-insights`, click **ดาวน์โหลด CSV** (default last 90 days of leads).
3. Google Ads → Goals → Conversions → **Uploads** → upload the file (format "Conversions from clicks"; the first line `Parameters:TimeZone=Asia/Bangkok` is required). Google deduplicates on gclid + conversion name + time, so re-uploading the same rows is safe.
4. Paste the latest **campaign cost CSV** (Google Ads → Campaigns → Download → CSV) into "นำเข้าค่าโฆษณา" so CPL / CPQL / ROAS update.

## What the export contains

| Row | When | Value |
|---|---|---|
| `Qualified lead` | lead has a gclid and quality `qualified`/`high_value`, or it converted | none |
| `Paid case` | lead has a gclid and `converted_at` | `final_revenue`, else `quoted_value` |

Time = stage change (qualified) or `converted_at` (paid), Asia/Bangkok. Leads without a gclid (organic, LINE, direct) never appear. Nothing personal is in the file: gclid, name of the action, time, value, currency.

## สรุปภาษาไทย

สร้าง conversion action ชื่อ `Qualified lead` และ `Paid case` ใน Google Ads (ครั้งเดียว) จากนั้นทุกสัปดาห์: ให้คะแนนลีดใน /leads → ดาวน์โหลด CSV ใน /marketing-insights → อัปโหลดใน Google Ads (Uploads) → วาง CSV ค่าโฆษณาเพื่อดู CPL/ROAS ไฟล์ไม่มีข้อมูลส่วนบุคคล มีแค่ gclid เวลา และมูลค่า
