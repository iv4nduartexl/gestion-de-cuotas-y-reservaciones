"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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

/** Button that asks for confirmation, then runs a (bound) server action. */
export function ConfirmActionButton({
  action,
  label,
  title,
  description,
  confirmLabel = label,
  successMessage,
  variant = "outline",
  size = "default",
}: {
  action: () => Promise<unknown>;
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Toast shown after the action succeeds. */
  successMessage?: string;
  variant?: "outline" | "destructive" | "ghost";
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await action();
                  setOpen(false);
                  if (successMessage) toast.success(successMessage);
                })
              }
            >
              {pending ? "Procesando…" : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
