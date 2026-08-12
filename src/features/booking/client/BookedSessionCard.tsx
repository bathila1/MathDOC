"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyBooking } from "@/features/booking/server/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { safeExternalUrl } from "@/lib/shared/url";
import { MapPin, Video, X } from "lucide-react";

export interface BookedSession {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: "physical" | "online";
  status: string;
  isFollowUp: boolean;
  meetingLink: string | null;
}

/** The student's single live booking, with the option to cancel it. */
export function BookedSessionCard({
  session,
  showCancel = true,
}: {
  session: BookedSession;
  showCancel?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelMyBooking(session.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking cancelled. You can book a new time now.");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <span className="text-xs font-semibold uppercase">
              {format(new Date(session.startsAt), "MMM")}
            </span>
            <span className="font-heading text-xl leading-none font-bold">
              {format(new Date(session.startsAt), "d")}
            </span>
          </div>
          <div>
            <p className="font-semibold">
              {format(new Date(session.startsAt), "EEEE, h:mm a")} –{" "}
              {format(new Date(session.endsAt), "h:mm a")}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {session.mode === "online" ? (
                <Video className="size-3.5" />
              ) : (
                <MapPin className="size-3.5" />
              )}
              {session.mode === "online" ? "Online" : "In person"}
              {session.isFollowUp && " · Follow-up with Sir"}
            </p>
            {session.mode === "online" && safeExternalUrl(session.meetingLink) && (
              <a
                href={safeExternalUrl(session.meetingLink)!}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                Join the meeting
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.status === "pending_payment" ? (
            <Button
              size="sm"
              render={<Link href={`/student/book/payment/${session.id}`} />}
            >
              Complete payment
            </Button>
          ) : (
            <Badge variant="secondary">Confirmed</Badge>
          )}
          {showCancel && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
            >
              <X className="size-4" /> Cancel
            </Button>
          )}
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Cancel this booking?</DialogTitle>
              <DialogDescription>
                Your{" "}
                {format(new Date(session.startsAt), "EEEE d MMMM 'at' h:mm a")}{" "}
                session will be released and someone else can take the time.
                You can book a new one straight after.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Keep it
              </Button>
              <Button variant="destructive" disabled={pending} onClick={cancel}>
                {pending ? "Cancelling…" : "Yes, cancel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
