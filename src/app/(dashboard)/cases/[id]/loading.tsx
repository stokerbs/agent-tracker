import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Back link */}
      <Skeleton className="h-8 w-28" />

      {/* Page header: title + badge/action row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Assigned team card */}
      <Skeleton className="h-20 w-full" />

      {/* Intelligence overview cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>

      {/* Collapsible detail blocks (target intel, GPS, finance) */}
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />

      {/* Tabbed section (timeline / evidence / messages) */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
