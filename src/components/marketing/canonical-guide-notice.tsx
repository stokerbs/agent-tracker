import Link from "next/link";

/** Keeps useful older copy available while directing readers to the main page. */
export function CanonicalGuideNotice({ href, title, lang }: { href: string; title: string; lang: "th" | "en" | "zh" }) {
  const label = { th: "อ่านข้อมูลหน้าหลักในหัวข้อนี้", en: "Read the main guide on this topic", zh: "阅读此主题的主要指南" }[lang];
  return (
    <aside className="my-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <Link href={href} className="font-medium text-primary underline underline-offset-4">{title}</Link>
    </aside>
  );
}
