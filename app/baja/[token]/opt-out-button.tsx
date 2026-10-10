"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setEmailOptOutAction } from "./actions";

export function EmailOptOutButton({ token, optedOut }: { token: string; optedOut: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={optedOut ? "outline" : "default"}
      disabled={pending}
      onClick={() => startTransition(async () => void (await setEmailOptOutAction(token, !optedOut)))}
    >
      {pending ? "Guardando…" : optedOut ? "Volver a recibir recordatorios" : "Dejar de recibir correos"}
    </Button>
  );
}
