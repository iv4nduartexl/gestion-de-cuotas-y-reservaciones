"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { EMAIL_VERIFIED_CALLBACK } from "@/lib/constants";
import { parseForm, safeRedirectPath, type FieldErrors } from "@/lib/forms";
import { signInSchema } from "@/lib/validation/auth";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(signInSchema, new FormData(event.currentTarget));
    if (!parsed.success) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    const { error } = await authClient.signIn.email(parsed.data);
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        await authClient.sendVerificationEmail({
          email: parsed.data.email,
          callbackURL: EMAIL_VERIFIED_CALLBACK,
        });
      }
      setPending(false);
      return setErrors({ form: authErrorMessage(error) });
    }
    router.replace(safeRedirectPath(searchParams.get("next"), "/dashboard"));
    router.refresh();
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
      <div className="grid gap-2">
        <FormField
          name="password"
          type="password"
          label="Contraseña"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
