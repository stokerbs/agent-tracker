import type { Metadata } from "next";
import { ShieldCheck, GraduationCap, MapPin, Clock } from "lucide-react";
import { SectionHeading, CornerTicks } from "@/components/marketing/ui";
import { CareersForm } from "@/components/marketing/careers-form";

export const metadata: Metadata = {
  title: "Careers — Join Our Investigators | Detective Pulse",
  description:
    "We're hiring private investigators — field investigators, cyber investigators and data analysts. Discreet, professional work nationwide across Thailand. Apply online.",
  alternates: { canonical: "/en/careers", languages: { en: "/en/careers", th: "/careers" } },
  openGraph: {
    type: "website",
    url: "https://detectivepulse.com/en/careers",
    title: "Careers — Join Our Investigators | Detective Pulse",
    description: "We're hiring professional private investigators. Apply online.",
    siteName: "Detective Pulse",
  },
};

const PERKS = [
  { Icon: ShieldCheck, title: "Meaningful work", desc: "Help clients find the truth and get justice — work built on a high degree of trust." },
  { Icon: GraduationCap, title: "Learn from pros", desc: "Work alongside an experienced team and build systematic investigative skills." },
  { Icon: MapPin, title: "Work nationwide", desc: "Real fieldwork across the whole country — never stuck in one place." },
  { Icon: Clock, title: "Flexible by case", desc: "Varied work, from field surveillance to online data analysis." },
];

export default function CareersPageEN() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading
        eyebrow="Recruitment · Join us"
        title="Join the Detective Pulse team"
        sub="We're looking for people who are meticulous, patient, discreet and relentless — if that's you, send us your application."
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
        <SectionHeading eyebrow="Application" title="Apply to join" />
        <div className="mt-8">
          <CareersForm lang="en" />
        </div>
      </div>
    </div>
  );
}
