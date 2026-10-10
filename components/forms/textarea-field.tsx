import type { ComponentProps } from "react";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "./field";

export function TextareaField({
  name,
  label,
  error,
  optional,
  ...props
}: ComponentProps<typeof Textarea> & { name: string; label: string; error?: string; optional?: boolean }) {
  return (
    <Field id={name} label={label} error={error} optional={optional}>
      <Textarea
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );
}
