import type { UserRole } from "@/lib/types";

export interface NavItem {
  labelKey: string; // key under nav.items.*
  href: string;
  icon: string; // lucide icon name resolved in the sidebar
  roles: UserRole[];
}

export interface NavSection {
  sectionKey: string; // key under nav.sections.*
  items: NavItem[];
}

const ALL: UserRole[] = ["admin", "supervisor", "agent"];
const STAFF: UserRole[] = ["admin", "supervisor"];
const AGENT: UserRole[] = ["agent"];

export const NAV_SECTIONS: NavSection[] = [
  {
    sectionKey: "operations",
    items: [
      { labelKey: "dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: ALL },
      { labelKey: "field",      href: "/field",       icon: "Radio",      roles: ALL   },
      // Agents get the lightweight live tracker; staff use the richer /map (which
      // already plots GPS devices), so gps-monitor is hidden from staff to avoid
      // two near-identical map entries in their sidebar.
      { labelKey: "gpsMonitor", href: "/gps-monitor", icon: "Navigation",  roles: AGENT },
      { labelKey: "map",        href: "/map",          icon: "MapPin",      roles: STAFF },
      // Device list, GPS903 discovery/linking and credentials are consolidated
      // into the one tabbed /gps-devices page (was three separate entries).
      { labelKey: "gpsDevices",        href: "/gps-devices",         icon: "Satellite",  roles: STAFF },
      { labelKey: "analytics", href: "/analytics", icon: "BarChart2", roles: STAFF },
      { labelKey: "cases", href: "/cases", icon: "Briefcase", roles: ALL },
      { labelKey: "timeline", href: "/timeline", icon: "Clock", roles: ALL },
    ],
  },
  {
    sectionKey: "field",
    items: [
      { labelKey: "agents", href: "/agents", icon: "Users", roles: STAFF },
      { labelKey: "evidence", href: "/evidence", icon: "FolderLock", roles: ALL },
      { labelKey: "reports", href: "/reports", icon: "FileText", roles: STAFF },
      { labelKey: "expenses", href: "/expenses", icon: "Receipt", roles: ALL },
      { labelKey: "payroll", href: "/payroll", icon: "Wallet", roles: ALL },
      { labelKey: "emergency", href: "/emergency", icon: "Siren", roles: STAFF },
    ],
  },
  {
    sectionKey: "administration",
    items: [
      { labelKey: "leads", href: "/leads", icon: "Inbox", roles: ["admin"] },
      { labelKey: "recruitment", href: "/recruitment", icon: "UserPlus", roles: ["admin"] },
      { labelKey: "aiArticles", href: "/marketing-articles", icon: "Sparkles", roles: ["admin"] },
      { labelKey: "marketingInsights", href: "/marketing-insights", icon: "BarChart2", roles: ["admin"] },
      { labelKey: "clients", href: "/clients", icon: "Building2", roles: ["admin"] },
      { labelKey: "invoices", href: "/invoices", icon: "Banknote", roles: STAFF },
      { labelKey: "users", href: "/users", icon: "ShieldCheck", roles: ["admin"] },
      { labelKey: "audit", href: "/audit", icon: "ScrollText", roles: ["admin"] },
      { labelKey: "settings", href: "/settings", icon: "Settings", roles: ["admin"] },
    ],
  },
];

export function navForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => i.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
