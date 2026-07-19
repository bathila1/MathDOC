"use client";

import { useTransition } from "react";
import { assignCategory } from "@/features/students/server/actions";
import { STUDENT_CATEGORIES } from "@/lib/shared/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function CategorySelect({
  studentId,
  value,
}: {
  studentId: string;
  value: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value ?? ""}
      disabled={pending}
      onValueChange={(category) =>
        startTransition(async () => {
          if (!category) return;
          const res = await assignCategory({ student_id: studentId, category });
          if (!res.ok) toast.error(res.error);
          else toast.success("Category saved.");
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Not set" />
      </SelectTrigger>
      <SelectContent>
        {STUDENT_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
