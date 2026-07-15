import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ContactAnalyzer, type CaseOption } from "@/components/contact/contact-analyzer";

export const metadata: Metadata = { title: "Contact Intelligence" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("osintContact");

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
      <ContactAnalyzer cases={cases} />
    </div>
  );
}
