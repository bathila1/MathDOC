"use client";

import { useTransition } from "react";
import { logout } from "@/features/auth/server/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
    >
      <LogOut className="size-4" />
      Log out
    </Button>
  );
}
