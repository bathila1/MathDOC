import { Skeleton } from "@/components/ui/skeleton";

export default function StudentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-56" />
      </div>
      {/* journey rail */}
      <div className="rounded-xl border p-6">
        <div className="flex items-center justify-between px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="size-10 rounded-full" />
          ))}
        </div>
        <Skeleton className="mx-auto mt-4 h-3 w-40" />
      </div>
      {/* task box */}
      <div className="space-y-3 rounded-xl border p-6">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
