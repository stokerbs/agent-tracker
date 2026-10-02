import type { Metadata } from "next";
import { SampleReportView } from "@/components/marketing/sample-report-view";
import { SAMPLE_REPORT } from "@/lib/marketing/sample-report-data";

const r = SAMPLE_REPORT.th;

// Supporting page for the how-it-works pages (owner item C10): shown, linked,
// but kept out of the index — it is a template demonstration, not content.
export const metadata: Metadata = {
  title: r.title,
  description: r.notice,
  robots: { index: false, follow: true },
  alternates: { canonical: "/sample-report", languages: { th: "/sample-report", en: "/en/sample-report" } },
};

export default function SampleReportPage() {
  return <SampleReportView lang="th" />;
}
