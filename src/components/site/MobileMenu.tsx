"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

/**
 * Hamburger button that opens a slide-in panel. The nav content is passed in as
 * children (so callers keep their own links/badges), and the panel auto-closes
 * whenever the route changes.
 */
export function MobileMenu({
  children,
  title = "Menu",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation by comparing against the previous render rather than in
  // an effect. The effect version rendered the panel open once more after the
  // route had already changed, so the menu visibly lingered over the new page.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0">
        <SheetTitle className="px-4 pt-4 pb-2">{title}</SheetTitle>
        <nav className="flex flex-col gap-1 p-3 pt-0">{children}</nav>
      </SheetContent>
    </Sheet>
  );
}
