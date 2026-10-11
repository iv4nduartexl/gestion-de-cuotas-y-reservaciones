"use client";

import { CalendarDaysIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { es } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { groupedInputClassName, InputGroup } from "@/components/ui-kit/input-group";
import { formatCalendarDate } from "@/lib/datetime";
import { maskCi, maskGuaranies, maskPhone, reformatWithCaret } from "@/lib/masks";
import { cn } from "@/lib/utils";

type NativeInputProps = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "prefix"> & {
  defaultValue?: string;
  invalid?: boolean;
};

/** Keeps a masked input's value and caret in sync while the user types. */
function useMaskedValue(initial: string, mask: (raw: string) => string) {
  const [value, setValue] = useState(() => mask(initial));

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const next = reformatWithCaret(input.value, input.selectionStart ?? input.value.length, mask);
    setValue(next.value);
    // Restore the caret after React writes the reformatted value.
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(next.caret, next.caret);
    });
  }

  return { value, onChange };
}

/** Guaraníes with live thousand dots: 1250000 -> "1.250.000". */
export function MoneyInput({
  defaultValue = "",
  invalid,
  prefix = "Gs.",
  onValueChange,
  ...props
}: NativeInputProps & { prefix?: string; /** The masked text after each change ("1.250.000"). */ onValueChange?: (value: string) => void }) {
  const masked = useMaskedValue(defaultValue, maskGuaranies);
  return (
    <InputGroup prefix={prefix} invalid={invalid}>
      <input
        {...props}
        value={masked.value}
        onChange={(event) => {
          masked.onChange(event);
          onValueChange?.(maskGuaranies(event.target.value));
        }}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cn(groupedInputClassName, "font-semibold tabular")}
      />
    </InputGroup>
  );
}

/** Paraguayan phone: "0981 123 456". The server normalizes to +595… */
export function PhoneInput({
  defaultValue = "",
  invalid,
  onValueChange,
  ...props
}: NativeInputProps & { /** The masked text after each change. */ onValueChange?: (value: string) => void }) {
  const masked = useMaskedValue(defaultValue, maskPhone);
  return (
    <InputGroup prefix="PY" invalid={invalid}>
      <input
        {...props}
        value={masked.value}
        onChange={(event) => {
          masked.onChange(event);
          onValueChange?.(maskPhone(event.target.value));
        }}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={props.placeholder ?? "0981 123 456"}
        aria-invalid={invalid || undefined}
        className={groupedInputClassName}
      />
    </InputGroup>
  );
}

/** Cédula: "4.567.890" (letters allowed for foreign documents). */
export function CiInput({
  defaultValue = "",
  invalid,
  className,
  onValueChange,
  ...props
}: NativeInputProps & { onValueChange?: (value: string) => void }) {
  const masked = useMaskedValue(defaultValue, maskCi);
  return (
    <Input
      {...props}
      value={masked.value}
      onChange={(event) => {
        masked.onChange(event);
        onValueChange?.(maskCi(event.target.value));
      }}
      inputMode="text"
      autoComplete="off"
      placeholder={props.placeholder ?? "4.567.890"}
      aria-invalid={invalid || undefined}
      className={className}
    />
  );
}

/** Spanish calendar (weeks start on Monday). Submits "yyyy-MM-dd". */
export function DatePicker({
  id,
  name,
  value,
  onChange,
  min,
  invalid,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const minDate = min ? new Date(`${min}T00:00:00`) : undefined;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={invalid || undefined}
              className="w-full justify-start font-medium capitalize"
            />
          }
        >
          <CalendarDaysIcon className="text-primary" aria-hidden="true" />
          {value ? formatCalendarDate(value, "EEE dd/MM/yyyy") : "Elegí una fecha"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(date) => {
              if (!date) return;
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

