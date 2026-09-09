import { requireRole } from "@/lib/auth";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Creative Studio shell. Admin-only in V1 (owner tool) — requireRole redirects
 * other roles to /dashboard. Every page inside re-checks in its server
 * actions; this gate is the UI-level guard.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"]);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="studio mx-auto w-full max-w-[1400px]">{children}</div>
    </TooltipProvider>
  );
}
