import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Back link + case number header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Case summary card */}
      <Skeleton className="h-44" />

      {/* Updates / messages section */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-64" />
      </div>

      {/* Invoices section */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
