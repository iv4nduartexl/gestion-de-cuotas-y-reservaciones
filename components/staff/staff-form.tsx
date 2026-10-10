"use client";

import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";

export function StaffForm({
  action,
  staff,
  members,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  staff?: { name: string; memberId: string | null };
  members: { id: string; name: string; email: string }[];
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};

  return (
    <form {...formProps} noValidate className="grid max-w-xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <FormField
        name="name"
        label="Nombre"
        placeholder="Ej.: Pedro"
        defaultValue={staff?.name}
        error={errors.name}
        hint="Así lo van a ver tus clientes al reservar."
      />
      <Field
        id="memberId"
        label="Usuario del panel"
        optional
        error={errors.memberId}
        hint="Vinculalo si esta persona también entra a Agenda con su propio usuario."
      >
        <NativeSelect id="memberId" name="memberId" className="w-full" defaultValue={staff?.memberId ?? ""}>
          <NativeSelectOption value="">Sin usuario</NativeSelectOption>
          {members.map((member) => (
            <NativeSelectOption key={member.id} value={member.id}>
              {member.name} ({member.email})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
