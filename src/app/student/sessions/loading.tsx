import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}
