import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { LinkProfileDialog } from "@/components/clients/link-profile-dialog";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeUp, StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { formatDate } from "@/lib/utils";
import type { Case, Client, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", id).single();
  return { title: data?.name ?? "Client" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentProfile = await requireRole(["admin", "supervisor"]);
  const isAdmin = currentProfile.role === "admin";
  const t = await getTranslations("clients.detail");
  const tCase = await getTranslations("cases");
  const supabase = await createClient();

  const [{ data: clientRaw }, { data: casesRaw }, { data: invoicesRaw }, { data: linkedProfileRows }, { data: clientProfileRows }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("cases")
        .select("id,case_number,case_type,status,priority,start_date,end_date,client_name")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("issued_date", { ascending: false }),
      // All profile_ids already linked to any client record (to exclude from picker)
      supabase.from("clients").select("profile_id").not("profile_id", "is", null),
      // All client-role profiles (candidates for linking)
      supabase.from("profiles").select("id, email, full_name").eq("role", "client").order("full_name"),
    ]);

  if (!clientRaw) notFound();

  const client = clientRaw as Client;
  const cases = (casesRaw ?? []) as Case[];
  const invoices = (invoicesRaw ?? []) as Invoice[];

  // Profiles available for linking: client-role accounts not already linked to any client record.
  const linkedIds = new Set(
    (linkedProfileRows ?? []).map((r) => r.profile_id).filter(Boolean) as string[],
  );
  const availableProfiles = (clientProfileRows ?? []).filter(
    (p) => !linkedIds.has(p.id),
  );

  const openCases = cases.filter((c) => c.status !== "closed").length;
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/clients">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
      </Button>

      <FadeUp>
        <PageHeader
          title={client.name}
          description={client.company ?? undefined}
        >
          <EditClientDialog client={client} />
        </PageHeader>
      </FadeUp>

      {/* Stats */}
      <FadeUp delay={0.05}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("stats.totalCases")}
            value={cases.length}
            icon={<Briefcase className="h-4 w-4" />}
            accentBar="primary"
          />
          <StatCard
            label={t("stats.openCases")}
            value={openCases}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <StatCard
            label={t("stats.totalInvoiced")}
            value={`฿${totalInvoiced.toLocaleString()}`}
            icon={<Banknote className="h-4 w-4" />}
          />
          <StatCard
            label={t("stats.outstanding")}
            value={`฿${outstanding.toLocaleString()}`}
            icon={<Banknote className="h-4 w-4" />}
            accentBar={outstanding > 0 ? "warning" : "success"}
          />
        </div>
      </FadeUp>

      <FadeUp delay={0.08}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" /> {t("contactInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`mailto:${client.email}`}
                    className="truncate text-primary hover:underline"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`tel:${client.phone}`}
                    className="text-primary hover:underline"
                  >
                    {client.phone}
                  </a>
                </div>
              )}
              {!client.email && !client.phone && (
                <p className="text-muted-foreground">—</p>
              )}
              {client.notes && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  {client.notes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portal access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {client.profile_id ? (
                  <ShieldCheck className="h-4 w-4 text-success" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                )}
                {t("portalAccess")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {client.profile_id ? t("portalActive") : t("portalNone")}
              </p>
              {client.profile_id && (
                <p className="mt-1 font-mono text-xs text-muted-foreground/60">
                  {client.profile_id}
                </p>
              )}
              <LinkProfileDialog
                clientId={client.id}
                isLinked={!!client.profile_id}
                availableProfiles={availableProfiles}
                isAdmin={isAdmin}
              />
            </CardContent>
          </Card>

          {/* Member since */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Since</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {new Date(client.created_at).toLocaleDateString("en-GB", {
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(client.created_at)}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeUp>

      {/* Cases + Invoices tabs */}
      <FadeUp delay={0.1}>
        <Tabs defaultValue="cases">
          <TabsList>
            <TabsTrigger value="cases">
              <Briefcase className="mr-1.5 h-4 w-4" />
              {t("tabs.cases")} ({cases.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Banknote className="mr-1.5 h-4 w-4" />
              {t("tabs.invoices")} ({invoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="mt-4">
            {cases.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title={t("noCases")}
                description=""
              />
            ) : (
              <StaggerGrid>
                {cases.map((c) => (
                  <StaggerItem key={c.id}>
                    <Link
                      href={`/cases/${c.id}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border hover:bg-accent/30"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-primary">
                          {c.case_number}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.case_type ?? "Surveillance"}
                          {c.start_date && ` · ${tCase("detail.infoLabels.start")}: ${formatDate(c.start_date)}`}
                          {c.end_date && ` · ${tCase("detail.infoLabels.end")}: ${formatDate(c.end_date)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CasePriorityBadge priority={c.priority} />
                        <CaseStatusBadge status={c.status} />
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4 space-y-3">
            {invoices.length === 0 ? (
              <EmptyState
                icon={<Banknote className="h-6 w-6" />}
                title={t("noInvoices")}
                description=""
              />
            ) : (
              invoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  client={client}
                  canManage
                  isAdmin={isAdmin}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </FadeUp>
    </div>
  );
}
