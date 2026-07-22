import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/** Consistent "back to …" link used at the top of every detail page. */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      render={<Link href={href} />}
    >
      <ArrowLeft className="size-4" /> {label}
    </Button>
  );
}
