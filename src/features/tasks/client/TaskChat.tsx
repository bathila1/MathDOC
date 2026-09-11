"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createSupabaseBrowser } from "@/lib/client/supabase";
import { sendTaskMessage } from "@/features/tasks/server/chat-actions";
import { uploadFile } from "@/lib/client/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { formatSchool as format } from "@/lib/shared/time";
import type { TaskMessage } from "@/lib/shared/types";

/**
 * Task-scoped chat. Loads history for the task (RLS-scoped), then listens for
 * new messages over Supabase Realtime. Supports an optional image per message.
 */
export function TaskChat({
  taskId,
  currentUserId,
}: {
  taskId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [text, setText] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [zoom, setZoom] = useState<string | null>(null);
  const [supabase] = useState(() => createSupabaseBrowser());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function add(msg: TaskMessage) {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
    );
  }

  useEffect(() => {
    let active = true;

    supabase
      .from("task_messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (active && data) setMessages(data as TaskMessage[]);
      });

    const channel = supabase
      .channel(`task-messages-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_messages",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const msg = payload.new as TaskMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [taskId, supabase]);

  useEffect(() => {
    // Scroll the chat box itself to the latest message — NOT the page (which
    // would yank the student down to the chat on load instead of showing the
    // progress bar and their current task first).
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "chat_image");
      setImageKey(uploaded.key);
      setImagePreview(URL.createObjectURL(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageKey(null);
    setImagePreview(null);
  }

  function send() {
    const body = text.trim();
    if (!body && !imageKey) return;
    startTransition(async () => {
      const res = await sendTaskMessage({ task_id: taskId, body, image_key: imageKey });
      if (!res.ok) {
        toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
        return;
      }
      add(res.data);
      setText("");
      clearImage();
    });
  }

  return (
    <>
    <div className="rounded-lg border">
      <div ref={scrollRef} className="h-72 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages yet. Ask Sir anything about this task.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-semibold opacity-70">
                      {m.sender_role === "admin" ? "Sir" : "Student"}
                    </p>
                  )}
                  {m.image_key && (
                    <button
                      type="button"
                      className="mb-1 block"
                      onClick={() => setZoom(`/api/chat-image/${m.id}`)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/chat-image/${m.id}`}
                        alt="Shared"
                        className="max-h-56 cursor-zoom-in rounded-lg"
                      />
                    </button>
                  )}
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  <p
                    className={cn(
                      "mt-0.5 text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {format(new Date(m.created_at), "d MMM, h:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-2">
        {imagePreview && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="To send" className="size-12 rounded object-cover" />
            <Button variant="ghost" size="sm" onClick={clearImage}>
              <X className="size-4" /> Remove
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onImage}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            aria-label="Attach an image"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </Button>
          <Input
            value={text}
            placeholder="Type a message…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={pending || uploading || (!text.trim() && !imageKey)}
            onClick={send}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-label="Expanded image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt="Shared"
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
