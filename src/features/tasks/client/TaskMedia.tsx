"use client";

import { toEmbedSrc } from "@/lib/shared/embeds";
import { safeExternalUrl } from "@/lib/shared/url";
import { Mic } from "lucide-react";

export interface TaskMediaProps {
  youtubeUrls: string[];
  facebookUrls: string[];
  videoUrls: string[]; // presigned urls for uploaded videos
  voiceUrls: string[]; // presigned urls for voice notes
  questionImageUrls: string[];
}

/**
 * Renders all of a task's media for the student: images-as-questions, YouTube
 * and Facebook embeds, uploaded videos, and WhatsApp-style voice notes — any
 * number of each (migration 018 made every media field a list).
 */
export function TaskMedia({
  youtubeUrls,
  facebookUrls,
  videoUrls,
  voiceUrls,
  questionImageUrls,
}: TaskMediaProps) {
  // Never trust a stored link: rows written before scheme validation existed
  // (or by any future path that skips the schema) must not reach an href.
  const safeYoutube = youtubeUrls
    .map((u) => safeExternalUrl(u))
    .filter((u): u is string => u !== null);
  const safeFacebook = facebookUrls
    .map((u) => safeExternalUrl(u))
    .filter((u): u is string => u !== null);

  const hasAny =
    questionImageUrls.length > 0 ||
    safeYoutube.length > 0 ||
    safeFacebook.length > 0 ||
    videoUrls.length > 0 ||
    voiceUrls.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {questionImageUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {questionImageUrls.length === 1 ? "Question" : "Questions"}
          </p>
          {questionImageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Question ${i + 1}`}
              className="max-h-[70vh] w-full rounded-lg border object-contain"
            />
          ))}
        </div>
      )}

      {safeYoutube.map((url) => {
        const src = toEmbedSrc("youtube", url);
        return src ? (
          <div
            key={url}
            className="aspect-video w-full overflow-hidden rounded-lg border"
          >
            <iframe
              src={src}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        ) : (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-medium text-primary underline underline-offset-4"
          >
            Open the YouTube video
          </a>
        );
      })}

      {safeFacebook.map((url) => {
        const src = toEmbedSrc("facebook", url);
        return src ? (
          <div
            key={url}
            className="aspect-video w-full overflow-hidden rounded-lg border"
          >
            <iframe
              src={src}
              className="h-full w-full"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              title="Facebook video"
            />
          </div>
        ) : (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-medium text-primary underline underline-offset-4"
          >
            Open the Facebook video
          </a>
        );
      })}

      {videoUrls.map((url) => (
        <video
          key={url}
          controls
          src={url}
          className="w-full rounded-lg border"
        />
      ))}

      {voiceUrls.map((url, i) => (
        <div
          key={url}
          className="flex items-center gap-3 rounded-xl bg-primary/10 p-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">
              Voice note from Sir
              {voiceUrls.length > 1 ? ` (${i + 1}/${voiceUrls.length})` : ""}
            </p>
            <audio controls src={url} className="mt-1 h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
