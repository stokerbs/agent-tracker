import { Skeleton } from "@/components/ui/skeleton";

export default function ContentEditorLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <Skeleton className="h-8 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
