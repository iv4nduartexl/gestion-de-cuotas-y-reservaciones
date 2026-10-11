"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      <LogOutIcon aria-hidden="true" /> Cerrar sesión
    </Button>
  );
}
