import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      {/* Back button + case header row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Target profile block */}
      <Skeleton className="h-32 w-full" />

      {/* Intel detail blocks (photos / vehicles / locations / documents) */}
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
