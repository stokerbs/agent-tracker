/**
 * Deterministic privacy scan for content text (no AI, no network).
 *
 * Finds identifiers that must never appear in published Detective Pulse
 * content: phone numbers, emails, license plates, LINE ids, URLs, Thai ID
 * numbers, street addresses, explicit calendar dates and owner-defined
 * denylist terms (client/target/staff names). Findings are NEVER auto-replaced
 * with invented details — the UI asks the owner to generalise instead.
 *
 * Pure functions → unit-tested in scrub.test.ts.
 */

import type { PrivacyFinding, PrivacyRules, PrivacyStatus } from "@/lib/studio/types";

export interface ScrubInput {
  /** field name → text (hook, script, caption, cta, variant:tiktok:script …) */
  fields: Record<string, string | null | undefined>;
  rules?: Partial<PrivacyRules> | null;
}

// Thai mobile/landline: 0X-XXX-XXXX / 0XXXXXXXXX / +66 X XXXX XXXX (spaces, dashes, dots)
const PHONE_RE = /(?:\+66[\s-]?\d(?:[\s.-]?\d){7,8}|(?<!\d)0\d(?:[\s.-]?\d){7,8}(?!\d))/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Thai plates: "กข 1234", "1กข 1234", "กข-1234", optional province after.
// The trailing lookahead has to refuse Thai letters, because two bare consonants and a number is an
// ordinary Thai phrase: relaxing it read "รอ 5นาที", "ขอ 2ชุด" and "คน 3คน" as plates — 8 of 19 measured
// sentences — and a false positive here holds a finished clip in the review queue.
const PLATE_RE = /(?<![ก-๙A-Za-z0-9])(?:\d?[ก-ฮ]{1,2}[\s-]?\d{1,4})(?![ก-๙0-9])/g;
/**
 * The same plate when a cue word says it is one. Thai writes no space between words, so a customer
 * types "ทะเบียน กข 1234จอดอยู่หน้าบ้าน" and the plate above cannot match — its boundary is what keeps
 * ordinary phrases out, and it cannot tell this from one. The cue can: nothing after ทะเบียน / ป้าย /
 * รถ that looks like consonants-then-digits is a quantity. Measured: this catches the glued forms with
 * no new false positive on the sentences the strict rule exists to protect.
 *
 * The shorter cues refuse to be followed by รถ, or the engine backtracks into them and reads the รถ of
 * "ทะเบียนรถ" as the plate's own letters: "ทะเบียนรถ 1กข 12345" became "ทะเบียน[ทะเบียนรถ]กข 12345",
 * keeping the number beside a token that says it is gone. It also drops "ทะเบียนรถ 2 คัน" as a plate.
 */
const PLATE_CUED_RE = /(?:ป้ายทะเบียน(?!รถ)|ทะเบียนรถ|ทะเบียน(?!รถ)|ป้าย)\s*(\d?[ก-ฮ]{1,2}[\s-]?\d{1,4})(?![\d๐-๙])/g;
/**
 * รถ is a cue too, but a much weaker one: it is glued to the front of ordinary words, so "รถชน 3 ครั้ง",
 * "รถวน 2 รอบ", "รถผม 2 คัน" and "ซื้อรถ งบ 5 แสน" all read as plates when it is treated like the rest
 * — the security gate found every one of them. It earns its place with a space after it and two digits
 * in the plate, which is what separates a plate from a count. The cost, measured, is a single-digit
 * plate announced with รถ alone ("รถ ผก 5") — six rows of a 252-row grid, and ทะเบียน catches those.
 */
const PLATE_CAR_CUE_RE = /รถ\s+(\d?[ก-ฮ]{1,2}[\s-]?\d{2,4})(?![\d๐-๙])/g;
const LINE_ID_RE = /(?:LINE\s*(?:ID|ไอดี)?\s*[:：]?\s*@?[A-Za-z0-9._-]{4,}|@[A-Za-z][A-Za-z0-9._-]{3,})/gi;
const URL_RE = /https?:\/\/[^\s)]+|www\.[^\s)]+/gi;
const THAI_ID_RE = /(?<!\d)\d(?:[\s-]?\d){12}(?!\d)/g; // 13 digits
// House number + ซอย/ถนน/หมู่ or "เลขที่"
const ADDRESS_RE = /(?:เลขที่\s*\d+[\/\d-]*|\d+[\/\d-]*\s*(?:ซอย|ซ\.|ถนน|ถ\.|หมู่|ม\.)\s*[ก-๙A-Za-z0-9.\s-]{1,30})/g;
const DATE_RE = /\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:25|20)\d{2}\b|\b(?:วันที่\s*)?\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:25|20)?\d{2}\b/g;
/**
 * The token after a name, which in Thai is the surname often enough that leaving it stores half a
 * person's identity beside a token saying the name is gone. Two rules about this list, both learned by
 * measurement and both written down in §15b before being broken again here:
 *
 * - a word in it counts only as the WHOLE token. As a prefix it took real surnames with it — มีชัย,
 *   มีสุข, ที่รักษ์, จะเรินทร์, ช่วยชาติ, อยู่สุข all begin with a word on this list, and the QA gate
 *   found them surviving next to a [ชื่อ]. The same mistake as NOT_A_NAME's prefixes, a third time.
 * - there is one list, used by the rules and by the LINE inbox. Two copies drifted to sixteen and
 *   twenty-seven words, so the rules disagreed about which surnames to keep.
 *
 * Thai writes no space inside a word, so what follows a name is one run: a surname, or the rest of the
 * sentence. Only a particle or a bare grammar word is reliably neither, which is why the cost of this
 * is a lost clause whenever a customer writes their question as one run — recorded in §15b.
 */
const NOT_A_SURNAME = "ครับ|ค่ะ|คะ|ค่า|นะ|จ้า|จ้ะ|ขอบคุณ|สวัสดี|คือ|ว่า|ไม่|และ|กับ|ที่|จะ|เป็น|มี|ขอ|ช่วย|อยู่|อยาก|ได้|ให้|ไป|มา|ทำ";
/**
 * Speech, not a surname — and what marks speech is a question or a discourse word, optionally with a
 * politeness particle after it, at the END of the run: "ขอเอกสารด้วยครับ", "ราคาเท่าไหร่ครับ",
 * "ติดต่อกลับได้ไหม". A particle on its own does not mark it, because Thai glues one onto a surname as
 * readily as onto a question — "นายสมชาย ใจดีครับ" is a full name, and treating its ครับ as speech kept
 * the surname in 168 of 168 measured rows, next to a token saying the name was gone.
 *
 * The test is at the end of the run because that is where Thai puts these words, while a surname ends
 * on an auspicious syllable (ชัย, ศักดิ์, รัตน์, ทอง, สุข). Testing anywhere inside the run failed OPEN:
 * นะ is a syllable in ชนะชัย, ธนะรัตน์, มานะชัย and จิตรชนะ, one of the commonest families of Thai
 * surnames, and 80 of 280 shapes survived. What is left ambiguous after this is a surname glued to a
 * discourse word — "ใจดีด้วย", "ใจดีเลย" — which stays; measured at 84 rows and recorded in §15b.
 */
const SPEECH_WORD = "ไหม|มั้ย|หรือ|อะไร|บ้าง|ด้วย|เลย|หน่อย|เท่าไหร่|ยังไง|ขอบคุณ|สวัสดี";
const BARE_PARTICLE = "ครับ|ค่ะ|คะ|ค่า|นะ|จ้า|จ้ะ";
export const SURNAME_TAIL = String.raw`\s(?!(?:${NOT_A_SURNAME})(?![ก-๙]))(?![ก-๙]*(?:${SPEECH_WORD})(?:${BARE_PARTICLE})?(?![ก-๙]))[ก-๙]{2,}(?![ก-๙])`;
const SURNAME = String.raw`(?:${SURNAME_TAIL})?`;
// Titles that usually precede a real name in Thai copy
// "คุณ" is the everyday pronoun "you" in chat, so it is NOT treated as a title
// (it swallowed whole clauses — Thai has no word spaces). Formal titles only,
// with a bounded name length so a false positive costs a few characters, not a sentence.
// Thai has no word spaces, so a title is almost always glued to the word before it ("พบนายสมชาย") —
// a lookbehind on "any Thai letter" would therefore only ever match at the start of a field.
// The exclusions belong to the title that owns them: นายหน้า/นายจ้าง are not people, but นายเอกชัย
// is, so นางเอก/นางฟ้า must not silence เอก/ฟ้า after นาย. ทนายความ is excluded here rather than by a
// lookbehind, which would have swallowed ทนายสมชาย. Longest title first, or นางสาว matches as นาง + สาว.
const NAME_TITLE_RE = new RegExp(
  String.raw`(?:นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|ดร\.|นาย(?!ความ|หน้า|จ้าง|ทุน|งาน|กรัฐมนตรี|กสมาคม|กเทศมนตรี|กสภา|กอบต|กอบจ|กสมาพันธ์|ก(?:ฯ|[\s,.!?…]|$))|นาง(?!เอก|ฟ้า|แบบ|สนาม))\s?([ก-๙]{2,10})`,
  "g",
);
// "คุณ" + a SHORT token followed by a space/punctuation/end is a vocative name
// ("คุณสมชาย ขับรถ"); the pronoun runs straight into a verb ("คุณรับงาน…").
const KHUN_NAME_RE = new RegExp(String.raw`(?<!ขอบ|ขอบพระ|ชอบ)คุณ([ก-๙]{2,5})(?=[\s,.!?…]|$)`, "g");
const KHUN_STOPLIST = new Set(["คะ", "ครับ", "ค่ะ", "ช่วย", "รับ", "มี", "ทำ", "ว่า", "จะ", "ได้", "ไหม", "ต้อง", "เป็น", "อยู่", "ไป", "มา", "คิด", "เอง", "ล่ะ", "นะ", "เห็น", "รู้", "บอก", "ถาม", "ลอง", "ดู", "ก็", "แล้ว", "ยัง", "เคย", "อยาก", "ควร", "ขอ", "ใช้", "เอา", "ให้", "พอ", "ลูกค้า", "ผู้ชาย", "ผู้หญิง", "ตำรวจ", "ทนาย", "หมอ", "ครู", "มาก", "มากๆ", "พ่อ", "แม่", "ตา", "ยาย", "ปู่", "ย่า", "ลุง", "ป้า", "น้า", "อา", "พี่", "น้อง", "แฟน", "สามี", "ภรรยา", "ลูก", "ภาพ", "ค่า", "จ้า", "นะ", "นะคะ", "นะครับ", "หมอ", "ครู", "ด้วย", "เลย", "ก่อน", "แน่", "ไว้", "หน่อย", "ล่ะ"]);
// Untitled names after cue words in chat: "แฟนชื่อสมชาย", "ชื่อเล่นว่าเอ", "เรียกว่าพี่บี".
// What follows the cue has to look like a name. Thai cannot enumerate *whose* name it is — a case
// brings a new word every time (คนหาย, ผู้เช่า, เจ้าหนี้, ทายาท, ชู้) — but the name slot itself is
// enumerable: field labels and grammar words are never a person (docs §15b).
const NOT_A_NAME =
  "ที่อยู่|นามสกุล|เบอร์|โทร|อายุ|อาชีพ|พิกัด|เวลา|วันที่|รูปถ่าย|เลขบัตร|เลขที่|เลขคดี|ตรงกับ|ตรงกัน|อีเมล|ไลน์|ที่|ใน|ของ|และ|หรือ|กับ|ไม่|ซึ่ง|การ|ความ|เรื่อง|อะไร|ใคร|ใช่|เปล่า|จะ|ต้อง|เพราะ|สะกด|ข้อมูล|ตำแหน่ง|สรุป|ทีม|ชื่อ|รหัส|บริการ|ระบบ|แพ็ก|ปลอม|ย่อ|นี้|นั้น|เดียว|คือ|บัญชี|ธนาคาร|เอกสาร|รายงาน|สกุล|ช่องทาง|หลักฐาน|บริษัท|พยาน|ยานพาหนะ|เต็มไป|ยังไม่|ไม่ได้";
/** Compounds where ชื่อ is part of another word, not a cue: ชื่อเสียง, ชื่อบัญชี, ชื่อเล่น… */
const NOT_A_CUE = "เสียง|ดัง|บัญชี|ร้าน|บริษัท|เรื่อง|สินค้า|โครงการ|ผู้ใช้|ไฟล์|จริง|ปลอม|เต็ม|ย่อ|นี้|นั้น|ใน|ที่|ของ|และ|หรือ|กับ|เล่น";
const NAME_CUE_RE = new RegExp(
  String.raw`(?<![เแโใไ])(?:ชื่อเล่นว่า|ชื่อเล่น|ชื่อว่า|เรียกว่า|ชื่อ(?!${NOT_A_CUE}))\s*(?:คุณ|พี่|น้อง|นาย|นาง)?\s*((?!${NOT_A_NAME})[ก-๙A-Za-z]{2,10})`,
  "g",
);
// "ชื่อ<particle> … คือ|ว่า|<space> <name>" — the cue rule skips those particles because they usually
// introduce a thing ("ชื่อของบริการนี้คือ…"), so this catches the case where a person really is named.
// "ชื่อที่สะกดว่าสมชาย" names someone, so สะกด no longer disqualifies a sentence; what keeps the
// 2026-09-24 line ("ชื่อที่ไม่แน่ใจว่าใช่หรือเปล่า") quiet is the name slot plus HEDGE on the ว่า branch. On the space
// branch a field word in the gap means the sentence is listing fields ("ชื่อหรือเบอร์โทรศัพท์ นักสืบ…").
// The compound guard below is defence in depth, not what does the work: what keeps ชื่อเสียง/ชื่อบัญชี
// out is the particle this rule requires straight after ชื่อ/ชื่อเล่น, which no compound has.
/**
 * Hedging alone does not mean nobody is named — "ชื่อที่สงสัยว่าเป็นสมชาย" and "ชื่อที่พิสูจน์แล้ว
 * ว่าเป็นสมชาย" identify a person, and "จำไม่ได้ว่าสมชายหรือสมชัย" holds two real names (which no rule here catches — see docs §15b). What
 * decides it is what follows ว่า: a person, or a judgement about a name. So the sentence is only
 * dropped when the gap hedges *and* the slot is one of these — written as whole phrases, because
 * this file has learned twice that a prefix list takes real names with it.
 */
const HEDGE = "ไม่แน่ใจ|ไม่ตรง|จำไม่ได้|ไม่รู้|สงสัย|พิสูจน์|ไม่ชัด|ไม่แน่";
const PREDICATE =
  "เป็นคน|เป็นใคร|จริงหรือ|ถูกต้อง|ถูกหรือ|ผิดหรือ|ครบทุก|เต็มไป|ยังไม่|ใช่หรือ|คนเดียวกัน|ตัวอักษร|หรือไม่|หรือเปล่า|ข้อสงสัย|อะไร|เขียนอย่าง|เขียนยัง|สะกดอย่าง";
const FIELD_WORD = "เบอร์|โทร|ที่อยู่|อายุ|อาชีพ|พิกัด|วันที่|รูป|อีเมล|ไลน์";
/**
 * Politeness particles and openers. The gap between the cue and the name must not cross one: a gap
 * that does runs past the name and over the question ("ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม" was a
 * single finding ending on ไหม), and then nothing in the finding says which token was the name. With
 * the gap stopped here and the slot refusing a particle, a finding ENDS at the name — which is what
 * lets the inbox layer redact one without guessing (docs §15b).
 */
/**
 * A particle after a space ends the gap — but only in the branch that has no คือ/ว่า to aim at. That
 * branch takes the token after the gap as the name, so a gap that crosses " ครับ" hands the slot a
 * particle or a word from the question ("ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม"). The คือ/ว่า branches
 * must be free to cross one, because customers write the label, a particle, then the name ("ชื่อของ
 * ภรรยา ครับ คือ สมหญิง") — blocking those cost the whole finding, measured by the security gate.
 * It cannot be a bare list: เจ้าหนี้ contains จ้า and มะนาว contains นะ, so the space is what makes it
 * a particle, and in the slot it must be the whole slot, which keeps คะนอง a name (docs §15b).
 */
const PARTICLES = "ครับ|ค่ะ|คะ|ค่า|นะ|จ้า|จ้ะ|ขอบคุณ|สวัสดี";
/**
 * ว่า as a cue, not as the middle of a word: ผู้ว่าจ้าง and ผู้ว่าราชการ are not saying anything. The
 * gap has to be able to cross one of those to reach the คือ that follows, or the rule reads the word
 * fragment as the name and leaves the real one in the row — measured by the security gate.
 */
const VA = String.raw`(?<!ผู้)ว่า`;
const PARTICLE_GAP = String.raw`\s(?:${PARTICLES})`;
const PARTICLE_SLOT = String.raw`(?:${PARTICLES})(?:[\s,.!?…]|$)`;
/**
 * The gap in the spaced form, which has no คือ/ว่า to aim at. It stops at a particle after a space so
 * the name slot lands on the name and not on the question behind it — and because customers write the
 * label, a particle, then the name ("ชื่อของเป้าหมาย ครับ สมชาย"), the rule has a second alternative
 * that steps over exactly one particle. The tight alternative comes first, so the shorter reading of
 * "ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม" wins and the question survives.
 */
const SPACED_GAP = String.raw`(?:(?!คือ|${VA}|${PARTICLE_GAP}|${FIELD_WORD})[ก-๙\s])`;
const NAME_INTRO_RE = new RegExp(
  String.raw`(?<![เแโใไ])ชื่อ(?!เสียง|ดัง|บัญชี|ร้าน|บริษัท|สินค้า|โครงการ|ผู้ใช้|ไฟล์)(?:เล่น)?(?:ของ|ใน|ที่|และ|หรือ|กับ)(?:(?:(?!คือ|${VA})[ก-๙\s]){0,25}คือ|(?:(?!คือ|${VA}|${HEDGE})[ก-๙\s]){0,25}${VA}|(?:(?!คือ|${VA})[ก-๙\s]){0,25}${VA}(?=\s*(?:คือ\s*)?(?!${PREDICATE})))\s*(?:คือ\s*)?((?!${NOT_A_NAME}|${PARTICLE_SLOT})[ก-๙A-Za-z]{2,10}${SURNAME})`,
  "g",
);
/**
 * The same introduction with nothing but a space where คือ/ว่า would be ("ชื่อของสามี สมชาย"). It
 * flags, but it does NOT say where the name is and must not pretend to: "ชื่อของ ก ข" is a label and
 * a name in one reading and a name and a word of the question in the other, and Thai writes no
 * spaces inside a word to settle it. Whoever consumes this takes the whole finding (docs §15b).
 */
const NAME_INTRO_SPACED_RE = new RegExp(
  String.raw`(?<![เแโใไ])ชื่อ(?!เสียง|ดัง|บัญชี|ร้าน|บริษัท|สินค้า|โครงการ|ผู้ใช้|ไฟล์)(?:เล่น)?(?:ของ|ใน|ที่|และ|หรือ|กับ)(?:${SPACED_GAP}{0,25}\s|${SPACED_GAP}{0,25}\s(?:${PARTICLES})\s)(?!${NOT_A_NAME}|${PARTICLE_SLOT})[ก-๙A-Za-z]{2,10}`,
  "g",
);
// Ages: "อายุ 34", "34 ปี", "5 ขวบ"
const AGE_RE = /(?:อายุ\s*\d{1,2}(?:\s*ปี)?|(?<!\d)\d{1,2}\s*(?:ปี|ขวบ)(?![ก-๙A-Za-z0-9]))/g;
// Brand handles we allow (our own CTA) — never flag these.
const ALLOWLIST = new Set(["@detectivepluse", "detectivepluse", "detectivepluse@gmail.com", "096-846-1406", "0968461406", "096 846 1406"]);
const ALLOWLIST_URL_HOSTS = ["detectivepulse.com", "lin.ee", "line.me"];

function pushFinding(list: PrivacyFinding[], f: PrivacyFinding) {
  if (!list.some((x) => x.kind === f.kind && x.excerpt === f.excerpt && x.field === f.field)) list.push(f);
}

function isAllowlisted(excerpt: string): boolean {
  const norm = excerpt.trim().toLowerCase();
  if (ALLOWLIST.has(norm)) return true;
  if (ALLOWLIST.has(norm.replace(/[\s-]/g, ""))) return true;
  return false;
}

function scanField(field: string, text: string, rules: Partial<PrivacyRules> | null | undefined, out: PrivacyFinding[]) {
  const push = (kind: PrivacyFinding["kind"], excerpt: string, reason: string, severity: PrivacyFinding["severity"], name?: string) =>
    pushFinding(out, { kind, excerpt: excerpt.trim().slice(0, 80), reason, severity, field, source: "deterministic", ...(name ? { name } : {}) });

  for (const m of text.matchAll(PHONE_RE)) {
    if (!isAllowlisted(m[0])) push("phone", m[0], "พบหมายเลขโทรศัพท์ที่ไม่ใช่ช่องทางติดต่อของบริษัท", "high");
  }
  // [start, end) of every email — the LINE handle rule must not re-flag an email's "@domain".
  const emailRanges: Array<[number, number]> = [];
  for (const m of text.matchAll(EMAIL_RE)) {
    emailRanges.push([m.index, m.index + m[0].length]);
    if (!isAllowlisted(m[0])) push("email", m[0], "พบอีเมลส่วนบุคคล", "high");
  }
  for (const m of text.matchAll(THAI_ID_RE)) push("id_number", m[0], "พบเลข 13 หลักคล้ายเลขบัตรประชาชน", "high");
  for (const m of [...text.matchAll(PLATE_CUED_RE), ...text.matchAll(PLATE_CAR_CUE_RE)]) {
    // One consonant and one digit after a cue is a count, not a plate: "รถ ก 1 คันจอดอยู่". Two of
    // either makes it a plate — the rule below insists on two digits, which would lose the real
    // single-digit plates ("ทะเบียน ผก 5", 36 rows of a measured grid), and the cue is what earns the
    // slack here.
    const letters = m[1].replace(/[^ก-ฮ]/g, "").length;
    if (m[1].replace(/\D/g, "").length >= 2 || letters >= 2) {
      push("plate", m[1], "พบทะเบียนรถหลังคำบ่งชี้ (ทะเบียน/ป้าย/รถ)", "high");
    }
  }
  for (const m of text.matchAll(PLATE_RE)) {
    // Skip things like "ก 1" false positives that are too short.
    if (m[0].replace(/\D/g, "").length >= 2) push("plate", m[0], "พบรูปแบบคล้ายทะเบียนรถ", "high");
  }
  for (const m of text.matchAll(LINE_ID_RE)) {
    // "@gmail.com" inside "detectivepluse@gmail.com" is a domain, not a handle; the email rule
    // above already reported (or allowlisted) the whole address. A handle after an email still flags.
    const at = m[0].indexOf("@");
    if (at >= 0 && emailRanges.some(([s, e]) => m.index + at >= s && m.index + at < e)) continue;
    if (!isAllowlisted(m[0].replace(/^LINE\s*(?:ID|ไอดี)?\s*[:：]?\s*/i, ""))) push("line_id", m[0], "พบ LINE ID / handle ที่ไม่ใช่ของบริษัท", "medium");
  }
  for (const m of text.matchAll(URL_RE)) {
    const host = m[0].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase();
    if (!ALLOWLIST_URL_HOSTS.some((h) => host === h || host.endsWith("." + h))) push("url", m[0], "พบลิงก์ภายนอก — ตรวจสอบว่าไม่ชี้ไปยังบุคคล/บัญชีจริง", "low");
  }
  for (const m of text.matchAll(ADDRESS_RE)) push("address", m[0], "พบข้อความคล้ายที่อยู่ (บ้านเลขที่/ซอย/ถนน)", "high");
  for (const m of text.matchAll(DATE_RE)) push("date", m[0], "พบวันที่ระบุชัด — อาจเชื่อมโยงกับเคสจริงได้", "medium");
  for (const m of text.matchAll(NAME_TITLE_RE)) push("name", m[0], "พบคำนำหน้าชื่อตามด้วยชื่อ — อาจเป็นชื่อบุคคลจริง", "medium", m[1]);
  for (const m of text.matchAll(KHUN_NAME_RE)) {
    if (!KHUN_STOPLIST.has(m[1])) push("name", m[0], "พบ “คุณ” ตามด้วยชื่อสั้น ๆ — อาจเป็นชื่อบุคคลจริง", "medium", m[1]);
  }
  for (const m of text.matchAll(NAME_CUE_RE)) push("name", m[0], "พบคำบ่งชี้ชื่อ (ชื่อ/ชื่อเล่น/เรียกว่า) ตามด้วยชื่อ", "medium", m[1]);
  for (const m of text.matchAll(NAME_INTRO_RE)) push("name", m[0], "พบการแนะนำชื่อ (ชื่อของ/ชื่อใน/ชื่อที่ … คือ) ตามด้วยชื่อ", "medium", m[1]);
  for (const m of text.matchAll(NAME_INTRO_SPACED_RE)) push("name", m[0], "พบการแนะนำชื่อโดยเว้นวรรค — ไม่ทราบว่าคำใดเป็นชื่อ", "medium");
  for (const m of text.matchAll(AGE_RE)) push("other", m[0], "พบอายุระบุชัด — ร่วมกับรายละเอียดอื่นอาจระบุตัวตนได้", "low");

  for (const term of rules?.denylist ?? []) {
    const t = term.trim();
    if (t.length < 2) continue;
    if (text.toLowerCase().includes(t.toLowerCase())) push("denylist", t, "คำนี้อยู่ในรายการห้ามเผยแพร่ (denylist) ของสตูดิโอ", "high");
  }
  for (const pattern of rules?.custom_patterns ?? []) {
    try {
      const re = new RegExp(pattern, "giu");
      for (const m of text.matchAll(re)) push("other", m[0], `ตรงกับรูปแบบที่กำหนดเอง: ${pattern}`, "medium");
    } catch {
      // Invalid under the "giu" flags (validated on save with the same flags);
      // patterns saved by older versions may need re-saving in Settings.
      console.warn("[studio:privacy] skipping invalid custom pattern:", pattern);
    }
  }
}

export function scrubText(input: ScrubInput): PrivacyFinding[] {
  const out: PrivacyFinding[] = [];
  for (const [field, text] of Object.entries(input.fields)) {
    if (!text) continue;
    scanField(field, text, input.rules, out);
  }
  return out;
}

/** Aggregate findings into a gate status. */
export function privacyStatusFromFindings(findings: PrivacyFinding[], strict = false): PrivacyStatus {
  if (findings.length === 0) return "safe";
  if (findings.some((f) => f.severity === "high")) return "blocked";
  if (strict) return "blocked";
  return "review_required";
}

/** Human-readable reason summary for the UI. */
export function summarizeFindings(findings: PrivacyFinding[]): string {
  if (!findings.length) return "ไม่พบข้อมูลระบุตัวตนในเนื้อหา";
  const byKind = new Map<string, number>();
  for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  const labels: Record<PrivacyFinding["kind"], string> = {
    phone: "เบอร์โทร",
    email: "อีเมล",
    plate: "ทะเบียนรถ",
    line_id: "LINE ID",
    url: "ลิงก์",
    address: "ที่อยู่",
    id_number: "เลขบัตร",
    date: "วันที่",
    denylist: "คำต้องห้าม",
    name: "ชื่อบุคคล",
    location: "สถานที่",
    company: "ชื่อบริษัท",
    photo: "รูปภาพ",
    other: "อื่น ๆ",
  };
  return Array.from(byKind.entries())
    .map(([k, n]) => `${labels[k as PrivacyFinding["kind"]] ?? k} ×${n}`)
    .join(" · ");
}
