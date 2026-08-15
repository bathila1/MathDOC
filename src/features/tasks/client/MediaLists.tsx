"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, type LucideIcon } from "lucide-react";

/**
 * Repeatable media inputs, shared by the task form (appointment page) and the
 * default-task template form so the two stay identical.
 */

/** Repeatable external-link input: type a URL, press Add, remove any row. */
export function LinkList({
  icon: Icon,
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
}: {
  icon: LucideIcon;
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="size-4" /> {label}
      </Label>
      {values.map((v, i) => (
        <div
          key={`${v}-${i}`}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
        >
          <span className="truncate">{v}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            aria-label={`Remove ${v}`}
            onClick={() => onRemove(i)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the link instead of submitting the whole dialog.
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={commit}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}

/** Repeatable upload list: pick one or many files, remove any row. */
export function FileList({
  icon: Icon,
  label,
  accept,
  addLabel,
  uploading,
  values,
  onPick,
  onRemove,
}: {
  icon: LucideIcon;
  label: string;
  accept: string;
  addLabel: string;
  uploading: boolean;
  values: string[];
  onPick: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="size-4" /> {label}
      </Label>
      {values.map((key, i) => (
        <div
          key={key}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
        >
          {/* Keys are purpose/userId/random-name — show the readable tail. */}
          <span className="truncate">{key.split("/").pop()}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            aria-label={`Remove file ${i + 1}`}
            onClick={() => onRemove(i)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => ref.current?.click()}
      >
        <Icon className="size-4" />
        {uploading ? "Uploading…" : addLabel}
      </Button>
    </div>
  );
}
