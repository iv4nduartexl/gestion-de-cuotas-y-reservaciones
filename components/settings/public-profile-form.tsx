"use client";

import { updatePublicProfileAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { PhoneInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";

export function PublicProfileForm({
  publicPhone,
  address,
  description,
}: {
  publicPhone: string | null;
  address: string | null;
  description: string | null;
}) {
  const { state, pending, formProps } = useFormAction(updatePublicProfileAction, {});
  const errors = state.errors ?? {};
  return (
    <form {...formProps} noValidate className="grid max-w-xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <Field id="publicPhone" label="WhatsApp del negocio" optional error={errors.publicPhone} hint="Tus clientes van a poder escribirte con un toque.">
        <PhoneInput id="publicPhone" name="publicPhone" defaultValue={publicPhone ?? ""} invalid={!!errors.publicPhone} />
      </Field>
      <FormField name="address" label="Dirección" optional placeholder="Av. España 1234, Asunción" defaultValue={address ?? ""} maxLength={200} error={errors.address} />
      <TextareaField
        name="description"
        label="Descripción corta"
        optional
        placeholder="Cortes clásicos y modernos, barba y afeitado con navaja."
        defaultValue={description ?? ""}
        rows={2}
        maxLength={300}
        error={errors.description}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos públicos"}
        </Button>
      </div>
    </form>
  );
}
