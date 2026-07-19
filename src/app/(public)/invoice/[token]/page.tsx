import { notFound } from "next/navigation";
import { getInvoiceByToken } from "@/features/invoices/server/queries";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { PrintButton } from "@/features/invoices/client/PrintButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { formatPhone } from "@/lib/shared/phone";

export const metadata = { title: "Invoice" };

const statusLabel: Record<string, { text: string; variant: "default" | "secondary" | "destructive" }> = {
  paid: { text: "PAID", variant: "default" },
  bypassed: { text: "PAYMENT PENDING", variant: "secondary" },
  unpaid: { text: "UNPAID", variant: "destructive" },
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const rl = await rateLimit("public_page", `ip:${await clientIp()}`);
  if (!rl.allowed) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <p className="text-muted-foreground">{rl.message}</p>
      </main>
    );
  }

  const { token } = await params;
  const view = await getInvoiceByToken(token);
  if (!view) notFound();
  const { invoice, appointment, slot, student } = view;
  const status = statusLabel[invoice.status] ?? statusLabel.unpaid;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 py-10 print:py-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <PrintButton />
        <Button
          render={<a href={`/api/pdf/invoice/${invoice.public_token}`} download />}
        >
          <Download className="size-4" /> Download PDF
        </Button>
      </div>

      <div className="rounded-lg border p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">MathDoc</h1>
            <p className="text-sm text-muted-foreground">
              Personal Maths Coaching
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">INVOICE</p>
            <p className="text-sm text-muted-foreground">
              #{invoice.id.slice(0, 8).toUpperCase()}
            </p>
            <Badge variant={status.variant} className="mt-1">
              {status.text}
            </Badge>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-muted-foreground">Billed to</p>
            <p className="font-medium">{student.full_name ?? "Student"}</p>
            {student.phone && <p>{formatPhone(student.phone)}</p>}
            {student.address && <p className="whitespace-pre-line">{student.address}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold text-muted-foreground">Issued</p>
            <p>{format(new Date(invoice.issued_at), "d MMMM yyyy")}</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">
                One-to-one tutoring session (
                {appointment.mode === "online" ? "online" : "in person"}) —{" "}
                {format(new Date(slot.starts_at), "EEE d MMM yyyy, h:mm a")}
              </td>
              <td className="py-3 text-right">
                Rs. {Number(invoice.amount).toLocaleString()}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right font-semibold">Total</td>
              <td className="pt-4 text-right text-lg font-bold">
                Rs. {Number(invoice.amount).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <Separator className="my-6" />
        <p className="text-center text-xs text-muted-foreground">
          Thank you! Keep this invoice for your records.
        </p>
      </div>
    </main>
  );
}
