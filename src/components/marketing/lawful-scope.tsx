import { ShieldCheck, Ban } from "lucide-react";

type Lang = "th" | "en";

/**
 * "What we do / what we never do" — the lawful-scope block the Chinese pages
 * already carry (ZhPage.notOffered), now for Thai and English service pages
 * and the homes. Keeping this in one component means the legal boundary is
 * stated identically everywhere (PDPA B.E. 2562, Computer Crime Act).
 */
const COPY: Record<Lang, { title: string; doTitle: string; doItems: string[]; dontTitle: string; dontItems: string[]; note: string }> = {
  th: {
    title: "ขอบเขตการทำงานตามกฎหมาย",
    doTitle: "สิ่งที่เราทำ",
    doItems: [
      "เฝ้าสังเกตและบันทึกพฤติกรรมในที่สาธารณะ",
      "สืบค้นจากแหล่งข้อมูลเปิดและข้อมูลที่เข้าถึงได้ตามกฎหมาย",
      "ลงพื้นที่ตรวจสอบที่อยู่ สถานที่ทำงาน และกิจการจริง",
      "ตรวจสอบความสอดคล้องของเอกสารและข้อมูลที่ลูกค้าให้มา",
      "รายงานข้อเท็จจริงเป็นลายลักษณ์อักษร พร้อมภาพ วิดีโอ และไทม์ไลน์",
    ],
    dontTitle: "สิ่งที่เราไม่ทำ (ไม่มีนักสืบรายใดทำได้อย่างถูกกฎหมาย)",
    dontItems: [
      "ขอหรือซื้อข้อมูลจากฐานข้อมูลราชการ ธนาคาร เครดิตบูโร หรือผู้ให้บริการโทรศัพท์",
      "ดึงประวัติการโทร ข้อความ ตำแหน่งโทรศัพท์ รายการเดินบัญชี หรือข้อมูลเข้า-ออกประเทศ",
      "เจาะระบบ ดักฟัง ติดตั้งโปรแกรมสอดแนม หรือติด GPS บนทรัพย์สินของผู้อื่น",
      "บุกรุกที่พักอาศัย หรือเข้าถึงบัญชีออนไลน์ของผู้อื่นโดยไม่ได้รับอนุญาต",
    ],
    note: "ข้อมูลบางประเภท (เช่น ทะเบียนราษฎร ทรัพย์สินตามโฉนด บัญชีธนาคาร) เข้าถึงได้เฉพาะผู้มีส่วนได้เสียผ่านกระบวนการทางกฎหมายหรือคำสั่งศาลเท่านั้น เรายินดีประสานงานกับทนายความของคุณ",
  },
  en: {
    title: "Our lawful scope",
    doTitle: "What we do",
    doItems: [
      "Observe and document behaviour in public places",
      "Research open sources and records that are lawfully accessible",
      "Visit addresses, workplaces and business premises to verify them in person",
      "Check the consistency of documents and information you provide",
      "Deliver a written factual report with photos, video and a timeline",
    ],
    dontTitle: "What we never do (no legitimate investigator can, lawfully)",
    dontItems: [
      "Obtain data from government, bank, credit-bureau or telecom databases",
      "Pull call logs, messages, phone location, bank statements or immigration records",
      "Hack, wiretap, install spyware, or place a GPS tracker on someone else's property",
      "Enter private premises or access another person's online accounts without consent",
    ],
    note: "Some records (civil registry, land titles, bank accounts) are available only to parties with a legal interest through legal process or a court order. We are happy to coordinate with your lawyer.",
  },
};

export function LawfulScope({ lang = "th", compact = false }: { lang?: Lang; compact?: boolean }) {
  const t = COPY[lang];
  return (
    <section aria-labelledby={`lawful-scope-${lang}`} className={`rounded-2xl border border-border bg-card/50 ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <h2 id={`lawful-scope-${lang}`} className="font-serif text-xl font-bold">{t.title}</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-primary">
            <ShieldCheck className="h-4 w-4" /> {t.doTitle}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {t.doItems.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-primary">▸</span>{i}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-destructive">
            <Ban className="h-4 w-4" /> {t.dontTitle}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {t.dontItems.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-destructive">✕</span>{i}</li>)}
          </ul>
        </div>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t.note}</p>
    </section>
  );
}
