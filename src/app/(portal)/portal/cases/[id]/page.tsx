import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { CaseStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeUp } from "@/components/shared/motion";
import { PortalMessagesClient } from "@/components/messages/portal-messages-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Case, CaseMessageWithSender, CaseStatus, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("cases").select("case_number").eq("id", id).single();
  return { title: data ? `Case ${data.case_number} · Portal` : "Case Detail" };
}

export default async function PortalCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const t = await getTranslations("portal");
  const tMsgs = await getTranslations("messages");
  const supabase = await createClient();

  // Resolve client identity
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!clientRow) notFound();

  // Fetch case — RLS + explicit ownership filter (defence-in-depth)
  const { data: caseRaw } = await supabase
    .from("cases")
    .select("id, case_number, case_type, status, start_date, end_date, description, client_id")
    .eq("id", id)
    .eq("client_id", clientRow.id)
    .maybeSingle();

  if (!caseRaw) notFound();

  const c = caseRaw as Pick<Case, "id" | "case_number" | "case_type" | "status" | "start_date" | "end_date" | "description" | "client_id">;

  // Fetch invoices + messages + last-seen in parallel
  const [{ data: invoicesRaw }, { data: messagesRaw }, { data: myView }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientRow.id)
      .eq("case_id", id)
      .neq("status", "draft")
      .order("issued_date", { ascending: false }),
    supabase
      .from("case_messages")
      .select("*, profiles(id, full_name, role)")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("case_message_views")
      .select("last_seen_at")
      .eq("case_id", id)
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);

  const invoices = (invoicesRaw ?? []) as Invoice[];
  const messages = (messagesRaw ?? []) as CaseMessageWithSender[];

  // Unread: staff messages the client hasn't seen yet
  const lastSeen = myView?.last_seen_at ? new Date(myView.last_seen_at) : null;
  const unreadCount = messages.filter(
    (m) => m.sender_id !== profile.id && (!lastSeen || new Date(m.created_at) > lastSeen),
  ).length;

  function fmtDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok",
    });
  }

  const isOpen = c.status !== "closed";

  return (
    <div className="space-y-6">
      <FadeUp>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/portal">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="font-mono text-sm font-bold text-primary">{c.case_number}</p>
            <p className="text-xs text-muted-foreground">{t("cases.caseDetail")}</p>
          </div>
        </div>
      </FadeUp>

      {/* Case summary card */}
      <FadeUp delay={0.04}>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{c.case_number}</p>
                {c.case_type && (
                  <p className="text-sm text-muted-foreground capitalize">
                    {c.case_type.replace(/_/g, " ")}
                  </p>
                )}
              </div>
              <CaseStatusBadge status={c.status as CaseStatus} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  {t("cases.startDate")}
                </p>
                <p>{fmtDate(c.start_date) ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  {t("cases.endDate")}
                </p>
                <p>{isOpen ? t("cases.ongoing") : (fmtDate(c.end_date) ?? "—")}</p>
              </div>
            </div>

            {c.description && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                {c.description}
              </p>
            )}
          </CardContent>
        </Card>
      </FadeUp>

      {/* Updates / messages */}
      <FadeUp delay={0.08}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {tMsgs("portal.title")}
            </h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <PortalMessagesClient
            caseId={id}
            messages={messages}
            currentProfileId={profile.id}
          />
        </div>
      </FadeUp>

      {/* Invoices */}
      <FadeUp delay={0.12}>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("tabs.invoices")}
          </h2>
          {invoices.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t("noInvoices")}
              description={t("noInvoicesDescription")}
            />
          ) : (
            invoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} canManage={false} />
            ))
          )}
        </div>
      </FadeUp>
    </div>
  );
}
