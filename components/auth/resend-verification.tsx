"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { EMAIL_VERIFIED_CALLBACK } from "@/lib/constants";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ResendVerification() {
  const email = useSearchParams().get("email") ?? "";
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(forgotPasswordSchema, new FormData(event.currentTarget));
    if (!parsed.success) return setErrors(parsed.errors);

    setErrors({});
    setSent(false);
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({
      email: parsed.data.email,
      callbackURL: EMAIL_VERIFIED_CALLBACK,
    });
    setPending(false);
    if (error) return setErrors({ form: authErrorMessage(error) });
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {email ? (
          <>
            Te enviamos un enlace a <strong className="text-foreground">{email}</strong>.
            Abrilo para activar tu cuenta.
          </>
        ) : (
          "Abrí el enlace que te enviamos por correo para activar tu cuenta."
        )}
      </p>
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      {sent && (
        <FormMessage type="success">
          Si la cuenta existe y no está verificada, te enviamos un nuevo enlace.
        </FormMessage>
      )}
      <FormField
        name="email"
        type="email"
        label="¿No te llegó? Reenviar a"
        defaultValue={email}
        autoComplete="email"
        required
        error={errors.email}
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Enviando…" : "Reenviar enlace"}
      </Button>
    </form>
  );
}
