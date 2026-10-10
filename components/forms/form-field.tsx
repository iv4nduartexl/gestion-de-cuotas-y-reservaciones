import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Field } from "./field";

type FormFieldProps = ComponentProps<typeof Input> & {
  name: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
};

/** Labelled input. The id defaults to the name; pass `id` when a form repeats on a page. */
export function FormField({ name, label, error, hint, optional, id, ...props }: FormFieldProps) {
  const inputId = id ?? name;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} optional={optional}>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
    </Field>
  );
}
