"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBookingAction } from "@/app/[slug]/actions";
import { FormMessage } from "@/components/forms/form-message";
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

export function CancelBookingButton({ slug, token }: { slug: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {error && <FormMessage type="error">{error}</FormMessage>}
      <Button type="button" variant="destructive" size="lg" className="w-full" onClick={() => setOpen(true)}>
        Cancelar turno
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar tu turno?</AlertDialogTitle>
            <AlertDialogDescription>
              El horario queda libre para otra persona. Si querés otro día, después podés reservar de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelBookingAction(slug, token);
                  setOpen(false);
                  if (result.errors?.form) setError(result.errors.form);
                  else toast.success("Turno cancelado");
                })
              }
            >
              {pending ? "Cancelando…" : "Sí, cancelar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
