import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { CONTENT_STATUSES, PILLARS, PLATFORMS } from "@/lib/studio/constants";
import { bangkokDateKey } from "@/lib/utils";
import { CalendarBoard } from "./calendar-board";
import { isDayKey, type CalendarView } from "./date-utils";
import { getCalendarData } from "./queries";
import type { CalendarFilters } from "./types";

export const metadata: Metadata = { title: "ปฏิทินคอนเทนต์ · Creative Studio" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ view?: string; date?: string; platform?: string; status?: string; pillar?: string }>;
}

export default async function StudioCalendarPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;

  const todayKey = bangkokDateKey();
  const view: CalendarView = sp.view === "week" ? "week" : "month";
  const dateKey = isDayKey(sp.date) ? sp.date : todayKey;
  const filters: CalendarFilters = {
    platform: sp.platform && (PLATFORMS as string[]).includes(sp.platform) ? sp.platform : null,
    status: sp.status && (CONTENT_STATUSES as string[]).includes(sp.status) ? sp.status : null,
    pillars: (sp.pillar ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter((p) => (PILLARS as string[]).includes(p)),
  };

  const { items, unscheduled } = await getCalendarData(view, dateKey, filters);

  return (
    <CalendarBoard
      view={view}
      dateKey={dateKey}
      todayKey={todayKey}
      items={items}
      unscheduled={unscheduled}
      filters={filters}
    />
  );
}
