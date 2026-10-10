"use client";

import { updateInternalNotesAction } from "@/app/dashboard/agenda/actions";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";

export function InternalNotesForm({ id, notes }: { id: string; notes: string | null }) {
  const { state, pending, formProps } = useFormAction(updateInternalNotesAction.bind(null, id), {});
  return (
    <form {...formProps} className="flex flex-col gap-3">
      <TextareaField
        name="internalNotes"
        label="Nota interna"
        placeholder="Solo la ve tu equipo, nunca el cliente."
        defaultValue={notes ?? ""}
        rows={3}
        error={state.errors?.internalNotes ?? state.errors?.form}
      />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Guardando…" : "Guardar nota"}
        </Button>
      </div>
    </form>
  );
}
