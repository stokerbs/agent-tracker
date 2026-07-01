import type { Metadata } from "next";
import { ShieldCheck, GraduationCap, MapPin, Clock } from "lucide-react";
import { SectionHeading, CornerTicks } from "@/components/marketing/ui";
import { CareersForm } from "@/components/marketing/careers-form";

export const metadata: Metadata = {
  title: "ร่วมงานกับเรา — สมัครเป็นนักสืบ | Detective Pulse",
  description:
    "เปิดรับสมัครทีมนักสืบเอกชน — นักสืบภาคสนาม นักสืบไอที และทีมวิเคราะห์ข้อมูล ทำงานเป็นความลับ มืออาชีพ ทั่วราชอาณาจักร สมัครออนไลน์ได้ที่นี่",
  alternates: { canonical: "/careers", languages: { th: "/careers", en: "/en/careers" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/careers",
    title: "ร่วมงานกับเรา — สมัครเป็นนักสืบ | Detective Pulse",
    description: "เปิดรับสมัครทีมนักสืบเอกชนมืออาชีพ สมัครออนไลน์ได้ที่นี่",
    siteName: "Detective Pulse",
  },
};

const PERKS = [
  { Icon: ShieldCheck, title: "งานที่มีความหมาย", desc: "ช่วยลูกค้าหาความจริงและความยุติธรรม ในงานที่ต้องอาศัยความไว้วางใจสูง" },
  { Icon: GraduationCap, title: "เรียนรู้จากมืออาชีพ", desc: "ทำงานร่วมกับทีมที่มีประสบการณ์ พร้อมพัฒนาทักษะการสืบสวนอย่างเป็นระบบ" },
  { Icon: MapPin, title: "รับงานทั่วประเทศ", desc: "โอกาสลงพื้นที่จริงทั่วราชอาณาจักร ไม่จำเจอยู่ที่เดียว" },
  { Icon: Clock, title: "ยืดหยุ่นตามงาน", desc: "รูปแบบงานหลากหลาย ทั้งภาคสนามและงานวิเคราะห์ข้อมูลออนไลน์" },
];

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Recruitment · ร่วมงานกับเรา"
        title="ร่วมทีมนักสืบ Detective Pulse"
        sub="เรากำลังมองหาคนที่ละเอียด อดทน รักษาความลับ และกัดไม่ปล่อย — ถ้าคุณใช่ ส่งใบสมัครมาได้เลย"
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map((p) => (
          <div key={p.title} className="dp-reveal relative rounded-xl border border-border bg-card p-6">
            <CornerTicks />
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/40 bg-primary/5 text-primary">
              <p.Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-serif text-base font-bold">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-border bg-card/40 p-6 sm:p-10">
        <SectionHeading eyebrow="Application · ใบสมัคร" title="สมัครร่วมงาน" />
        <div className="mt-8">
          <CareersForm lang="th" />
        </div>
      </div>
    </div>
  );
}
