/**
 * Client Portal — data access model (R-2 documentation)
 * ======================================================
 * Clients may ONLY see:
 *   - cases    : cases.client_id → clients.profile_id = their own profile
 *   - reports  : status = 'approved' AND is_client_visible = true, scoped to
 *                their own cases (inherits case ownership, no direct client_id)
 *   - invoices : invoices.client_id → clients.profile_id = their own profile
 *
 * Clients CANNOT see (intentional, enforced by RLS with no client read policy):
 *   - evidence         — raw surveillance files, operational security
 *   - timeline_entries — internal agent log, may contain PII on tactics
 *   - gps_devices      — tracker IMEI/SIM, operational security
 *   - expenses         — internal cost records, not client-facing
 *   - emergency_alerts — SOS records, internal only
 *   - audit_logs       — admin read only, never client-facing
 *
 * Defence-in-depth: this file adds explicit .eq("client_id", clientRow.id)
 * filters on every query IN ADDITION TO the RLS policies. Never remove these
 * application-layer filters — if an RLS policy is misconfigured the filters
 * are the last line of defence before data leaks across client accounts.
 */

import type { Metadata } from "next";
import { AlertTriangle, Banknote, Briefcase, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceCard } from "@/components/invoices/invoice-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { FadeUp } from "@/components/shared/motion";
import { formatCurrency } from "@/lib/utils";
import type { Case, Invoice } from "@/lib/types";

export const metadata: Metadata = { title: "Client Portal" };
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const profile = await requireProfile();
  const t = await getTranslations("portal");
  const supabase = await createClient();

  // ── Step 1: resolve client identity ─────────────────────────────────────────
  // This is the anchor for all ownership filtering below.
  // If there is no clients row linked to this profile we show an empty state
  // rather than executing queries that RLS alone would need to scope.
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, name, company")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!clientRow) {
    // Profile is authenticated as 'client' role but has no clients row yet.
    // This can happen in the window between registration and admin linking.
    return (
      <div className="space-y-6">
        <FadeUp>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("welcome", { name: profile.full_name?.split(" ")[0] ?? "Client" })}
          </h1>
        </FadeUp>
        <FadeUp delay={0.04}>
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title={t("notLinked")}
            description={t("notLinkedDescription")}
          />
        </FadeUp>
      </div>
    );
  }

  // ── Step 2: fetch cases + invoices in parallel ───────────────────────────────
  // Both queries carry explicit ownership + visibility filters.
  // RLS enforces the same constraints — the app-layer filters are defence-in-depth.
  const [{ data: casesRaw }, { data: invoicesRaw }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, status")
      .eq("client_id", clientRow.id)        // ← explicit ownership filter
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientRow.id)        // ← explicit ownership filter
      .neq("status", "draft")              // ← F-4: mirror the RLS 'status != draft' gate
      .order("issued_date", { ascending: false }),
  ]);

  const cases    = (casesRaw    ?? []) as Pick<Case, "id" | "status">[];
  const invoices = (invoicesRaw ?? []) as Invoice[];

  // ── Stats ────────────────────────────────────────────────────────────────────
  const firstName   = profile.full_name?.split(" ")[0] ?? clientRow.name;
  const companyLine = clientRow.company ?? null;

  const openCases   = cases.filter((c) => c.status !== "closed").length;
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);
  const totalPaid   = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const overdueTotal    = overdueInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <FadeUp>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("welcome", { name: firstName })}
          </h1>
          {companyLine && (
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{companyLine}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </FadeUp>

      {/* Stat cards */}
      <FadeUp delay={0.04}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={t("stats.openCases")}
            value={openCases}
            icon={<Briefcase className="h-4 w-4" />}
            accentBar={openCases > 0 ? "primary" : undefined}
          />
          <StatCard
            label={t("stats.outstanding")}
            value={formatCurrency(outstanding)}
            icon={<Banknote className="h-4 w-4" />}
            accentBar={outstanding > 0 ? "warning" : undefined}
          />
          <StatCard
            label={t("stats.paid")}
            value={formatCurrency(totalPaid)}
            icon={<Banknote className="h-4 w-4" />}
            accentBar={totalPaid > 0 ? "success" : undefined}
          />
        </div>
      </FadeUp>

      {/* Overdue alert */}
      {overdueInvoices.length > 0 && (
        <FadeUp delay={0.07}>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t("overdueAlert", {
                count: overdueInvoices.length,
                total: formatCurrency(overdueTotal),
              })}
            </p>
          </div>
        </FadeUp>
      )}

      {/* Tabs */}
      <FadeUp delay={0.1}>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("tabs.invoices")}
          </h2>
          {invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
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
