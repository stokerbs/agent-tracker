import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      {/* Header hidden on mobile (mirrors page layout) */}
      <div className="hidden space-y-2 md:block">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Monitor: map surface + device list rail */}
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        {/* Map surface */}
        <Skeleton className="h-[440px] w-full lg:h-[620px]" />

        {/* Device list */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
