"use client";

import { FlagIcon } from "lucide-react";

import { addNationalHolidaysAction } from "@/app/dashboard/schedule/actions";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";

export function AddHolidaysButton() {
  const { pending, formProps } = useFormAction(addNationalHolidaysAction, {});
  return (
    <form {...formProps}>
      <Button type="submit" variant="soft" disabled={pending}>
        <FlagIcon aria-hidden="true" />
        {pending ? "Agregando…" : "Agregar feriados nacionales"}
      </Button>
    </form>
  );
}
