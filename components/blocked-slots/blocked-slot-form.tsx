"use client";

import { useState } from "react";

import { createBlockedSlotAction } from "@/app/dashboard/schedule/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker } from "@/components/forms/py-inputs";
import { TimePicker } from "@/components/forms/time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useFormAction } from "@/hooks/use-form-action";

export function BlockedSlotForm({
  staffOptions,
  allowBusinessWide,
  defaultStaffId = "",
  showStaffPicker,
  today,
}: {
  staffOptions: { id: string; name: string }[];
  allowBusinessWide: boolean;
  defaultStaffId?: string;
  /** Hidden in solo mode: blocks apply to the whole business. */
  showStaffPicker: boolean;
  today: string;
}) {
  const { state, pending, formProps } = useFormAction(createBlockedSlotAction, {});
  const errors = state.errors ?? {};
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");

  return (
    <form {...formProps} noValidate className="flex flex-col gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}

      {showStaffPicker ? (
        <Field id="staffId" label="¿Para quién?" error={errors.staffId}>
          <NativeSelect id="staffId" name="staffId" className="w-full sm:max-w-sm" defaultValue={defaultStaffId}>
            {allowBusinessWide && <NativeSelectOption value="">Todo el negocio (ej.: feriado)</NativeSelectOption>}
            {staffOptions.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <input type="hidden" name="staffId" value={defaultStaffId} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="startDate" label="Desde" error={errors.startDate}>
          <DatePicker
            id="startDate"
            name="startDate"
            value={startDate}
            min={today}
            onChange={(value) => {
              setStartDate(value);
              if (endDate < value) setEndDate(value);
            }}
          />
        </Field>
        <Field id="endDate" label="Hasta" error={errors.endDate}>
          <DatePicker id="endDate" name="endDate" value={endDate} min={startDate} onChange={setEndDate} />
        </Field>
      </div>

      <Label className="flex w-fit cursor-pointer items-center gap-3 font-semibold">
        <Switch checked={allDay} onCheckedChange={setAllDay} />
        Todo el día
      </Label>
      <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />

      {!allDay && (
        <div className="flex flex-wrap items-end gap-4">
          <Field id="startTime" label="Hora de inicio" error={errors.startTime}>
            <TimePicker id="startTime" name="startTime" aria-label="Hora de inicio" value={startTime} onChange={setStartTime} />
          </Field>
          <Field id="endTime" label="Hora de fin" error={errors.endTime}>
            <TimePicker id="endTime" name="endTime" aria-label="Hora de fin" value={endTime} onChange={setEndTime} />
          </Field>
        </div>
      )}

      <FormField
        name="reason"
        label="Motivo"
        optional
        placeholder="Vacaciones, trámite, feriado…"
        maxLength={200}
        error={errors.reason}
        className="sm:max-w-md"
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Agregar día libre"}
        </Button>
      </div>
    </form>
  );
}
