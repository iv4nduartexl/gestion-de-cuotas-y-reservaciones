"use client";

import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { CiInput, PhoneInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";

type ClientValues = {
  name: string;
  phone: string;
  email: string | null;
  documentNumber: string | null;
  notes: string | null;
};

export function ClientForm({
  action,
  client,
  submitLabel,
  noun,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  client?: ClientValues;
  submitLabel: string;
  /** "cliente", "paciente", "alumno"... */
  noun: string;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};

  return (
    <form {...formProps} noValidate className="flex max-w-2xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}

      <SectionCard
        title="Contacto"
        description={`Con el teléfono le escribís por WhatsApp con un toque. Si cargás su correo, los recordatorios le llegan solos.`}
      >
        <div className="grid gap-5">
          <FormField
            name="name"
            label="Nombre y apellido"
            placeholder="María González"
            defaultValue={client?.name}
            autoComplete="off"
            error={errors.name}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label="Teléfono / WhatsApp" error={errors.phone} hint="Celular o línea baja.">
              <PhoneInput id="phone" name="phone" defaultValue={client?.phone} invalid={!!errors.phone} />
            </Field>
            <FormField
              name="email"
              type="email"
              label="Correo"
              optional
              placeholder="maria@ejemplo.com"
              defaultValue={client?.email ?? ""}
              error={errors.email}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Datos adicionales" description={`Opcionales. Te ayudan a identificar a cada ${noun}.`}>
        <div className="grid gap-5">
          <Field id="documentNumber" label="C.I. (cédula)" optional error={errors.documentNumber}>
            <CiInput
              id="documentNumber"
              name="documentNumber"
              defaultValue={client?.documentNumber ?? ""}
              invalid={!!errors.documentNumber}
              className="sm:max-w-xs"
            />
          </Field>
          <TextareaField
            name="notes"
            label="Notas"
            placeholder="Preferencias, alergias, lo que quieras recordar…"
            defaultValue={client?.notes ?? ""}
            rows={3}
            error={errors.notes}
          />
        </div>
      </SectionCard>

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lift">
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
