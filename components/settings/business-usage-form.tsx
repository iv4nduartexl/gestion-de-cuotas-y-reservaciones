"use client";

import { CalendarCheckIcon, WalletIcon } from "lucide-react";
import { useState } from "react";

import { updateBusinessUsageAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useFormAction } from "@/hooks/use-form-action";
import { BUSINESS_TYPE_INFO, BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

export function BusinessUsageForm({
  businessType,
  appointmentsEnabled,
  membershipsEnabled,
}: {
  businessType: BusinessType;
  appointmentsEnabled: boolean;
  membershipsEnabled: boolean;
}) {
  const { state, pending, formProps } = useFormAction(updateBusinessUsageAction, {});
  const errors = state.errors ?? {};
  const [appointments, setAppointments] = useState(appointmentsEnabled);
  const [memberships, setMemberships] = useState(membershipsEnabled);

  return (
    <form {...formProps} noValidate className="grid max-w-xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <Field id="businessType" label="Tipo de negocio" hint="Cambia las palabras que usa Agenda (por ejemplo, “pacientes” en vez de “clientes”).">
        <NativeSelect id="businessType" name="businessType" className="w-full" defaultValue={businessType}>
          {BUSINESS_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {BUSINESS_TYPE_INFO[type].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-3">
        <input type="hidden" name="appointmentsEnabled" value={String(appointments)} />
        <input type="hidden" name="membershipsEnabled" value={String(memberships)} />
        <UsageToggle
          icon={<CalendarCheckIcon className="size-5" aria-hidden="true" />}
          title="Turnos online"
          description="Servicios, horarios y tu link de reservas."
          checked={appointments}
          onCheckedChange={setAppointments}
        />
        <UsageToggle
          icon={<WalletIcon className="size-5" aria-hidden="true" />}
          title="Cuotas y membresías"
          description="Planes y cuotas mensuales. Muy pronto."
          checked={memberships}
          onCheckedChange={setMemberships}
        />
        {(errors.products || (!appointments && !memberships)) && (
          <p className="text-sm text-destructive">{errors.products ?? "Elegí al menos una opción."}</p>
        )}
      </div>
      <div>
        <Button type="submit" disabled={pending || (!appointments && !memberships)}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function UsageToggle({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label className="flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 font-normal leading-normal">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <span className="flex flex-1 flex-col">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </Label>
  );
}
