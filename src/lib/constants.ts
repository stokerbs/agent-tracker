import type {
  AgentStatus,
  CasePriority,
  CaseStatus,
  UserRole,
} from "./types";

// ----------------------------------------------------------------------------
// Display metadata for enums — labels + badge color classes (Tailwind tokens)
// ----------------------------------------------------------------------------

export const AGENT_STATUS_META: Record<
  AgentStatus,
  { label: string; dot: string; badge: string }
> = {
  available: {
    label: "Available",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  on_mission: {
    label: "On Mission",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  traveling: {
    label: "Traveling",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  break: {
    label: "Break",
    dot: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    badge: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  },
};

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; badge: string }
> = {
  new: { label: "New", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  assigned: {
    label: "Assigned",
    badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
  active: {
    label: "Active",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    label: "Pending",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  closed: {
    label: "Closed",
    badge: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  },
};

export const CASE_PRIORITY_META: Record<
  CasePriority,
  { label: string; badge: string }
> = {
  low: {
    label: "Low",
    badge: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  },
  medium: {
    label: "Medium",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  high: {
    label: "High",
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  critical: {
    label: "Critical",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

export const ROLE_META: Record<UserRole, { label: string; badge: string }> = {
  admin: {
    label: "Administrator",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  supervisor: {
    label: "Supervisor",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  agent: {
    label: "Field Agent",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  client: {
    label: "Client",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
};

// Default map center (Bangkok) when no agents have coordinates.
export const DEFAULT_MAP_CENTER = { lat: 13.7563, lng: 100.5018 };

// GPS auto-refresh interval (ms) — spec: every 60 seconds.
export const GPS_REFRESH_MS = 60_000;

// Storage bucket names (mirror migration 0004).
export const BUCKETS = {
  avatars: "avatars",
  evidence: "evidence",
  receipts: "receipts",
  reports: "reports",
} as const;
