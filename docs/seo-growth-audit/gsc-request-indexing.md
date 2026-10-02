# GSC — รายการ URL ที่ต้องกด Request indexing หลัง deploy 2026-10-02

Google Search Console จำกัดการขอ index ประมาณ 10 URL ต่อวันต่อ property จึงแบ่งเป็น 4 วัน ลำดับตามความสำคัญทางธุรกิจ (หน้าราคาและบริการที่ทำรายได้ก่อน)

วิธีทำแต่ละ URL: เปิด https://search.google.com/search-console → ช่องค้นหาด้านบน (URL inspection) → วาง URL → รอผล → กด **Request indexing** → รอขึ้น "Indexing requested" แล้วทำ URL ถัดไป วาง URL ภาษาไทยแบบตัวอักษรไทยได้เลย ไม่ต้องแปลงรหัส

ทำครั้งเดียวก่อนเริ่ม: เมนู **Sitemaps** → ใส่ `https://detectivepulse.com/sitemap.xml` → Submit (ถ้าเคยส่งแล้วให้ส่งซ้ำ)

## วันที่ 1 — หน้าเงินหลัก (ราคา + บริการที่ทำรายได้)

- [ ] https://detectivepulse.com/ราคานักสืบ
- [ ] https://detectivepulse.com/นักสืบชู้สาว
- [ ] https://detectivepulse.com/จ้างนักสืบตามแฟน
- [ ] https://detectivepulse.com/เช็คประวัติบุคคล
- [ ] https://detectivepulse.com/สืบตามหาคน
- [ ] https://detectivepulse.com/en/pricing
- [ ] https://detectivepulse.com/en/cheating-spouse-investigator
- [ ] https://detectivepulse.com/en/investigate-partner-before-marriage
- [ ] https://detectivepulse.com/en/background-check
- [ ] https://detectivepulse.com/en/find-missing-person

## วันที่ 2 — บริการที่เหลือ

- [ ] https://detectivepulse.com/สืบทรัพย์สิน
- [ ] https://detectivepulse.com/ตรวจสอบธุรกิจและคู่ค้า
- [ ] https://detectivepulse.com/ติดตามพฤติกรรม
- [ ] https://detectivepulse.com/นักสืบไอที
- [ ] https://detectivepulse.com/จ้างนักสืบ
- [ ] https://detectivepulse.com/en/asset-investigation
- [ ] https://detectivepulse.com/en/due-diligence-thailand
- [ ] https://detectivepulse.com/en/surveillance-thailand
- [ ] https://detectivepulse.com/en/cyber-investigation
- [ ] https://detectivepulse.com/en/romance-scam-investigation

## วันที่ 3 — ขั้นตอน กรุงเทพ เกี่ยวกับเรา ทนายความ

- [ ] https://detectivepulse.com/ขั้นตอนการทำงาน
- [ ] https://detectivepulse.com/นักสืบกรุงเทพ
- [ ] https://detectivepulse.com/เกี่ยวกับเรา
- [ ] https://detectivepulse.com/สำหรับทนายความ
- [ ] https://detectivepulse.com/ตรวจสอบประวัติพนักงาน
- [ ] https://detectivepulse.com/en/hire-a-private-detective
- [ ] https://detectivepulse.com/en/how-it-works
- [ ] https://detectivepulse.com/en/private-investigator-bangkok
- [ ] https://detectivepulse.com/en/about
- [ ] https://detectivepulse.com/en/for-law-firms

## วันที่ 4 — นโยบายความเป็นส่วนตัว

- [ ] https://detectivepulse.com/privacy
- [ ] https://detectivepulse.com/en/privacy
- [ ] https://detectivepulse.com/zh/privacy

## ไม่ต้องขอ index (ตั้งใจให้ noindex)

- /กรณีศึกษา, /en/case-studies, /zh/case-studies — จนกว่าจะมีเคสจริงครบ 3
- /sample-report, /en/sample-report — หน้าตัวอย่าง
- /lp/* และ /lp/en/* — หน้าโฆษณา

## หลังจากนั้น

- 7–14 วัน: ดูที่ Pages → "Indexed" ว่าหน้าใหม่เข้าครบ หน้าที่ขึ้น "Crawled – currently not indexed" ให้ขอ index ซ้ำอีกครั้ง
- 4 สัปดาห์: ใช้ข้อมูล Performance เพื่อเริ่มขั้นตอนเปิด 301 ตาม `consolidation-redirects.md`
