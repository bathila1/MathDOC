import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 10;

/** Parse a ?page= search param into a 1-based page number. */
export function pageFrom(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Supabase .range() bounds for a page. */
export function rangeFor(page: number, size = PAGE_SIZE): [number, number] {
  const from = (page - 1) * size;
  return [from, from + size - 1];
}

/**
 * Link-based pager (works without client JS). `basePath` keeps any other
 * query params the page needs.
 */
export function Pagination({
  page,
  total,
  basePath,
  size = PAGE_SIZE,
}: {
  page: number;
  total: number;
  basePath: string;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;

  const href = (p: number) =>
    `${basePath}${basePath.includes("?") ? "&" : "?"}page=${p}`;
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const shown = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);

  return (
    <nav
      className="flex items-center justify-between gap-2 pt-2"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          render={page > 1 ? <Link href={href(page - 1)} /> : undefined}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {shown.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === page ? "default" : "outline"}
            render={<Link href={href(p)} />}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages}
          render={page < pages ? <Link href={href(page + 1)} /> : undefined}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
