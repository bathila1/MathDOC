import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}
