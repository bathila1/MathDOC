"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSiteContent } from "@/features/settings/server/actions";
import { uploadFile } from "@/lib/client/upload";
import {
  SOCIAL_FIELDS,
  type SiteContent,
} from "@/lib/shared/site-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

/**
 * Admin editor for the public landing page: hero heading, hero photo, and the
 * footer's social links. Everything lives in the key/value `settings` table.
 */
export function SiteContentSettings({
  initial,
  initialHeroUrl,
}: {
  initial: SiteContent;
  /** Presigned preview of the current custom hero image, if any. */
  initialHeroUrl: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SiteContent>(initial);
  const [heroUrl, setHeroUrl] = useState<string | null>(initialHeroUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file, "question_image");
      set("heroImageKey", up.key);
      setHeroUrl(URL.createObjectURL(file)); // instant local preview
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setErrors({});
    startTransition(async () => {
      const res = await saveSiteContent(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      router.refresh();
      toast.success("Home page updated.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="hero-heading">Hero heading</Label>
        <Input
          id="hero-heading"
          value={values.heroHeading}
          onChange={(e) => set("heroHeading", e.target.value)}
        />
        {errors.heroHeading && (
          <p className="text-sm text-destructive">{errors.heroHeading}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Hero photo</Label>
        <div className="flex items-center gap-3">
          {heroUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroUrl}
                alt="Hero"
                className="size-24 rounded-lg border object-cover"
              />
              <button
                type="button"
                aria-label="Remove hero photo"
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white"
                onClick={() => {
                  set("heroImageKey", null);
                  setHeroUrl(null);
                }}
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <div className="flex size-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Using /sir.jpg
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickImage}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || pending}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {uploading ? "Uploading…" : "Choose photo"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Social links (footer)</p>
        {SOCIAL_FIELDS.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name} className="text-xs text-muted-foreground">
              {f.label}
            </Label>
            <Input
              id={f.name}
              placeholder="https://…"
              value={(values[f.name] as string | null) ?? ""}
              onChange={(e) => set(f.name, e.target.value || null)}
            />
            {errors[f.name] && (
              <p className="text-sm text-destructive">{errors[f.name]}</p>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Leave a field empty to hide that icon. Links must start with http://
          or https://
        </p>
      </div>

      <Button disabled={pending || uploading} onClick={save}>
        {pending ? "Saving…" : "Save home page"}
      </Button>
    </div>
  );
}
