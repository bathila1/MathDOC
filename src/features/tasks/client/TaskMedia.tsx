"use client";

import { toEmbedSrc } from "@/lib/shared/embeds";
import type { MediaType } from "@/lib/shared/types";
import { Mic } from "lucide-react";

/**
 * Renders a task's media for the student: an image-as-question, a YouTube /
 * Facebook embed, an uploaded video, or a WhatsApp-style voice-note bubble.
 */
export function TaskMedia({
  mediaType,
  mediaUrl,
  mediaFileUrl,
  questionImageUrl,
}: {
  mediaType: MediaType | null;
  mediaUrl: string | null; // original link for youtube/facebook
  mediaFileUrl: string | null; // presigned url for uploaded video / voice
  questionImageUrl: string | null;
}) {
  const embedSrc =
    (mediaType === "youtube" || mediaType === "facebook") && mediaUrl
      ? toEmbedSrc(mediaType, mediaUrl)
      : null;

  const hasAny =
    questionImageUrl ||
    embedSrc ||
    (mediaType === "video" && mediaFileUrl) ||
    (mediaType === "voice" && mediaFileUrl) ||
    ((mediaType === "youtube" || mediaType === "facebook") && mediaUrl);

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

      {embedSrc && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={embedSrc}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Task video"
          />
        </div>
      )}

      {/* Link fallback when a pasted URL can't be embedded */}
      {!embedSrc &&
        (mediaType === "youtube" || mediaType === "facebook") &&
        mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Open the video
          </a>
        )}

      {mediaType === "video" && mediaFileUrl && (
        <video controls src={mediaFileUrl} className="w-full rounded-lg border" />
      )}

      {mediaType === "voice" && mediaFileUrl && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">Voice note from Sir</p>
            <audio controls src={mediaFileUrl} className="mt-1 h-9 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
