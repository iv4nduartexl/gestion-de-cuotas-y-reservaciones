"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { impersonateAction } from "@/app/admin/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** "Entrar como dueño" (or "Abrir" for the admin's own business), with a confirmation. */
export function ImpersonateButton({
  organizationId,
  business,
  owner,
  own,
}: {
  organizationId: string;
  business: string;
  owner: string;
  /** The admin is a member: just open it, no impersonation. */
  own: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = own ? "Abrir" : "Entrar como dueño";

  function enter() {
    startTransition(async () => {
      const error = await impersonateAction(organizationId);
      if (error) {
        toast.error(error);
        setOpen(false);
      }
    });
  }

  if (own) {
    return (
      <Button type="button" variant="outline" disabled={pending} onClick={enter} aria-label={`Abrir ${business}`}>
        {pending ? "Abriendo…" : label}
      </Button>
    );
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} aria-label={`Entrar a ${business} como dueño`}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Entrar a {business}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a entrar como {owner} durante 1 hora. Los cambios son reales (sus clientes reciben avisos) y quedan registrados en
              su Actividad como “Soporte (admin)”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button disabled={pending} onClick={enter}>
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
