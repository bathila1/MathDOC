"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bypassPayment } from "@/features/booking/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CreditCard, Lock } from "lucide-react";

/**
 * Payment UI mock — the real gateway will be linked later.
 * The "Skip payment" button confirms the booking in the meantime.
 */
export function PaymentPanel({
  appointmentId,
  amount,
}: {
  appointmentId: string;
  amount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });

  function skip() {
    startTransition(async () => {
      const res = await bypassPayment(appointmentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`/student/book/confirmed/${appointmentId}`);
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5" /> Payment
        </CardTitle>
        <CardDescription>
          Session fee:{" "}
          <span className="font-semibold text-foreground">
            Rs. {amount.toLocaleString()}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="card-number">Card number</Label>
          <Input
            id="card-number"
            placeholder="1234 5678 9012 3456"
            inputMode="numeric"
            value={card.number}
            onChange={(e) => setCard({ ...card, number: e.target.value })}
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="card-name">Name on card</Label>
          <Input
            id="card-name"
            value={card.name}
            onChange={(e) => setCard({ ...card, name: e.target.value })}
            disabled
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="card-expiry">Expiry</Label>
            <Input id="card-expiry" placeholder="MM/YY" disabled value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-cvc">CVC</Label>
            <Input id="card-cvc" placeholder="123" disabled value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
          </div>
        </div>
        <Button className="w-full" disabled>
          <Lock className="size-4" /> Pay Rs. {amount.toLocaleString()}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Online card payments are coming soon.
        </p>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Separator />
        <Button
          variant="secondary"
          className="w-full"
          onClick={skip}
          disabled={pending}
        >
          {pending ? "Confirming…" : "Skip payment for now (temporary)"}
        </Button>
      </CardFooter>
    </Card>
  );
}
