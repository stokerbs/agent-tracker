"use client";

import {
  BarChart2,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Navigation,
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
  Satellite,
  ScanSearch,
  Inbox,
  UserPlus,
  Sparkles,
  Contact,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  BarChart2,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Briefcase,
  Clock,
  Navigation,
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
  Satellite,
  ScanSearch,
  Inbox,
  UserPlus,
  Sparkles,
  Contact,
} as const;

export type IconName = keyof typeof ICONS;

export function NavIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name as IconName] ?? LayoutDashboard;
  return <Cmp {...props} />;
}
