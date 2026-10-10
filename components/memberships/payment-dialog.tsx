"use client";

import { BanknoteIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { recordPaymentAction } from "@/app/dashboard/cuotas/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker, MoneyInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/actions";
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/membership-constants";
import { cn } from "@/lib/utils";

export function PaymentDialog({
  chargeId,
  clientName,
  description,
  remainingInput,
  remainingLabel,
  currencyPrefix,
  today,
  size = "sm",
}: {
  chargeId: string;
  clientName: string;
  /** e.g. "Mensual · vence 05/10/2026" */
  description: string;
  /** Remaining balance formatted for the input ("150.000"). */
  remainingInput: string;
  remainingLabel: string;
  currencyPrefix: string;
  today: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [paidOn, setPaidOn] = useState(today);
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const errors = state.errors ?? {};

  // Calls the action directly (not via useActionState) so the toast and
  // closing still happen when the paid cuota disappears from the list and
  // this component unmounts.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await recordPaymentAction(chargeId, {}, formData);
      setState(result);
      if (result.message) {
        toast.success(result.message);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button type="button" size={size} onClick={() => setOpen(true)}>
        <BanknoteIcon aria-hidden="true" /> Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Registrar pago de {clientName}</DialogTitle>
            <DialogDescription>
              {description} · Debe {remainingLabel}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
            <Field id={`amount-${chargeId}`} label="Monto recibido" error={errors.amount} hint="Si paga una parte, la cuota queda como “Parcial”.">
              <MoneyInput id={`amount-${chargeId}`} name="amount" prefix={currencyPrefix} defaultValue={remainingInput} invalid={!!errors.amount} />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Cómo pagó</legend>
              <input type="hidden" name="method" value={method} />
              <div className="flex flex-wrap gap-2">
                {MANUAL_PAYMENT_METHODS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={method === value}
                    onClick={() => setMethod(value)}
                    className={cn(
                      "h-9 cursor-pointer rounded-full border px-3.5 text-sm font-semibold transition-colors",
                      method === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[value].split(" (")[0]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`paidOn-${chargeId}`} label="Fecha" error={errors.paidOn}>
                <DatePicker id={`paidOn-${chargeId}`} name="paidOn" value={paidOn} onChange={setPaidOn} />
              </Field>
              <FormField name="reference" id={`reference-${chargeId}`} label="Comprobante" optional placeholder="N.º de transferencia" error={errors.reference} />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Guardando…" : "Guardar pago"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
