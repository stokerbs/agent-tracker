import { Skeleton } from "@/components/ui/skeleton";

export default function StudioCalendarLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="ml-auto h-8 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex items-start gap-4">
        <div className="hidden flex-1 overflow-hidden rounded-xl border border-border/60 md:block">
          <Skeleton className="h-8 w-full rounded-none" />
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[7.5rem] border-b border-r border-border/60 p-1.5">
                <Skeleton className="h-5 w-5 rounded-full" />
                {i % 3 === 0 && <Skeleton className="mt-2 h-10 w-full" />}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-2 md:hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="hidden h-96 w-72 shrink-0 rounded-xl lg:block" />
      </div>
    </div>
  );
}
