import { requireProfile } from "@/lib/auth";
import { SidebarNav } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GpsReporter } from "@/components/layout/gps-reporter";

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

  return (
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
        <GpsReporter />
      </div>
    </div>
  );
}
