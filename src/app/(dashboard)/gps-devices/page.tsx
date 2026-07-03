import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Satellite, ScanSearch, KeyRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { DevicesPanel } from "./devices-panel";
import { DiscoveryPanel } from "./discovery-panel";
import { CredentialsPanel } from "./credentials-panel";

export const metadata: Metadata = { title: "GPS Devices" };
export const dynamic = "force-dynamic";

type Tab = "devices" | "discovery" | "credentials";
const TABS: { key: Tab; icon: typeof Satellite }[] = [
  { key: "devices",     icon: Satellite  },
  { key: "discovery",   icon: ScanSearch },
  { key: "credentials", icon: KeyRound   },
];

interface Props {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}

/**
 * Consolidated GPS device management. Merges what used to be three separate
 * sidebar entries — the device list, GPS903 discovery/linking, and credentials
 * — into one page with tabs (deep-linkable via ?tab=). The old /gps903-discovery
 * and /gps903-credentials routes now redirect here.
 */
export default async function GpsDevicesPage({ searchParams }: Props) {
  await requireRole(["admin", "supervisor"]);
  const { tab: tabParam, filter } = await searchParams;
  const tab: Tab =
    tabParam === "discovery" || tabParam === "credentials" ? tabParam : "devices";
  const t = await getTranslations("gpsDevices");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/60">
        {TABS.map(({ key, icon: Icon }) => (
          <Link
            key={key}
            href={`/gps-devices?tab=${key}`}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </div>

      {tab === "devices" && <DevicesPanel />}
      {tab === "discovery" && <DiscoveryPanel filter={filter} />}
      {tab === "credentials" && <CredentialsPanel />}
    </div>
  );
}
