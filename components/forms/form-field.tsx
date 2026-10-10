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

export function FormField({ name, label, error, hint, optional, ...props }: FormFieldProps) {
  return (
    <Field id={name} label={label} error={error} hint={hint} optional={optional}>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );
}
