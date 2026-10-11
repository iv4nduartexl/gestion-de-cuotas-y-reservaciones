"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  // After a successful submit we navigate away, but the page stays alive in
  // the background (<Activity>). Reset when it's hidden, so coming back (e.g.
  // after signing out) shows a usable form instead of a stuck button.
  useEffect(() => () => setPending(false), []);

  if (linkError || !token) {
    return (
      <div className="grid gap-4">
        <FormMessage type="error">
          {authErrorMessage({ code: linkError ?? "INVALID_TOKEN" })}
        </FormMessage>
        <Link href="/forgot-password" className={buttonVariants({ variant: "outline" })}>
          Pedir un nuevo enlace
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <FormMessage type="success">
          Tu contraseña fue actualizada. Ya podés ingresar.
        </FormMessage>
        <Link href="/sign-in" className={buttonVariants()}>Ingresar</Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(resetPasswordSchema, new FormData(event.currentTarget));
    if (!parsed.success) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: parsed.data.password,
      token: token!,
    });
    setPending(false);
    if (error) return setErrors({ form: authErrorMessage(error) });
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <FormField
        name="password"
        type="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
        required
        error={errors.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label="Repetí la contraseña"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
