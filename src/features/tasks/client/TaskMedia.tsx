"use client";

import { toEmbedSrc } from "@/lib/shared/embeds";
import { safeExternalUrl } from "@/lib/shared/url";
import { Mic } from "lucide-react";

export interface TaskMediaProps {
  youtubeUrl: string | null;
  facebookUrl: string | null;
  videoUrl: string | null; // presigned url for an uploaded video
  voiceUrl: string | null; // presigned url for a voice note
  questionImageUrl: string | null;
}

/**
 * Renders all of a task's media for the student: an image-as-question, a
 * YouTube and/or Facebook embed, an uploaded video, and a WhatsApp-style
 * voice-note bubble — any combination.
 */
export function TaskMedia({
  youtubeUrl,
  facebookUrl,
  videoUrl,
  voiceUrl,
  questionImageUrl,
}: TaskMediaProps) {
  // Never trust a stored link: rows written before scheme validation existed
  // (or by any future path that skips the schema) must not reach an href.
  const safeYoutube = safeExternalUrl(youtubeUrl);
  const safeFacebook = safeExternalUrl(facebookUrl);

  const ytSrc = safeYoutube ? toEmbedSrc("youtube", safeYoutube) : null;
  const fbSrc = safeFacebook ? toEmbedSrc("facebook", safeFacebook) : null;

  const hasAny =
    questionImageUrl || safeYoutube || safeFacebook || videoUrl || voiceUrl;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {questionImageUrl && (
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Question
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={questionImageUrl}
            alt="Question"
            className="max-h-[70vh] w-full rounded-lg border object-contain"
          />
        </div>
      )}

      {ytSrc && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={ytSrc}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      )}
      {!ytSrc && safeYoutube && (
        <a
          href={safeYoutube}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Open the YouTube video
        </a>
      )}

      {fbSrc && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={fbSrc}
            className="h-full w-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            title="Facebook video"
          />
        </div>
      )}
      {!fbSrc && safeFacebook && (
        <a
          href={safeFacebook}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Open the Facebook video
        </a>
      )}

      {videoUrl && (
        <video controls src={videoUrl} className="w-full rounded-lg border" />
      )}

      {voiceUrl && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">Voice note from Sir</p>
            <audio controls src={voiceUrl} className="mt-1 h-9 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
