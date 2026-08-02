import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Tag } from "lucide-react";
import type { AirTagTrackerSummary } from "@/app/(dashboard)/air-tags/actions";

/**
 * Compact row for one AirTag tracker on the case detail page's AirTags
 * section — mirrors GpsDeviceCard's information density, but read-only
 * (management actions live on the tracker's own detail page).
 */
export function AirTagTrackerCard({ tracker }: { tracker: AirTagTrackerSummary }) {
  const t = useTranslations("airTags.caseSection");

  return (
    <Link
      href={`/air-tags/${tracker.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3.5 transition-colors hover:bg-muted/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30">
          <Tag className="h-4 w-4 text-sky-500" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{tracker.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {tracker.apple_serial ? tracker.apple_serial : t("noSerial")}
          </p>
        </div>
      </div>
      <span className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground">
        {t("view")} <ChevronRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
