"use client";

import { useState, type FormEvent } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(forgotPasswordSchema, new FormData(event.currentTarget));
    if (!parsed.success) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) return setErrors({ form: authErrorMessage(error) });
    setSent(true);
  }

  if (sent) {
    return (
      <FormMessage type="success">
        Si existe una cuenta con ese correo, te enviamos un enlace para
        restablecer la contraseña.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <FormField
        name="email"
        type="email"
        label="Correo electrónico"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
