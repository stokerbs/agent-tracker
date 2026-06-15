import type { Metadata } from "next";
import { Users, UserCheck, Radio, PowerOff, BatteryMedium } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { isStaff } from "@/lib/auth";
import { getAgents } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { batteryColor, initials, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const profile = await requireProfile();
  const agents = await getAgents();

  const total = agents.length;
  const available = agents.filter((a) => a.status === "available").length;
  const active = agents.filter((a) => a.status !== "offline").length;
  const offline = agents.filter((a) => a.status === "offline").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Agent Management" description="Field roster and live status.">
        {isStaff(profile.role) && <CreateAgentDialog />}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Agents" value={total} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Available" value={available} icon={<UserCheck className="h-5 w-5" />} accent="text-emerald-500" />
        <StatCard label="Active" value={active} icon={<Radio className="h-5 w-5" />} accent="text-blue-500" />
        <StatCard label="Offline" value={offline} icon={<PowerOff className="h-5 w-5" />} accent="text-slate-400" />
      </div>

      <Card>
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No agents yet"
                description="Create your first field operative to start tracking operations."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {a.photo_url && <AvatarImage src={a.photo_url} />}
                          <AvatarFallback>{initials(a.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.agent_code}
                            {a.nickname ? ` · “${a.nickname}”` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.position ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{a.area ?? "—"}</TableCell>
                    <TableCell>
                      <AgentStatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>
                      <span className={`flex items-center gap-1 text-sm ${batteryColor(a.battery_pct)}`}>
                        <BatteryMedium className="h-4 w-4" />
                        {a.battery_pct ?? "—"}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(a.last_active)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
