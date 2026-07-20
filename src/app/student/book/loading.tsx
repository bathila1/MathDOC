import { Skeleton } from "@/components/ui/skeleton";

export default function BookLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-1">
          <Skeleton className="size-8" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="size-8" />
        </div>
      </div>
      {/* calendar grid */}
      <div className="overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-8 gap-px bg-border/40">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-none" />
          ))}
          {Array.from({ length: 40 }).map((_, i) => (
            <Skeleton key={`c-${i}`} className="h-12 rounded-none opacity-60" />
          ))}
        </div>
      </div>
    </div>
  );
}
