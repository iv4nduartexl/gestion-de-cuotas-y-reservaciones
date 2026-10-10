"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { EMAIL_VERIFIED_CALLBACK } from "@/lib/constants";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { signUpSchema } from "@/lib/validation/auth";

export function SignUpForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseForm(signUpSchema, new FormData(event.currentTarget));
    if (!parsed.success) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    const { name, email, password } = parsed.data;
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: EMAIL_VERIFIED_CALLBACK,
    });
    if (error) {
      setPending(false);
      return setErrors({ form: authErrorMessage(error) });
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <FormField
        name="name"
        label="Nombre"
        autoComplete="name"
        required
        error={errors.name}
      />
      <FormField
        name="email"
        type="email"
        label="Correo electrónico"
        autoComplete="email"
        required
        error={errors.email}
      />
      <FormField
        name="password"
        type="password"
        label="Contraseña"
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
