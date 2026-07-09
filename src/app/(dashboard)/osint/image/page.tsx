import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { OsintAnalyzer, type CaseOption } from "@/components/osint/osint-analyzer";

export const metadata: Metadata = { title: "OSINT Image Intelligence" };
export const dynamic = "force-dynamic";

export default async function OsintImagePage() {
  // Staff only — the analyzer downloads external URLs and calls the AI.
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("osint");

  // Cases the caller can access (RLS-scoped) for the optional attach/link.
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("id, case_number, target_name, case_type")
    .order("created_at", { ascending: false })
    .limit(200);

  const cases: CaseOption[] = (data ?? []).map((c) => ({
    id: c.id as string,
    label: [c.case_number, c.target_name || c.case_type].filter(Boolean).join(" · "),
  }));

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <OsintAnalyzer cases={cases} />
    </div>
  );
}
