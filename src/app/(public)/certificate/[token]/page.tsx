import { notFound } from "next/navigation";
import { getCertificateByToken } from "@/features/certificates/server/queries";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { PrintButton } from "@/features/invoices/client/PrintButton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Award, Download } from "lucide-react";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({
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
  const view = await getCertificateByToken(token);
  if (!view) notFound();
  const { certificate, studentName, taskCount } = view;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-10 print:py-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <PrintButton />
        <Button
          render={
            <a href={`/api/pdf/certificate/${certificate.public_token}`} download />
          }
        >
          <Download className="size-4" /> Download PDF
        </Button>
      </div>

      <div className="rounded-lg border-6 border-double border-amber-500 bg-gradient-to-b from-amber-50/60 to-background p-10 text-center shadow-sm dark:from-amber-950/20 print:shadow-none">
        <Award className="mx-auto size-14 text-amber-500" />
        <p className="mt-4 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Certificate of Completion
        </p>
        <h1 className="mt-2 text-2xl font-bold">MathDoc</h1>

        <p className="mt-8 text-muted-foreground">This certifies that</p>
        <p className="mt-2 font-serif text-4xl font-bold italic">
          {studentName}
        </p>
        <p className="mx-auto mt-6 max-w-md text-muted-foreground">
          has successfully completed all {taskCount} tasks of their Personal
          Improvement Plan, showing real dedication and progress in
          mathematics.
        </p>

        <div className="mx-auto mt-12 flex max-w-md items-end justify-between text-sm">
          <div className="text-left">
            <p className="font-medium">
              {format(new Date(certificate.issued_at), "d MMMM yyyy")}
            </p>
            <div className="mt-1 w-32 border-t pt-1 text-muted-foreground">
              Date
            </div>
          </div>
          <div className="text-left">
            <p className="font-serif text-xl italic">Sir</p>
            <div className="mt-1 w-32 border-t pt-1 text-muted-foreground">
              Teacher
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Certificate ID: {certificate.id.slice(0, 8).toUpperCase()} · Verify at
          this page&apos;s link
        </p>
      </div>
    </main>
  );
}
