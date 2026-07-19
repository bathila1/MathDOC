import { NextRequest, NextResponse } from "next/server";
import { getCertificateByToken } from "@/features/certificates/server/queries";
import { renderCertificatePdf } from "@/features/certificates/server/pdf";
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
  const view = await getCertificateByToken(token);
  if (!view) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  const pdf = await renderCertificatePdf(view);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mathdoc-certificate-${view.certificate.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
