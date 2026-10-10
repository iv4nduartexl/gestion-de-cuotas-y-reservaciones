"use client";

import { updateBusinessProfileAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { groupedInputClassName, InputGroup } from "@/components/ui-kit/input-group";
import { useFormAction } from "@/hooks/use-form-action";
import { SLUG_MAX_LENGTH } from "@/lib/slug";
import { FEATURED_TIME_ZONES } from "@/lib/timezones";

export function BusinessProfileForm({
  name,
  slug,
  timezone,
  timezones,
  appHost,
}: {
  name: string;
  slug: string;
  timezone: string;
  timezones: string[];
  appHost: string;
}) {
  const { state, pending, formProps } = useFormAction(updateBusinessProfileAction, {});
  const errors = state.errors ?? {};

  return (
    <form {...formProps} noValidate className="grid max-w-xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <FormField name="name" label="Nombre del negocio" defaultValue={name} maxLength={80} error={errors.name} />
      <Field
        id="slug"
        label="Link de reservas"
        error={errors.slug}
        hint="Si lo cambiás, el link anterior deja de funcionar."
      >
        <InputGroup prefix={`${appHost}/`} invalid={!!errors.slug}>
          <input
            id="slug"
            name="slug"
            defaultValue={slug}
            maxLength={SLUG_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={groupedInputClassName}
          />
        </InputGroup>
      </Field>
      <Field id="timezone" label="Zona horaria" error={errors.timezone}>
        <NativeSelect id="timezone" name="timezone" className="w-full" defaultValue={timezone}>
          <NativeSelectOptGroup label="Más usadas">
            {FEATURED_TIME_ZONES.map((zone) => (
              <NativeSelectOption key={zone.value} value={zone.value}>
                {zone.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Todas">
            {timezones.map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        </NativeSelect>
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </div>
    </form>
  );
}
