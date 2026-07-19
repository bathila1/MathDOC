import { NextRequest, NextResponse } from "next/server";
import { getInvoiceByToken } from "@/features/invoices/server/queries";
import { renderInvoicePdf } from "@/features/invoices/server/pdf";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = await rateLimit("public_page", `ip:${await clientIp()}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const { token } = await params;
  const view = await getInvoiceByToken(token);
  if (!view) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const pdf = await renderInvoicePdf(view);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mathdoc-invoice-${view.invoice.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
