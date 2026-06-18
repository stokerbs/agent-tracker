"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";
import {
  grantDeviceAccess,
  revokeDeviceAccess,
} from "@/app/(dashboard)/gps-devices/actions";

interface ProfileEntry {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
}

interface Props {
  deviceId:   string;
  profiles:   ProfileEntry[];
  grantedIds: string[];
}

const ROLE_BADGE: Record<string, string> = {
  supervisor: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  agent:      "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const ROLE_LABEL: Record<string, string> = {
  supervisor: "Supervisor",
  agent:      "Field Agent",
};

export function DevicePermissionsPanel({ deviceId, profiles, grantedIds }: Props) {
  const [optimistic, update] = useOptimistic(
    new Set(grantedIds),
    (
      state: Set<string>,
      change: { action: "grant" | "revoke"; profileId: string },
    ) => {
      const next = new Set(state);
      if (change.action === "grant") next.add(change.profileId);
      else next.delete(change.profileId);
      return next;
    },
  );

  const [, startTransition] = useTransition();

  function handleToggle(profileId: string, currently: boolean) {
    startTransition(async () => {
      update({ action: currently ? "revoke" : "grant", profileId });
      const result = currently
        ? await revokeDeviceAccess(deviceId, profileId)
        : await grantDeviceAccess(deviceId, profileId);
      if (result.error) {
        toast.error(result.error);
        update({ action: currently ? "grant" : "revoke", profileId });
      }
    });
  }

  const supervisors = profiles.filter((p) => p.role === "supervisor");
  const agents      = profiles.filter((p) => p.role === "agent");
  const total       = profiles.length;
  const granted     = optimistic.size;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <User className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No users to grant access to.</p>
        <p className="text-xs text-muted-foreground/60">
          Create supervisor or agent accounts first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Select which users may view this GPS device on the Live Map and in device
          lists. Admins always have full access regardless of this setting.
        </p>
        <div className="shrink-0 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center">
          <p className="text-lg font-bold leading-none">{granted}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">of {total}</p>
        </div>
      </div>

      {supervisors.length > 0 && (
        <Section label="Supervisors" icon={<Shield className="h-3.5 w-3.5" />}>
          {supervisors.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              granted={optimistic.has(p.id)}
              onToggle={handleToggle}
            />
          ))}
        </Section>
      )}

      {agents.length > 0 && (
        <Section label="Field Agents" icon={<User className="h-3.5 w-3.5" />}>
          {agents.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              granted={optimistic.has(p.id)}
              onToggle={handleToggle}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ProfileRow({
  profile,
  granted,
  onToggle,
}: {
  profile: ProfileEntry;
  granted: boolean;
  onToggle: (id: string, currently: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        granted
          ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "border-border/60 bg-card hover:bg-accent/40",
      )}
    >
      <input
        type="checkbox"
        checked={granted}
        onChange={() => onToggle(profile.id, granted)}
        className="h-4 w-4 shrink-0 cursor-pointer rounded accent-emerald-500"
      />

      <Avatar className="h-8 w-8 shrink-0">
        {profile.avatar_url && (
          <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
        )}
        <AvatarFallback className="text-xs">
          {initials(profile.full_name ?? profile.email)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {profile.full_name ?? profile.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
      </div>

      {ROLE_BADGE[profile.role] && (
        <Badge
          className={cn(
            "shrink-0 border text-[9px] font-bold uppercase tracking-wider",
            ROLE_BADGE[profile.role],
          )}
        >
          {ROLE_LABEL[profile.role] ?? profile.role}
        </Badge>
      )}

      {granted && (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      )}
    </label>
  );
}
