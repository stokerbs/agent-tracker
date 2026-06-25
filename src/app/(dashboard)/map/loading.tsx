import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Page header: title + description */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Map area: large map surface + side rail/controls */}
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        {/* Map surface */}
        <Skeleton className="h-[420px] w-full lg:h-[640px]" />

        {/* Side rail / controls */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
