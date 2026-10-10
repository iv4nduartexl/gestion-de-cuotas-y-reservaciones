"use client";

import { CheckCircle2Icon, CheckIcon, RotateCcwIcon, UserXIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setAppointmentStatusAction } from "@/app/dashboard/agenda/actions";
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
import { nextStatuses, type AppointmentStatus } from "@/lib/appointment-status";

const ACTIONS: Record<
  AppointmentStatus,
  { label: string; icon: React.ReactNode; variant: "default" | "outline" | "destructive" | "soft"; confirm?: string }
> = {
  confirmed: { label: "Confirmar", icon: <CheckIcon />, variant: "default" },
  completed: { label: "Vino (completado)", icon: <CheckCircle2Icon />, variant: "default" },
  no_show: { label: "No vino", icon: <UserXIcon />, variant: "outline", confirm: "Se marca como “No vino” y el horario queda libre." },
  cancelled: { label: "Cancelar turno", icon: <XIcon />, variant: "destructive", confirm: "El horario queda libre para otra reserva. No se puede deshacer." },
  pending: { label: "Pendiente", icon: null, variant: "outline" },
};

export function StatusActions({ id, status }: { id: string; status: AppointmentStatus }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<AppointmentStatus | null>(null);
  const options = nextStatuses(status);
  if (options.length === 0) return null;

  function run(next: AppointmentStatus) {
    startTransition(async () => {
      const message = await setAppointmentStatusAction(id, next);
      setConfirming(null);
      if (message) toast.success(message);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((next) => {
        const action = ACTIONS[next];
        const isUndo = next === "confirmed" && (status === "completed" || status === "no_show");
        const label = status === "pending" && next === "cancelled" ? "Rechazar" : isUndo ? "Volver a confirmado" : action.label;
        return (
          <Button
            key={next}
            type="button"
            variant={isUndo ? "outline" : action.variant}
            disabled={pending}
            onClick={() => (action.confirm ? setConfirming(next) : run(next))}
          >
            {isUndo ? <RotateCcwIcon /> : action.icon}
            {label}
          </Button>
        );
      })}
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming === "cancelled" ? "¿Cancelar este turno?" : "¿Marcar que no vino?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirming ? ACTIONS[confirming].confirm : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <Button
              variant={confirming === "cancelled" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => confirming && run(confirming)}
            >
              {pending ? "Guardando…" : "Sí, confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
