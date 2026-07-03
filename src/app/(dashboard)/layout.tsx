import { requireProfile } from "@/lib/auth";
import { userHasPin } from "@/lib/security/pin-status";
import { createServiceClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GpsReporter } from "@/components/layout/gps-reporter";
import { NativeBootstrap } from "@/components/layout/native-bootstrap";
import { AppLockProvider } from "@/components/layout/app-lock";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  // Clients use the dedicated portal, not the staff dashboard.
  if (profile.role === "client") {
    const { redirect } = await import("next/navigation");
    redirect("/portal");
  }

  const hasPin = await userHasPin(profile.id);

  // Only field agents report GPS. Non-agent staff (admins/supervisors) have no
  // `agents` row, so GpsReporter's every-few-seconds POST /api/agents/location
  // just 404s and is discarded — while still prompting them for location
  // permission and burning invocations. Mount it only when the user is actually
  // a linked agent (service client: authoritative, RLS-independent existence check).
  const svc = createServiceClient();
  const { data: agentRow, error: agentLookupError } = await svc
    .from("agents")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (agentLookupError) {
    // Fail-safe: treat as non-agent (GpsReporter stays off) but log it — a
    // persistent failure here would silently suppress web GPS for real agents.
    console.warn(`[layout] agent linkage lookup failed for ${profile.id}:`, agentLookupError.message);
  }
  const isAgent = !!agentRow;

  return (
    <AppLockProvider hasPin={hasPin}>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card lg:flex lg:flex-col">
        <div className="sticky top-0 h-screen overflow-hidden">
          <SidebarNav role={profile.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header profile={profile} />
        <main className="flex-1 p-4 sm:p-6 lg:p-7">{children}</main>
        {isAgent && <GpsReporter />}
        <NativeBootstrap />
      </div>
    </div>
    </AppLockProvider>
  );
}
