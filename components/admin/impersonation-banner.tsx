"use client";

import { ShieldAlertIcon } from "lucide-react";
import { useTransition } from "react";

import { stopImpersonatingAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** Always visible while the developer admin is inside someone's business. */
export function ImpersonationBanner({ business, owner, until }: { business: string; owner: string; until: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-coral px-4 py-2 text-sm font-semibold text-white md:px-8">
      <ShieldAlertIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        Modo admin: estás en <strong>{business}</strong> como <strong>{owner}</strong> · vence {until}. Los cambios son reales.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-white/70 bg-transparent text-white hover:bg-white/15 hover:text-white"
        disabled={pending}
        onClick={() => startTransition(() => stopImpersonatingAction())}
      >
        {pending ? "Saliendo…" : "Salir"}
      </Button>
    </div>
  );
}
