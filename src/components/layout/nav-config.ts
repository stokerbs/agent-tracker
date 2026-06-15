import type { UserRole } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name resolved in the sidebar
  roles: UserRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: UserRole[] = ["admin", "supervisor", "agent"];
const STAFF: UserRole[] = ["admin", "supervisor"];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: ALL },
      { label: "Live Map", href: "/map", icon: "MapPin", roles: ALL },
      { label: "Cases", href: "/cases", icon: "Briefcase", roles: ALL },
      { label: "Timeline", href: "/timeline", icon: "Clock", roles: ALL },
    ],
  },
  {
    title: "Field",
    items: [
      { label: "Agents", href: "/agents", icon: "Users", roles: ALL },
      { label: "Evidence", href: "/evidence", icon: "FolderLock", roles: ALL },
      { label: "Reports", href: "/reports", icon: "FileText", roles: ALL },
      { label: "Expenses", href: "/expenses", icon: "Receipt", roles: ALL },
      { label: "Emergency", href: "/emergency", icon: "Siren", roles: ALL },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Clients", href: "/clients", icon: "Building2", roles: STAFF },
      { label: "Users", href: "/users", icon: "ShieldCheck", roles: ["admin"] },
      { label: "Audit Log", href: "/audit", icon: "ScrollText", roles: ["admin"] },
      { label: "Settings", href: "/settings", icon: "Settings", roles: ["admin"] },
    ],
  },
];

export function navForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => i.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
