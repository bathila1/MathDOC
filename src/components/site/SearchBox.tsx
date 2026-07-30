"use client";

import { useEffect, useState } from "react";
import { useUrlParams } from "@/lib/client/use-url-params";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

/** Debounced search input that writes to a URL query param. */
export function SearchBox({
  paramName = "q",
  placeholder = "Search…",
}: {
  paramName?: string;
  placeholder?: string;
}) {
  const { sp, update } = useUrlParams();
  const [value, setValue] = useState(sp.get(paramName) ?? "");

  useEffect(() => {
    const current = sp.get(paramName) ?? "";
    if (value === current) return;
    const id = setTimeout(() => update({ [paramName]: value.trim() || null }), 350);
    return () => clearTimeout(id);
  }, [value, sp, paramName, update]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}
