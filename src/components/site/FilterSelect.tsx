"use client";

import { useUrlParams } from "@/lib/client/use-url-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/** Dropdown filter bound to a URL query param. "all" clears the param. */
export function FilterSelect({
  paramName,
  options,
  allLabel = "All",
  className,
}: {
  paramName: string;
  options: SelectOption[];
  allLabel?: string;
  className?: string;
}) {
  const { sp, update } = useUrlParams();
  const value = sp.get(paramName) ?? "all";

  return (
    <Select
      value={value}
      onValueChange={(v) =>
        update({ [paramName]: !v || v === "all" ? null : v })
      }
    >
      <SelectTrigger className={cn("w-full sm:w-44", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
