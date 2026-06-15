"use client";

import {
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Users,
  FolderLock,
  FileText,
  Receipt,
  Siren,
  Building2,
  ShieldCheck,
  ScrollText,
  Settings,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Users,
  FolderLock,
  FileText,
  Receipt,
  Siren,
  Building2,
  ShieldCheck,
  ScrollText,
  Settings,
} as const;

export type IconName = keyof typeof ICONS;

export function NavIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name as IconName] ?? LayoutDashboard;
  return <Cmp {...props} />;
}
