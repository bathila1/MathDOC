"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" /> Print
    </Button>
  );
}
