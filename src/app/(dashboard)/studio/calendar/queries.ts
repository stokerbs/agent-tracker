import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rangeForView, type CalendarView, type DayKey } from "./date-utils";
import { CALENDAR_ITEM_COLUMNS, CALENDAR_STATUSES, type CalendarFilters, type CalendarItem } from "./types";

export interface CalendarData {
  items: CalendarItem[];
  unscheduled: CalendarItem[];
}

/**
 * Masters visible in the current view range plus the approved-but-unscheduled
 * backlog. Placement rule: `scheduled_at` when set, otherwise `published_at`
 * (published pieces that were never scheduled still show on the day they went
 * out). Each query degrades to an empty list on failure so the page renders.
 */
export async function getCalendarData(view: CalendarView, dateKey: DayKey, filters: CalendarFilters): Promise<CalendarData> {
  const sb = await createClient();
  const { start, end } = rangeForView(view, dateKey);

  let inRange = sb
    .from("studio_content_masters")
    .select(CALENDAR_ITEM_COLUMNS)
    .or(`and(scheduled_at.gte.${start},scheduled_at.lt.${end}),and(scheduled_at.is.null,published_at.gte.${start},published_at.lt.${end})`)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(500);
  inRange = filters.status ? inRange.eq("status", filters.status) : inRange.in("status", [...CALENDAR_STATUSES]);
  if (filters.platform) inRange = inRange.eq("primary_platform", filters.platform);
  if (filters.pillars.length) inRange = inRange.in("pillar", filters.pillars);

  const backlog = sb
    .from("studio_content_masters")
    .select(CALENDAR_ITEM_COLUMNS)
    .eq("status", "approved")
    .is("scheduled_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const [rangeRes, backlogRes] = await Promise.all([inRange, backlog]);
  if (rangeRes.error) console.warn("[studio:calendar] range query failed:", rangeRes.error.message);
  if (backlogRes.error) console.warn("[studio:calendar] unscheduled query failed:", backlogRes.error.message);

  return {
    items: (rangeRes.data ?? []) as CalendarItem[],
    unscheduled: (backlogRes.data ?? []) as CalendarItem[],
  };
}
