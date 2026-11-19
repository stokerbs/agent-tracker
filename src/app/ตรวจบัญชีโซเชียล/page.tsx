import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowRight, CircleAlert, Crosshair, FileCheck2, Link2, ShieldCheck } from "lucide-react";
import { CONTACT } from "@/lib/marketing/contact";
import { isMarketingHost } from "@/lib/marketing/host";

const title = "ตรวจบัญชีโซเชียลต้องสงสัย บัญชีปลอมและแอบอ้าง";
const description = "สงสัยว่าเจอบัญชีปลอมหรือแอบอ้าง? Detective Pulse เทียบข้อมูลสาธารณะและสรุปสิ่งที่ยืนยันได้ จุดน่าสงสัย และสิ่งที่ยังไม่ทราบ";
const path = "/ตรวจบัญชีโซเชียล";
const policeUrl = "https://thaipoliceonline.go.th/?p=faq";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: CONTACT.brand,
    title,
    description,
    url: path,
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title, description },
};

const findings = [
  { icon: ShieldCheck, label: "สิ่งที่ยืนยันได้", detail: "ข้อมูลที่ตรงกับแหล่งอ้างอิง เช่น ช่องทางทางการของร้านหรือแบรนด์" },
  { icon: CircleAlert, label: "จุดที่น่าสงสัย", detail: "ข้อมูลที่ขัดกัน หรือข้อความที่เร่งให้โอนเงิน พร้อมเหตุผลประกอบ" },
  { icon: FileCheck2, label: "สิ่งที่ยังยืนยันไม่ได้", detail: "ระบุชัดเมื่อข้อมูลไม่พอ ไม่สรุปว่าบัญชีปลอมหรือปลอดภัยโดยไม่มีหลักฐาน" },
];

export default async function SocialAccountCheckPage() {
  const liveIntake = isMarketingHost((await headers()).get("host"));

  return (
    <div lang="th" className="min-h-screen bg-[#0b1319] font-sans text-slate-100 selection:bg-teal-200 selection:text-slate-950">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-teal-300/30 bg-teal-300/10 text-teal-200">
            <Crosshair className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Detective Pulse</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:py-20">
          <div>
            <p className="mb-5 text-sm font-semibold text-teal-200">บริการตรวจบัญชีโซเชียล</p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              สงสัยว่าบัญชีนี้ปลอมหรือแอบอ้าง?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              ถ้ามีคนอ้างว่าเป็นร้าน แบรนด์ หรือหน่วยงานแล้วทักมาขอเงิน
              เราช่วยเทียบข้อมูลสาธารณะกับช่องทางทางการและสรุปว่าควรระวังอะไร
              เพื่อให้คุณตัดสินใจก่อนโอนหรือตอบกลับ
            </p>
            <div className="mt-7">
              {liveIntake ? (
                <a href={CONTACT.lineUrl} rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-teal-300 px-5 py-3 font-bold text-slate-950 hover:bg-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-200 sm:w-auto">
                  แจ้งเรื่องเบื้องต้นทาง LINE <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <p className="inline-flex min-h-12 items-center rounded-lg border border-teal-300/30 bg-teal-300/10 px-5 py-3 text-sm font-semibold text-teal-100">
                  หน้าตัวอย่าง · ยังไม่เปิดรับเรื่อง
                </p>
              )}
              <p className="mt-3 max-w-lg text-sm leading-7 text-slate-300">
                เริ่มด้วยแพลตฟอร์มและเหตุการณ์สั้น ๆ ไม่ต้องส่งรหัสผ่าน, OTP, สลิป หรือเอกสารส่วนตัว
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-[#15232a] p-5 sm:p-8">
            <h2 className="mb-1 text-xl font-bold">ในรายงานมีอะไรบ้าง</h2>
            <ul className="divide-y divide-white/10">
              {findings.map(({ icon: Icon, label, detail }) => (
                <li key={label} className="flex gap-4 py-4 last:pb-0">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-teal-200" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{label}</h3>
                    <p className="mt-1 text-sm leading-7 text-slate-300">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside aria-labelledby="urgent" className="rounded-xl border border-amber-300/35 bg-amber-300/10 p-5 sm:px-7">
          <h2 id="urgent" className="font-bold text-amber-100">โอนเงินไปแล้ว? ไม่ต้องรอรายงาน</h2>
          <p className="mt-1 text-sm leading-7 text-slate-100 sm:text-base">
            ติดต่อธนาคารของคุณทันที แล้วเก็บหลักฐานไว้สำหรับ{" "}
            <a className="rounded-sm font-semibold text-amber-100 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200" href={policeUrl} rel="noreferrer">
              แจ้งตำรวจไซเบอร์
            </a>
          </p>
        </aside>

        <section className="grid gap-8 py-12 sm:grid-cols-2 sm:gap-10 sm:py-16">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Link2 className="h-5 w-5 text-teal-200" aria-hidden="true" /> เริ่มต้นอย่างไร
            </h2>
            <ol className="list-decimal space-y-2 pl-5 leading-7 text-slate-300">
              <li>บอกว่าเป็นแพลตฟอร์มไหน และสงสัยจากเหตุการณ์อะไร</li>
              <li>ทีมประเมินก่อนว่าเรื่องนี้ตรวจอะไรได้บ้าง</li>
              <li>ถ้าต้องดูหลักฐานเพิ่ม ทีมจะแจ้งว่าควรส่งอะไรและปิดข้อมูลส่วนตัวส่วนไหน</li>
            </ol>
          </div>
          <div>
            <h2 className="mb-3 text-xl font-bold">ขอบเขตการตรวจ</h2>
            <p className="leading-7 text-slate-300">
              ตรวจเฉพาะข้อมูลสาธารณะและหลักฐานที่คุณมีสิทธิ์ส่ง ไม่เข้าบัญชีของผู้อื่น
              ไม่ค้นข้อมูลส่วนตัว ที่อยู่ หรือระบุว่าใครอยู่เบื้องหลังบัญชี และไม่รับประกันผลการตรวจ
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-slate-300 sm:px-8">
          <span>Detective Pulse</span>
          <a href="/privacy" className="rounded-sm underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-200">
            นโยบายความเป็นส่วนตัว
          </a>
        </div>
      </footer>
    </div>
  );
}
