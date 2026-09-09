import type { ContentMaster } from "@/lib/studio/types";

/** The slice of a content master the calendar needs. */
export type CalendarItem = Pick<
  ContentMaster,
  "id" | "title" | "pillar" | "status" | "primary_platform" | "scheduled_at" | "published_at"
>;

export const CALENDAR_ITEM_COLUMNS = "id, title, pillar, status, primary_platform, scheduled_at, published_at";

/** Statuses that appear on the calendar when they carry a date. */
export const CALENDAR_STATUSES = ["approved", "scheduled", "published", "draft", "review"] as const;

/** Statuses a card can be dragged / rescheduled in. */
export const DRAGGABLE_STATUSES = ["approved", "scheduled"] as const;

export interface CalendarFilters {
  platform: string | null;
  status: string | null;
  pillars: string[];
}

/** Instant a calendar item is placed on: scheduled_at, else published_at. */
export function itemInstant(item: CalendarItem): string | null {
  return item.scheduled_at ?? item.published_at ?? null;
}
