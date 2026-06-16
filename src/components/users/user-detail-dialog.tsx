"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BatteryCharging, BatteryLow, BatteryMedium,
  Briefcase, CheckCircle2, Circle, Clock, Mail,
  Phone, ShieldCheck, UserCircle, XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getUserDetails } from "@/app/(dashboard)/users/actions";
import { RoleSelect } from "@/components/users/role-select";
import { AgentStatusBadge } from "@/components/shared/status-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { batteryColor, cn, formatDate, initials, timeAgo } from "@/lib/utils";
import type { EnrichedUser } from "@/lib/types";

type UserDetails = Awaited<ReturnType<typeof getUserDetails>>;

interface Props {
  user: EnrichedUser | null;
  onClose: () => void;
}

export function UserDetailDialog({ user, onClose }: Props) {
  const t = useTranslations("users");
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!user) { setDetails(null); return; }
    const id = user.id;
    start(async () => {
      const d = await getUserDetails(id);
      setDetails(d);
    });
  }, [user]);

  if (!user) return null;

  const agent = details?.agent ?? null;
  const batteryLevel = agent?.battery_pct ?? 0;

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">{t("drawer.title")}</DialogTitle>
        </DialogHeader>

        {/* Identity header */}
        <div className="flex items-center gap-4 pb-2">
          <Avatar className="h-14 w-14">
            {user.avatar_url && <AvatarImage src={user.avatar_url} />}
            <AvatarFallback className="text-lg font-semibold">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.full_name ?? "—"}</p>
            {user.phone && (
              <p className="text-sm text-muted-foreground">{user.phone}</p>
            )}
            {user.agent_code && (
              <p className="font-mono text-xs font-bold tracking-wider text-primary">
                {user.agent_code}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Role */}
        <Row icon={<ShieldCheck className="h-4 w-4" />} label={t("table.role")}>
          <RoleSelect userId={user.id} role={user.role} />
        </Row>

        {/* Agent status */}
        {(user.agent_status || agent) && (
          <Row icon={<Circle className="h-4 w-4" />} label={t("drawer.onlineStatus")}>
            {agent ? (
              <AgentStatusBadge status={agent.status as any} />
            ) : user.agent_status ? (
              <AgentStatusBadge status={user.agent_status} />
            ) : null}
          </Row>
        )}

        {/* Contact */}
        {user.email && (
          <Row icon={<Mail className="h-4 w-4" />} label={t("table.email")}>
            <a href={`mailto:${user.email}`} className="text-primary hover:underline text-sm truncate">
              {user.email}
            </a>
          </Row>
        )}
        {user.phone && (
          <Row icon={<Phone className="h-4 w-4" />} label={t("table.phone")}>
            <span className="text-sm">{user.phone}</span>
          </Row>
        )}

        {/* OTP verified */}
        <Row icon={<CheckCircle2 className="h-4 w-4" />} label={t("table.otpVerified")}>
          {user.otp_verified ? (
            <Badge variant="default" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" /> {t("drawer.verified")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
              <XCircle className="h-3 w-3" /> {t("drawer.unverified")}
            </Badge>
          )}
        </Row>

        {/* Dates */}
        <Row icon={<UserCircle className="h-4 w-4" />} label={t("table.createdAt")}>
          <span className="text-sm">{formatDate(user.created_at)}</span>
        </Row>

        <Row icon={<Clock className="h-4 w-4" />} label={t("table.lastLogin")}>
          {pending ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <span className="text-sm">{timeAgo(details?.last_sign_in_at ?? null)}</span>
          )}
        </Row>

        {/* Cases count */}
        <Row icon={<Briefcase className="h-4 w-4" />} label={t("drawer.caseCount")}>
          {pending ? (
            <Skeleton className="h-4 w-10" />
          ) : (
            <span className="text-sm font-medium">{details?.caseCount ?? 0}</span>
          )}
        </Row>

        {/* Battery (agents only) */}
        {(user.role === "agent") && (
          <Row icon={<BatteryMedium className="h-4 w-4" />} label={t("drawer.battery")}>
            {pending ? (
              <Skeleton className="h-4 w-24" />
            ) : agent?.battery_pct != null ? (
              <div className="flex items-center gap-2">
                {batteryLevel <= 25 ? (
                  <BatteryLow className="h-4 w-4 text-destructive" />
                ) : (
                  <BatteryMedium className={cn("h-4 w-4", batteryColor(agent.battery_pct))} />
                )}
                <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      batteryLevel > 60 ? "bg-success" : batteryLevel > 25 ? "bg-warning" : "bg-destructive",
                    )}
                    style={{ width: `${batteryLevel}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{agent.battery_pct}%</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </Row>
        )}

        <Separator />

        {/* Account status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("table.status")}</span>
          <Badge variant={user.is_active ? "default" : "destructive"}>
            {user.is_active ? t("statusActive") : t("statusDisabled")}
          </Badge>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("drawer.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
