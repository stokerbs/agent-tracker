import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Users,
  UserCheck,
  Radio,
  PowerOff,
  BatteryMedium,
  BatteryCharging,
  BatteryLow,
  MapPin,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getAgents } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { AgentRoleBadge, AgentStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { AgentSearch } from "@/components/agents/agent-search";
import { batteryColor, initials, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AGENT_ROLE_META } from "@/lib/constants";
import type { AgentRole } from "@/lib/types";

export const metadata: Metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

const ROLES: AgentRole[] = ["field_agent", "supervisor", "team_leader", "operations"];

function BatteryBar({ pct, charging }: { pct: number | null; charging: boolean | null }) {
  const level = pct ?? 0;
  const color =
    charging ? "bg-success" :
    level > 60 ? "bg-success" :
    level > 25 ? "bg-warning" :
    "bg-destructive";

  return (
    <div className="flex items-center gap-2">
      {charging
        ? <BatteryCharging className="h-3.5 w-3.5 text-success" />
        : level <= 25
        ? <BatteryLow className="h-3.5 w-3.5 text-destructive" />
        : <BatteryMedium className={cn("h-3.5 w-3.5", batteryColor(pct))} />
      }
      <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${level}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{pct ?? "—"}%</span>
    </div>
  );
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("agents");
  const { role: roleFilter, q } = await searchParams;

  const agents = await getAgents();

  const total = agents.length;
  const available = agents.filter((a) =>
    a.status === "online" || a.status === "moving" || a.status === "idle",
  ).length;
  const active = agents.filter((a) => a.status !== "offline").length;
  const offline = agents.filter((a) => a.status === "offline").length;

  const activeRole = ROLES.includes(roleFilter as AgentRole) ? (roleFilter as AgentRole) : null;
  const search = q?.toLowerCase().trim() ?? "";

  const filtered = agents.filter((a) => {
    if (activeRole && a.agent_role !== activeRole) return false;
    if (search && !`${a.full_name} ${a.nickname ?? ""} ${a.agent_code} ${a.area ?? ""}`.toLowerCase().includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <CreateAgentDialog />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("stats.total")} value={total} icon={<Users className="h-4 w-4" />} accentBar="primary" />
        <StatCard label={t("stats.available")} value={available} icon={<UserCheck className="h-4 w-4" />} accent="text-success" accentBar="success" />
        <StatCard label={t("stats.active")} value={active} icon={<Radio className="h-4 w-4" />} accent="text-primary" accentBar="primary" />
        <StatCard label={t("stats.offline")} value={offline} icon={<PowerOff className="h-4 w-4" />} accent="text-muted-foreground" />
      </div>

      {/* Search + role filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Suspense>
          <AgentSearch defaultValue={q ?? ""} />
        </Suspense>
        <Link
          href={search ? `/agents?q=${encodeURIComponent(search)}` : "/agents"}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !activeRole
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          All roles
        </Link>
        {ROLES.map((r) => {
          const href = search
            ? `/agents?role=${r}&q=${encodeURIComponent(search)}`
            : `/agents?role=${r}`;
          return (
            <Link
              key={r}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeRole === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {AGENT_ROLE_META[r].label}
              <span className="ml-1.5 font-mono text-[10px] opacity-60">
                {agents.filter((a) => a.agent_role === r).length}
              </span>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={search || activeRole ? "No agents match" : t("noTitle")}
          description={search || activeRole ? "Try a different search or role filter." : t("noDescription")}
        />
      ) : (
        <StaggerGrid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <StaggerItem key={a.id}>
              <Link href={`/agents/${a.id}`} className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
                {/* Avatar + status dot */}
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10 ring-2 ring-background">
                    {a.photo_url && <AvatarImage src={a.photo_url} />}
                    <AvatarFallback className="text-xs font-semibold">
                      {initials(a.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {a.status !== "offline" && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{a.full_name}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.agent_role && <AgentRoleBadge role={a.agent_role} />}
                      <AgentStatusBadge status={a.status} />
                    </div>
                  </div>

                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-primary/80">
                      {a.agent_code}
                    </span>
                    {a.nickname && (
                      <span className="text-[10px] text-muted-foreground">"{a.nickname}"</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {a.area && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5" />{a.area}
                      </span>
                    )}
                    {a.position && (
                      <span className="text-[10px] text-muted-foreground/70">{a.position}</span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <BatteryBar pct={a.battery_pct} charging={a.is_charging} />
                    <span className="text-[10px] text-muted-foreground/60">
                      {timeAgo(a.last_active)}
                    </span>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  );
}
