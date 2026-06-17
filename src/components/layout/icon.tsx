"use client";

import {
  BarChart2,
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Radio,
  Users,
  FolderLock,
  FileText,
  Receipt,
  Siren,
  Building2,
  ShieldCheck,
  ScrollText,
  Settings,
  Banknote,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  BarChart2,
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Radio,
  Users,
  FolderLock,
  FileText,
  Receipt,
  Siren,
  Building2,
  ShieldCheck,
  ScrollText,
  Settings,
  Banknote,
} as const;

export type IconName = keyof typeof ICONS;

export function NavIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name as IconName] ?? LayoutDashboard;
  return <Cmp {...props} />;
}
