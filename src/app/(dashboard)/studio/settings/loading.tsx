import { Skeleton } from "@/components/ui/skeleton";

export default function StudioSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-2 h-3 w-80 max-w-full" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
